import { WatiService } from "../services/wati-service";
import { WorkflowBuilder } from "../workflow/workflow-builder";
import { QuestionWithLogic } from "../core/types";
import { entityStore, createEntity } from "../core/entity-store";
import {
  EntityId,
  UserConversationState,
  ValidationContext,
} from "../core/types";
import { logger } from "../core/logger";
import { PayPalService } from "../services/paypal-service";
import { prisma } from "../core/prisma-client";
import { v4 as uuidv4 } from "uuid";

export class WhatsAppWorkflowHandler {
  private watiService: WatiService;
  private workflowBuilder: WorkflowBuilder;
  private userStates: Map<string, UserConversationState>;
  private paypalService: PayPalService;

  constructor(watiService: WatiService, workflowBuilder: WorkflowBuilder) {
    this.watiService = watiService;
    this.workflowBuilder = workflowBuilder;
    this.userStates = new Map<string, UserConversationState>();
    this.paypalService = new PayPalService(entityStore);

    // Load existing workflow states from database
    this.loadWorkflowStates();
  }

  private async loadWorkflowStates(): Promise<void> {
    try {
      const states = await prisma.workflowState.findMany();

      for (const state of states) {
        this.userStates.set(state.phoneNumber, {
          phoneNumber: state.phoneNumber,
          workflowId: state.workflowId || null,
          currentQuestionIndex: state.currentQuestionIndex,
          policyId: state.policyId || undefined,
          memberId: state.memberId || undefined,
          lastMessageTimestamp: state.lastMessageTimestamp,
          answers: state.answersJson ? JSON.parse(state.answersJson) : {},
          workflowHistory: state.workflowHistoryJson
            ? JSON.parse(state.workflowHistoryJson)
            : [],
          isWaitingForResponse: state.isWaitingForResponse,
          pendingTransition: state.pendingTransition || undefined,
        });
      }

      logger.info(`Loaded ${states.length} workflow states from database`);
    } catch (error) {
      logger.error("Error loading workflow states:", error);
    }
  }

  private async saveWorkflowState(state: UserConversationState): Promise<void> {
    try {
      await prisma.workflowState.upsert({
        where: { phoneNumber: state.phoneNumber },
        update: {
          workflowId: state.workflowId,
          currentQuestionIndex: state.currentQuestionIndex,
          policyId: state.policyId,
          memberId: state.memberId,
          lastMessageTimestamp: new Date(),
          answersJson: JSON.stringify(state.answers),
          workflowHistoryJson: JSON.stringify(state.workflowHistory),
          isWaitingForResponse: state.isWaitingForResponse,
          pendingTransition: state.pendingTransition || null,
        },
        create: {
          phoneNumber: state.phoneNumber,
          workflowId: state.workflowId,
          currentQuestionIndex: state.currentQuestionIndex,
          policyId: state.policyId,
          memberId: state.memberId,
          lastMessageTimestamp: new Date(),
          answersJson: JSON.stringify(state.answers),
          workflowHistoryJson: JSON.stringify(state.workflowHistory),
          isWaitingForResponse: state.isWaitingForResponse,
          pendingTransition: state.pendingTransition || null,
        },
      });
    } catch (error) {
      logger.error(
        `Error saving workflow state for ${state.phoneNumber}:`,
        error
      );
    }
  }

  // Add this function to your WhatsAppWorkflowHandler class
  private async debugPhoneNumberIssue(
    phoneNumber: string
  ): Promise<string | null> {
    console.log(
      `[DEBUG] Starting phone number investigation for: '${phoneNumber}'`
    );

    // Sample of existing policies
    const allPolicies = await prisma.policy.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });
    console.log(
      `[DEBUG] Sample of existing policies:`,
      allPolicies.map((p) => ({
        id: p.id,
        whatsappNumber: p.whatsappNumber,
        isCompleted: p.isCompleted,
      }))
    );

    // Check exact match
    console.log(
      `[DEBUG] Searching for policy with exact whatsappNumber: '${phoneNumber}'`
    );
    const policiesByExactNumber = await prisma.policy.findMany({
      where: { whatsappNumber: phoneNumber },
    });
    console.log(
      `[DEBUG] Policies found by exact match: ${policiesByExactNumber.length}`
    );

    // Check without plus sign
    const phoneNumberWithoutPlus = phoneNumber.replace("+", "");
    console.log(
      `[DEBUG] Trying without plus sign: '${phoneNumberWithoutPlus}'`
    );
    const existingPolicyWithoutPlus = await prisma.policy.findFirst({
      where: { whatsappNumber: phoneNumberWithoutPlus },
    });
    console.log(
      `[DEBUG] Found with number without plus: ${
        existingPolicyWithoutPlus ? "YES" : "NO"
      }`
    );

    // Check last 10 digits
    const last10Digits = phoneNumber.replace(/\D/g, "").slice(-10);
    console.log(`[DEBUG] Trying with last 10 digits: '${last10Digits}'`);
    const existingPolicyLast10 = await prisma.policy.findFirst({
      where: { whatsappNumber: last10Digits },
    });
    console.log(
      `[DEBUG] Found with last 10 digits: ${
        existingPolicyLast10 ? "YES" : "NO"
      }`
    );

    // Return the matching policy id if found with any method
    if (policiesByExactNumber.length > 0) return policiesByExactNumber[0].id;
    if (existingPolicyWithoutPlus) return existingPolicyWithoutPlus.id;
    if (existingPolicyLast10) return existingPolicyLast10.id;

    return null;
  }
  // async startWorkflow(
  //   phoneNumber: string,
  //   workflowId: string = "policyWorkflow"
  // ): Promise<void> {
  //   try {
  //     // Format phone number by removing the plus sign
  //     const formattedPhoneNumber = phoneNumber.replace("+", "");

  //     // Initialize user state
  //     const userState: UserConversationState = {
  //       phoneNumber,
  //       workflowId,
  //       currentQuestionIndex: 0,
  //       lastMessageTimestamp: new Date(),
  //       answers: {},
  //       workflowHistory: [workflowId],
  //       isWaitingForResponse: false,
  //     };

  //     this.userStates.set(phoneNumber, userState);
  //     await this.saveWorkflowState(userState);

  //     logger.info(`Starting workflow for ${phoneNumber}`);

  //     try {
  //       // The key insight: we need to provide a policyNumber to avoid NULL unique constraint error
  //       // Generate a unique policy number based on timestamp and random characters
  //       const policyNumber = `POL-${Date.now()}-${Math.random()
  //         .toString(36)
  //         .substring(2, 7)
  //         .toUpperCase()}`;

  //       // Create policy using Prisma with a non-null policyNumber
  //       const policy = await prisma.policy.create({
  //         data: {
  //           whatsappNumber: formattedPhoneNumber,
  //           isCompleted: false,
  //           policyNumber: policyNumber, // This is the key fix - providing a unique policyNumber
  //         },
  //       });

  //       logger.info(
  //         `Created policy with ID: ${policy.id} and policyNumber: ${policyNumber}`
  //       );

  //       // Set up user state with the new policy
  //       userState.policyId = policy.id;
  //       await this.saveWorkflowState(userState);

  //       // Create entity in store
  //       const policyEntity = createEntity(
  //         "policy",
  //         {
  //           ...policy,
  //           updatedAt: new Date().toISOString(),
  //           createdAt: new Date().toISOString(),
  //         },
  //         policy.id
  //       );

  //       await entityStore.add(policyEntity);
  //       await entityStore.setCurrentEntity("policy", policyEntity);

  //       // Send welcome message
  //       await this.watiService.sendTextMessage(
  //         phoneNumber,
  //         "Welcome to our Insurance Application System! Let's start by gathering some information about your policy."
  //       );

  //       // Send the first question
  //       await this.sendNextQuestion(phoneNumber);
  //       return;
  //     } catch (error: any) {
  //       logger.error(`Error creating policy: ${error.message}`);

  //       // Try once more with a different approach - first, search for existing policy
  //       try {
  //         const existingPolicy = await prisma.policy.findFirst({
  //           where: { whatsappNumber: formattedPhoneNumber },
  //           orderBy: { createdAt: "desc" },
  //         });

  //         if (existingPolicy) {
  //           logger.info(`Found existing policy: ${existingPolicy.id}`);

  //           // Update the existing policy
  //           await prisma.policy.update({
  //             where: { id: existingPolicy.id },
  //             data: {
  //               isCompleted: false,
  //               updatedAt: new Date(),
  //             },
  //           });

  //           userState.policyId = existingPolicy.id;
  //           await this.saveWorkflowState(userState);

  //           // Set up entity store
  //           const policyEntity = createEntity(
  //             "policy",
  //             {
  //               ...existingPolicy,
  //               updatedAt: new Date().toISOString(),
  //               isCompleted: false,
  //             },
  //             existingPolicy.id
  //           );

  //           await entityStore.add(policyEntity);
  //           await entityStore.setCurrentEntity("policy", policyEntity);

  //           // Send welcome message
  //           await this.watiService.sendTextMessage(
  //             phoneNumber,
  //             "Welcome back to our Insurance Application System! Let's continue with your policy."
  //           );

  //           // Send the next question
  //           await this.sendNextQuestion(phoneNumber);
  //           return;
  //         }
  //       } catch (searchError: any) {
  //         logger.error(
  //           `Error searching for existing policy: ${searchError.message}`
  //         );
  //       }

  //       // As a last resort, try to communicate the issue to administrators
  //       const errorMessage = `Critical database error: Cannot create policy due to unique constraint on NULL policyNumber. Please check database configuration.`;
  //       logger.error(errorMessage);

  //       // Send a message to the user
  //       await this.watiService.sendTextMessage(
  //         phoneNumber,
  //         "We're experiencing technical difficulties with our system. Our team has been notified and will contact you shortly."
  //       );
  //     }
  //   } catch (error: any) {
  //     console.error(
  //       `[DEBUG] Critical error in startWorkflow for ${phoneNumber}:`,
  //       error
  //     );
  //     logger.error(`Critical error in startWorkflow: ${error.message}`);

  //     try {
  //       // Try to send an error message to the user
  //       await this.watiService.sendTextMessage(
  //         phoneNumber,
  //         "Sorry, we encountered a technical issue. Our team has been notified and will contact you soon."
  //       );
  //     } catch (msgError: any) {
  //       logger.error(`Failed to send error message: ${msgError.message}`);
  //     }
  //   }
  // }
  async startWorkflow(
    phoneNumber: string,
    workflowId: string = "policyWorkflow",
    skipWelcomeMessage: boolean = false // Add this parameter
  ): Promise<void> {
    try {
      // Format phone number by removing the plus sign
      const formattedPhoneNumber = phoneNumber.replace("+", "");

      // Initialize user state
      const userState: UserConversationState = {
        phoneNumber,
        workflowId,
        currentQuestionIndex: 0,
        lastMessageTimestamp: new Date(),
        answers: {},
        workflowHistory: [workflowId],
        isWaitingForResponse: false,
      };

      this.userStates.set(phoneNumber, userState);
      await this.saveWorkflowState(userState);

      logger.info(
        `Starting workflow for ${phoneNumber}, formatted as ${formattedPhoneNumber}`
      );

      // First check if a policy with this phone number already exists
      const existingPolicy = await prisma.policy.findUnique({
        where: { whatsappNumber: formattedPhoneNumber },
      });

      let policy;

      if (existingPolicy) {
        // Update existing policy
        logger.info(
          `Found existing policy for ${formattedPhoneNumber}: ${existingPolicy.id}`
        );

        policy = await prisma.policy.update({
          where: { id: existingPolicy.id },
          data: {
            isCompleted: false,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new policy with the whatsapp number
        logger.info(`Creating new policy for ${formattedPhoneNumber}`);

        policy = await prisma.policy.create({
          data: {
            whatsappNumber: formattedPhoneNumber,
            isCompleted: false,
          },
        });
      }

      logger.info(`Using policy with ID: ${policy.id}`);

      // Update user state with policy ID
      userState.policyId = policy.id;
      await this.saveWorkflowState(userState);

      // Create or update entity in the store
      const existingEntity = await entityStore.get(policy.id);
      if (existingEntity) {
        await entityStore.update(policy.id, {
          updatedAt: new Date().toISOString(),
          isCompleted: false,
        });
      } else {
        const policyEntity = createEntity(
          "policy",
          {
            ...policy,
            updatedAt: new Date().toISOString(),
            isCompleted: false,
          },
          policy.id
        );
        await entityStore.add(policyEntity);
      }

      await entityStore.setCurrentEntity(
        "policy",
        (await entityStore.get(policy.id)) as any
      );

      // Only send welcome message if not skipped
      if (!skipWelcomeMessage) {
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Welcome to our Insurance Application System! Let's start by gathering some information about your policy."
        );
      }

      // Send the first question
      await this.sendNextQuestion(phoneNumber);
    } catch (error) {
      console.error(`[DEBUG] Error handling policy for ${phoneNumber}:`, error);
      logger.error(`Error handling policy for ${phoneNumber}:`, error);

      // Send an error message to the user
      await this.watiService.sendTextMessage(
        phoneNumber,
        "Sorry, we encountered an issue starting your application. Please try again in a few moments."
      );
    }
  }
  async processIncomingMessage(
    phoneNumber: string,
    message: string
  ): Promise<void> {
    logger.debug(
      `processIncomingMessage called with phone: ${phoneNumber}, message: ${message}`
    );

    const userState = this.userStates.get(phoneNumber);

    if (!userState) {
      logger.info(
        `No active conversation for ${phoneNumber}, starting new workflow`
      );
      await this.startWorkflow(phoneNumber);
      return;
    }

    logger.debug(
      `Current user state: ${JSON.stringify({
        workflowId: userState.workflowId,
        currentQuestionIndex: userState.currentQuestionIndex,
        isWaitingForResponse: userState.isWaitingForResponse,
        pendingTransition: userState.pendingTransition,
        policyId: userState.policyId,
        memberId: userState.memberId,
      })}`
    );

    // Check if we're handling the "Add another member?" question
    if (userState.pendingTransition === "addNewMember") {
      logger.debug(
        `Handling add member follow-up for ${phoneNumber}, response: ${message}`
      );

      const normalizedResponse = message.toLowerCase().trim();
      if (normalizedResponse === "yes" || normalizedResponse === "y") {
        logger.info(`User ${phoneNumber} chose to add another member`);

        // Create a new member for the policy and restart member workflow
        await this.handleNewMemberCreation(phoneNumber);
        return;
      } else if (normalizedResponse === "no" || normalizedResponse === "n") {
        logger.info(
          `User ${phoneNumber} chose not to add another member, moving to summary`
        );

        // Clear the current member ID when moving to summary
        userState.memberId = undefined;
        userState.pendingTransition = null;
        await this.saveWorkflowState(userState);

        await this.transitionToNextWorkflow(phoneNumber, "summaryWorkflow");
        return;
      } else {
        // Invalid response, ask again
        logger.warn(
          `User ${phoneNumber} gave invalid response to add member question: ${message}`
        );
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Please respond with 'Yes' or 'No' to whether you want to add another member."
        );
        await this.watiService.sendInteractiveButtonsMessage(phoneNumber, {
          body: "Would you like to add another member to the policy?",
          buttons: [{ text: "Yes" }, { text: "No" }],
        });
        return;
      }
    }

    // Check if we're handling a payment method selection
    if (
      userState.workflowId === "paymentWorkflow" &&
      userState.pendingTransition === "paymentMethod"
    ) {
      logger.debug(
        `Handling payment method selection for ${phoneNumber}: ${message}`
      );

      const normalizedResponse = message.toLowerCase().trim();
      if (
        normalizedResponse === "paypal" ||
        normalizedResponse.includes("paypal")
      ) {
        if (userState.policyId) {
          await prisma.policy.update({
            where: { id: userState.policyId },
            data: { paymentMethod: "PayPal" },
          });

          // Process PayPal payment
          await this.processPayPalPayment(phoneNumber, userState.policyId);

          // Clear the pending transition
          userState.pendingTransition = null;
          await this.saveWorkflowState(userState);

          // Move to the next workflow
          await this.transitionToNextWorkflow(phoneNumber, "finalizeWorkflow");
        }
        return;
      } else if (
        normalizedResponse === "promo code" ||
        normalizedResponse.includes("promo")
      ) {
        // Handle promo code payment
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Please enter your promo code:"
        );

        // Update pending transition
        userState.pendingTransition = "promoCode";
        await this.saveWorkflowState(userState);
        return;
      } else {
        // Invalid payment method
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Please select a valid payment method: PayPal or Promo Code"
        );
        await this.watiService.sendInteractiveButtonsMessage(phoneNumber, {
          body: "Please select a payment method:",
          buttons: [{ text: "PayPal" }, { text: "Promo Code" }],
        });
        return;
      }
    }

    // Check if we're handling a promo code entry
    if (
      userState.workflowId === "paymentWorkflow" &&
      userState.pendingTransition === "promoCode"
    ) {
      logger.debug(`Handling promo code entry for ${phoneNumber}: ${message}`);

      if (userState.policyId) {
        // Apply the promo code
        await prisma.policy.update({
          where: { id: userState.policyId },
          data: {
            promoCode: message,
            paymentMethod: "Promo Code",
            paymentStatus: "COMPLETED",
            paymentCompletedAt: new Date(),
          },
        });

        // Send confirmation
        await this.watiService.sendTextMessage(
          phoneNumber,
          `Promo code "${message}" applied successfully! Your policy has been activated.`
        );

        // Clear the pending transition
        userState.pendingTransition = null;
        await this.saveWorkflowState(userState);

        // Move to the next workflow
        await this.transitionToNextWorkflow(phoneNumber, "finalizeWorkflow");
      }
      return;
    }

    // Check if the policy is already completed
    if (userState.policyId) {
      const policy = await prisma.policy.findUnique({
        where: { id: userState.policyId },
      });

      if (policy && policy.isCompleted) {
        logger.info(
          `Policy ${userState.policyId} is already completed, starting new workflow`
        );

        // Send message to the user
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Your previous policy application is already completed. Would you like to start a new application?"
        );

        // Send yes/no buttons
        await this.watiService.sendInteractiveButtonsMessage(phoneNumber, {
          body: "Start a new policy application?",
          buttons: [{ text: "Yes" }, { text: "No" }],
        });

        // Set pending transition for new policy
        userState.pendingTransition = "startNewPolicy";
        await this.saveWorkflowState(userState);
        return;
      }
    }

    // Check if we're handling a request to start a new policy
    if (userState.pendingTransition === "startNewPolicy") {
      const normalizedResponse = message.toLowerCase().trim();
      if (normalizedResponse === "yes" || normalizedResponse === "y") {
        logger.info(`User ${phoneNumber} chose to start a new policy`);
        await this.startWorkflow(phoneNumber);
        return;
      } else {
        // User doesn't want a new policy
        await this.watiService.sendTextMessage(
          phoneNumber,
          "No problem. If you need any assistance with your existing policy, please contact customer support."
        );

        // Clear the pending transition
        userState.pendingTransition = null;
        await this.saveWorkflowState(userState);
        return;
      }
    }

    // Handle session timeout - if last message was more than 60 minutes ago
    const sessionTimeout = 60 * 60 * 1000; // 60 minutes in milliseconds
    const timeSinceLastMessage =
      new Date().getTime() - userState.lastMessageTimestamp.getTime();

    if (timeSinceLastMessage > sessionTimeout) {
      logger.info(
        `Session timed out for ${phoneNumber}, last activity was ${
          timeSinceLastMessage / 1000 / 60
        } minutes ago`
      );

      await this.watiService.sendTextMessage(
        phoneNumber,
        "Welcome back! Your previous session timed out. Let's continue where you left off."
      );

      // Update timestamp but keep the same state
      userState.lastMessageTimestamp = new Date();
      await this.saveWorkflowState(userState);

      // Send the current question again
      await this.sendNextQuestion(phoneNumber);
      return;
    }

    // Update last message timestamp
    userState.lastMessageTimestamp = new Date();
    await this.saveWorkflowState(userState);

    // Regular message processing - process user answer to current question
    await this.processUserAnswer(phoneNumber, message);
  }

  // Enhanced handleNewMemberCreation method
  private async handleNewMemberCreation(phoneNumber: string): Promise<void> {
    const userState = this.userStates.get(phoneNumber);
    if (!userState || !userState.policyId) {
      logger.error(
        `Cannot create member: No policy ID found for ${phoneNumber}`
      );
      await this.watiService.sendTextMessage(
        phoneNumber,
        "Sorry, there was an error creating a new member. Let's try again."
      );
      return;
    }

    try {
      // Generate a new UUID for the member
      const memberId = uuidv4();
      logger.debug(
        `Creating new member with ID ${memberId} for policy ${userState.policyId}`
      );

      // Create a new member in the database with required fields and explicit ID
      const memberData = {
        id: memberId, // Explicitly set ID to avoid constraint issues
        isPrimary: false, // Secondary member
        policyId: userState.policyId,
        addedAt: new Date(),
        firstName: "", // Required fields with empty defaults
        lastName: "", // These will be filled during workflow
        dateOfBirth: "",
        gender: "",
      };

      try {
        // First create the member directly in the database
        const member = await prisma.member.create({
          data: memberData,
        });

        logger.info(
          `Created new member ${member.id} for policy ${userState.policyId}`
        );

        // Update user state to use the new member ID
        userState.memberId = member.id;
        userState.workflowId = "memberWorkflow"; // Reset to member workflow for new member
        userState.currentQuestionIndex = 0;
        userState.isWaitingForResponse = false;
        userState.pendingTransition = null;
        await this.saveWorkflowState(userState);

        // Create member entity in entity store
        try {
          const memberEntity = createEntity(
            "member",
            { ...memberData },
            member.id
          );

          await entityStore.add(memberEntity);
          await entityStore.setCurrentEntity("member", memberEntity);
          logger.debug(
            `Set current member entity in entity store: ${member.id}`
          );
        } catch (entityError) {
          // If entity store fails, log but continue
          logger.error(
            `Error setting entity store for member ${member.id}:`,
            entityError
          );
        }

        // Send confirmation message
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Creating a new member record. Please provide the information for this member."
        );

        // Send the first question
        await this.sendNextQuestion(phoneNumber);
      } catch (dbError: any) {
        // Handle database errors specifically
        logger.error(`Database error creating member:`, dbError);

        // Check if it's a unique constraint error
        if (dbError.code === "P2002") {
          logger.warn(`Unique constraint violation. Retrying with new ID...`);
          // Try one more time with another ID
          const newMemberId = uuidv4();
          memberData.id = newMemberId;

          const member = await prisma.member.create({
            data: memberData,
          });

          logger.info(
            `Created new member ${member.id} on second attempt for policy ${userState.policyId}`
          );

          // Update user state
          userState.memberId = member.id;
          userState.workflowId = "memberWorkflow";
          userState.currentQuestionIndex = 0;
          userState.isWaitingForResponse = false;
          userState.pendingTransition = null;
          await this.saveWorkflowState(userState);

          // Send confirmation and first question
          await this.watiService.sendTextMessage(
            phoneNumber,
            "Creating a new member record. Please provide the information for this member."
          );

          await this.sendNextQuestion(phoneNumber);
        } else {
          // For other errors, throw to be caught by outer try-catch
          throw dbError;
        }
      }
    } catch (error) {
      logger.error(`Error creating new member for ${phoneNumber}:`, error);
      await this.watiService.sendTextMessage(
        phoneNumber,
        "Sorry, there was an error creating a new member. Let's continue with the current policy."
      );

      // Move to summary workflow since we couldn't add a new member
      userState.workflowId = "summaryWorkflow";
      userState.currentQuestionIndex = 0;
      userState.isWaitingForResponse = false;
      userState.pendingTransition = null;
      await this.saveWorkflowState(userState);

      await this.sendNextQuestion(phoneNumber);
    }
  }
  private getWorkflowQuestionCount(workflowId: string): number {
    const workflowData = this.workflowBuilder.buildWorkflow(workflowId);
    if (!workflowData) {
      return 0;
    }
    return workflowData.questions.length;
  }

  private async processUserAnswer(
    phoneNumber: string,
    answer: string
  ): Promise<void> {
    logger.debug(
      `processUserAnswer called with phone: ${phoneNumber}, answer: ${answer}`
    );

    const userState = this.userStates.get(phoneNumber);
    if (!userState) {
      logger.error(`No user state found for ${phoneNumber}`);
      return;
    }

    try {
      const workflowData = this.workflowBuilder.buildWorkflow(
        userState.workflowId || "policyWorkflow"
      );

      if (!workflowData) {
        logger.error(`Workflow ${userState.workflowId} not found`);
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Sorry, there was an issue with the workflow. Let's start over."
        );
        await this.startWorkflow(phoneNumber);
        return;
      }

      logger.debug(
        `Current workflow: ${workflowData.id}, Question index: ${userState.currentQuestionIndex}`
      );

      // Ensure current question index is within bounds
      if (userState.currentQuestionIndex >= workflowData.questions.length) {
        logger.info(
          `Workflow questions exhausted for ${phoneNumber}, handling transition`
        );
        await this.handleWorkflowTransition(phoneNumber);
        return;
      }

      const currentQuestion =
        workflowData.questions[userState.currentQuestionIndex];

      if (!currentQuestion) {
        logger.error(
          `No current question found for index ${userState.currentQuestionIndex}`
        );
        await this.handleWorkflowTransition(phoneNumber);
        return;
      }

      logger.debug(`Processing answer for question: ${currentQuestion.id}`);

      // Validate answer
      const validationContext: ValidationContext = {
        currentEntityType: currentQuestion.entity,
        userAnswers: userState.answers,
      };

      const validationResult = currentQuestion.validation(
        answer,
        validationContext
      );

      if (!validationResult.isValid) {
        // Send validation error
        logger.debug(`Validation failed for answer: ${answer}`);
        await this.watiService.sendTextMessage(
          phoneNumber,
          `${validationResult.message} Please try again.`
        );

        // Re-send the question
        await this.sendQuestion(phoneNumber, currentQuestion);
        return;
      }

      // Store the answer
      userState.answers[currentQuestion.id] = answer;
      await this.saveWorkflowState(userState);

      // Update the database based on entity type
      try {
        if (currentQuestion.entity === "policy" && userState.policyId) {
          logger.debug(
            `Updating policy ${userState.policyId} with ${currentQuestion.id}: ${answer}`
          );

          await prisma.policy.update({
            where: { id: userState.policyId },
            data: { [currentQuestion.id]: answer },
          });

          // Also update entity store
          await entityStore.update(userState.policyId, {
            [currentQuestion.id]: answer,
          });

          logger.debug(
            `Updated policy ${userState.policyId} with ${currentQuestion.id}: ${answer}`
          );
        } else if (currentQuestion.entity === "member" && userState.memberId) {
          try {
            logger.debug(
              `Updating member ${userState.memberId} with ${currentQuestion.id}: ${answer}`
            );

            // Debug check to see the member record
            const memberBefore = await prisma.member.findUnique({
              where: { id: userState.memberId },
            });
            logger.debug(
              `Member before update: ${JSON.stringify(memberBefore)}`
            );

            // Perform the update
            await prisma.member.update({
              where: { id: userState.memberId },
              data: { [currentQuestion.id]: answer },
            });

            // Verify the update
            const memberAfter = await prisma.member.findUnique({
              where: { id: userState.memberId },
            });
            logger.debug(`Member after update: ${JSON.stringify(memberAfter)}`);

            // Update entity store
            await entityStore.update(userState.memberId, {
              [currentQuestion.id]: answer,
            });
          } catch (error: any) {
            logger.error(`Error updating member ${userState.memberId}:`, error);

            // If member doesn't exist, create a new one
            if (error.code === "P2025") {
              // Prisma record not found error
              logger.warn(
                `Member ${userState.memberId} not found, creating new member`
              );

              // Create new member with the current answer
              const memberData = {
                isPrimary: !(await this.hasPrimaryMember(userState.policyId)), // Make primary if no primary exists
                policyId: userState.policyId!,
                addedAt: new Date(),
                firstName: currentQuestion.id === "firstName" ? answer : "",
                lastName: currentQuestion.id === "lastName" ? answer : "",
                dateOfBirth: currentQuestion.id === "dateOfBirth" ? answer : "",
                gender: currentQuestion.id === "gender" ? answer : "",
                [currentQuestion.id]: answer,
              };

              const newMember = await prisma.member.create({
                data: memberData,
              });
              logger.info(
                `Created new member ${newMember.id} for policy ${userState.policyId}`
              );

              // Update user state with new member ID
              userState.memberId = newMember.id;
              await this.saveWorkflowState(userState);

              // Create entity in entity store
              const memberEntity = createEntity(
                "member",
                memberData,
                newMember.id
              );
              await entityStore.add(memberEntity);
              await entityStore.setCurrentEntity("member", memberEntity);
            } else {
              // Re-throw for other errors
              throw error;
            }
          }
        } else if (
          currentQuestion.entity === "member" &&
          !userState.memberId &&
          userState.policyId
        ) {
          // Handle case where we need to create a new member
          logger.debug(
            `Creating new member for policy ${userState.policyId} with initial data ${currentQuestion.id}: ${answer}`
          );

          // Create new member with the current answer
          const memberData = {
            isPrimary: !(await this.hasPrimaryMember(userState.policyId)), // Make primary if no primary exists
            policyId: userState.policyId,
            addedAt: new Date(),
            firstName: currentQuestion.id === "firstName" ? answer : "",
            lastName: currentQuestion.id === "lastName" ? answer : "",
            dateOfBirth: currentQuestion.id === "dateOfBirth" ? answer : "",
            gender: currentQuestion.id === "gender" ? answer : "",
            [currentQuestion.id]: answer,
          };

          const newMember = await prisma.member.create({ data: memberData });
          logger.info(
            `Created new member ${newMember.id} for policy ${userState.policyId}`
          );

          // Update user state with new member ID
          userState.memberId = newMember.id;
          await this.saveWorkflowState(userState);

          // Create entity in entity store
          const memberEntity = createEntity("member", memberData, newMember.id);
          await entityStore.add(memberEntity);
          await entityStore.setCurrentEntity("member", memberEntity);
        }
      } catch (error) {
        logger.error(`Error updating ${currentQuestion.entity}:`, error);

        // If we can't update the entity, we can still continue with the workflow
        // but log the error for debugging
        logger.error(`Continuing workflow despite entity update error`);
      }

      // Move to next question
      userState.currentQuestionIndex++;
      userState.isWaitingForResponse = false;
      await this.saveWorkflowState(userState);

      logger.debug(
        `Moving to next question. New index: ${userState.currentQuestionIndex}`
      );

      // Send next question or handle workflow completion
      if (userState.currentQuestionIndex >= workflowData.questions.length) {
        // Workflow is complete, process transitions
        logger.info(`Workflow ${workflowData.id} questions completed`);
        await this.handleWorkflowTransition(phoneNumber);
      } else {
        // Send the next question
        await this.sendNextQuestion(phoneNumber);
      }
    } catch (error) {
      logger.error(
        `Unexpected error in processUserAnswer for ${phoneNumber}:`,
        error
      );

      // Send an error message and restart the workflow
      await this.watiService.sendTextMessage(
        phoneNumber,
        "Sorry, something went wrong. Let's start over."
      );
      await this.startWorkflow(phoneNumber);
    }
  }

  // Helper method to check if a policy already has a primary member
  private async hasPrimaryMember(policyId?: string): Promise<boolean> {
    if (!policyId) return false;

    try {
      const count = await prisma.member.count({
        where: {
          policyId: policyId,
          isPrimary: true,
        },
      });

      return count > 0;
    } catch (error) {
      logger.error(`Error checking for primary member:`, error);
      return false;
    }
  }

  private async handleWorkflowTransition(phoneNumber: string): Promise<void> {
    try {
      const userState = this.userStates.get(phoneNumber);
      if (!userState || !userState.workflowId) {
        logger.error(`No user state or workflow ID found for ${phoneNumber}`);
        return;
      }

      // Special handling for merging medicalQuestionsWorkflow into memberWorkflow
      if (
        userState.workflowId === "memberWorkflow" &&
        userState.currentQuestionIndex >=
          this.getWorkflowQuestionCount("memberWorkflow")
      ) {
        logger.debug(
          `Member workflow questions completed, moving directly to medical questions`
        );

        // We've completed the member workflow questions, move to medical questions
        // without requiring a transition
        await this.moveToMedicalQuestions(phoneNumber);
        return;
      }

      // Get transitions
      const transitions = this.workflowBuilder.getWorkflowTransitions(
        userState.workflowId
      );

      logger.debug(
        `Found ${transitions?.length || 0} transitions for workflow ${
          userState.workflowId
        }`
      );

      if (!transitions || transitions.length === 0) {
        // No transitions, end conversation
        logger.warn(
          `No transitions found for workflow ${userState.workflowId}`
        );
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Thank you for completing the workflow. Your application has been submitted."
        );
        return;
      }

      // Process the first transition
      const transition = transitions[0];
      logger.debug(
        `Processing transition of type ${transition.type} for workflow ${userState.workflowId}`
      );

      switch (transition.type) {
        case "askYesNo":
          // Handle "Add another member" question
          if (transition.question?.includes("Add another member")) {
            userState.pendingTransition = "addNewMember";
            await this.saveWorkflowState(userState);
            logger.debug(
              `Set pendingTransition to addNewMember for ${phoneNumber}`
            );
          }

          // Send yes/no buttons
          await this.watiService.sendInteractiveButtonsMessage(phoneNumber, {
            body: transition.question || "Would you like to continue?",
            buttons: [{ text: "Yes" }, { text: "No" }],
          });

          userState.isWaitingForResponse = true;
          await this.saveWorkflowState(userState);
          logger.debug(
            `Sent yes/no question for transition: ${transition.question}`
          );
          break;

        case "auto":
          logger.debug(
            `Processing auto transition with action: ${transition.action}`
          );
          // Handle auto transition
          if (transition.action === "createEntity" && transition.nextWorkflow) {
            // Create entity based on type
            if (transition.entityType === "member" && userState.policyId) {
              try {
                // Create member in database
                const memberData = {
                  isPrimary: true,
                  policyId: userState.policyId,
                  addedAt: new Date(),
                  firstName: "", // Will be filled in by workflow
                  lastName: "", // Will be filled in by workflow
                  dateOfBirth: "", // Will be filled in by workflow
                  gender: "", // Will be filled in by workflow
                  ...transition.data, // Spread any additional data from the transition
                };

                const member = await prisma.member.create({ data: memberData });
                logger.debug(
                  `Created new member entity ${member.id} for policy ${userState.policyId}`
                );

                // Update user state
                userState.memberId = member.id;
                await this.saveWorkflowState(userState);

                // Create entity in entity store
                const memberEntity = createEntity(
                  "member",
                  memberData,
                  member.id
                );
                await entityStore.add(memberEntity);
                await entityStore.setCurrentEntity("member", memberEntity);
              } catch (error) {
                logger.error(`Error creating member entity:`, error);
              }
            }

            // Move to next workflow
            logger.debug(
              `Auto transition to next workflow: ${transition.nextWorkflow}`
            );
            await this.transitionToNextWorkflow(
              phoneNumber,
              transition.nextWorkflow
            );
          } else if (
            transition.action === "calculatePolicyPrice" &&
            userState.policyId
          ) {
            // Calculate price
            logger.debug(`Calculating policy price for ${userState.policyId}`);
            await this.calculatePolicyPrice(phoneNumber, userState.policyId);

            // Move to next workflow if specified
            if (transition.nextWorkflow) {
              logger.debug(
                `Transitioning to next workflow after price calculation: ${transition.nextWorkflow}`
              );
              await this.transitionToNextWorkflow(
                phoneNumber,
                transition.nextWorkflow
              );
            }
          } else if (transition.action === "payment.processPayment") {
            // Handle payment processing
            logger.debug(`Processing payment for policy ${userState.policyId}`);
            if (userState.policyId) {
              const policy = await prisma.policy.findUnique({
                where: { id: userState.policyId },
              });

              if (policy && policy.paymentMethod === "PayPal") {
                await this.processPayPalPayment(
                  phoneNumber,
                  userState.policyId
                );
              }
            }

            // Move to next workflow if specified
            if (transition.nextWorkflow) {
              logger.debug(
                `Transitioning to next workflow after payment: ${transition.nextWorkflow}`
              );
              await this.transitionToNextWorkflow(
                phoneNumber,
                transition.nextWorkflow
              );
            }
          } else if (transition.action === "applyPromoCode") {
            // Apply promo code
            logger.debug(
              `Applying promo code for policy ${userState.policyId}`
            );
            if (userState.policyId) {
              await this.applyPromoCode(phoneNumber, userState.policyId);
            }

            // Move to next workflow if specified
            if (transition.nextWorkflow) {
              logger.debug(
                `Transitioning to next workflow after promo code: ${transition.nextWorkflow}`
              );
              await this.transitionToNextWorkflow(
                phoneNumber,
                transition.nextWorkflow
              );
            }
          } else if (transition.action === "finalizeApplication") {
            // Send completion message
            logger.debug(`Finalizing application for ${phoneNumber}`);
            await this.watiService.sendTextMessage(
              phoneNumber,
              "Thank you for completing your insurance application! Your policy details will be processed, and you will receive a confirmation shortly."
            );

            // If policy ID exists, mark as completed
            if (userState.policyId) {
              await prisma.policy.update({
                where: { id: userState.policyId },
                data: {
                  isCompleted: true,
                  updatedAt: new Date(),
                },
              });
              logger.debug(`Marked policy ${userState.policyId} as completed`);

              // Send policy summary
              try {
                await this.watiService.sendApplicationSummary(
                  phoneNumber,
                  userState.policyId
                );
                logger.debug(
                  `Sent application summary for policy ${userState.policyId}`
                );

                // Log policy data if payment was made with promo code or PayPal
                const policy = await prisma.policy.findUnique({
                  where: { id: userState.policyId },
                });

                if (
                  policy &&
                  (policy.paymentStatus === "COMPLETED" || policy.discountRate)
                ) {
                  await this.handlePaymentCompletion(
                    phoneNumber,
                    userState.policyId
                  );
                }
              } catch (error) {
                logger.error(`Error sending policy summary:`, error);
              }
            }
          } else if (transition.action === "completePolicy") {
            // Handle completePolicy action (after no more members)
            logger.debug(`Handling completePolicy action for ${phoneNumber}`);

            // Move to the next workflow
            if (transition.nextWorkflow) {
              await this.transitionToNextWorkflow(
                phoneNumber,
                transition.nextWorkflow
              );
            }
          } else {
            // If no specific action matched but there's a next workflow, transition to it
            if (transition.nextWorkflow) {
              logger.debug(
                `Default auto transition to: ${transition.nextWorkflow}`
              );
              await this.transitionToNextWorkflow(
                phoneNumber,
                transition.nextWorkflow
              );
            } else {
              logger.warn(
                `Auto transition with no recognized action or nextWorkflow: ${JSON.stringify(
                  transition
                )}`
              );
            }
          }
          break;

        case "conditional":
          // Handle conditional transition
          if (transition.condition && transition.condition.field) {
            const fieldValue = userState.answers[transition.condition.field];
            let conditionMet = false;
            logger.debug(
              `Evaluating condition on field ${transition.condition.field} with value ${fieldValue}`
            );

            // Evaluate condition
            if (transition.condition.equals !== undefined) {
              conditionMet = fieldValue === transition.condition.equals;
              logger.debug(
                `Condition equals check: ${fieldValue} === ${transition.condition.equals} is ${conditionMet}`
              );
            } else if (transition.condition.notEquals !== undefined) {
              conditionMet = fieldValue !== transition.condition.notEquals;
              logger.debug(
                `Condition notEquals check: ${fieldValue} !== ${transition.condition.notEquals} is ${conditionMet}`
              );
            } else if (transition.condition.in !== undefined) {
              conditionMet = transition.condition.in.includes(fieldValue);
              logger.debug(
                `Condition in check: ${transition.condition.in} includes ${fieldValue} is ${conditionMet}`
              );
            }

            // Choose action based on condition result
            const nextAction = conditionMet
              ? transition.onTrue
              : transition.onFalse;

            logger.debug(
              `Condition met: ${conditionMet}, using ${
                conditionMet ? "onTrue" : "onFalse"
              } action`
            );

            if (nextAction) {
              logger.debug(
                `Next action: ${nextAction.action}, nextWorkflow: ${nextAction.nextWorkflow}`
              );
              // Handle price calculation
              if (
                nextAction.action === "calculatePolicyPrice" &&
                userState.policyId
              ) {
                await this.calculatePolicyPrice(
                  phoneNumber,
                  userState.policyId
                );
              } else if (nextAction.action === "payment.processPayment") {
                // Handle payment processing
                if (userState.policyId) {
                  const policy = await prisma.policy.findUnique({
                    where: { id: userState.policyId },
                  });

                  if (policy && policy.paymentMethod === "PayPal") {
                    await this.processPayPalPayment(
                      phoneNumber,
                      userState.policyId
                    );
                  }
                }
              } else if (nextAction.action === "askPromoCode") {
                // Handle promo code request
                // Move to next workflow first
                if (nextAction.nextWorkflow) {
                  await this.transitionToNextWorkflow(
                    phoneNumber,
                    nextAction.nextWorkflow
                  );
                }
              } else if (nextAction.action === "showMenu") {
                // Handle showing a menu for restarting
                await this.watiService.sendTextMessage(
                  phoneNumber,
                  "Would you like to make changes to your application?"
                );

                // Send options
                await this.watiService.sendInteractiveButtonsMessage(
                  phoneNumber,
                  {
                    body: "What would you like to do?",
                    buttons: [
                      { text: "Continue with application" },
                      { text: "Start over" },
                    ],
                  }
                );

                userState.pendingTransition = "menuChoice";
                await this.saveWorkflowState(userState);
                return;
              }

              // Move to next workflow if specified and not already handled
              if (
                nextAction.nextWorkflow &&
                nextAction.action !== "askPromoCode" &&
                nextAction.action !== "showMenu"
              ) {
                logger.debug(
                  `Transitioning to next workflow: ${nextAction.nextWorkflow}`
                );
                await this.transitionToNextWorkflow(
                  phoneNumber,
                  nextAction.nextWorkflow
                );
              }
            } else {
              logger.warn(
                `No nextAction found for condition result: ${conditionMet}`
              );
            }
          } else {
            logger.warn(
              `Conditional transition missing condition field: ${JSON.stringify(
                transition
              )}`
            );
          }
          break;

        default:
          logger.warn(`Unhandled transition type: ${transition.type}`);
          // For unhandled transition types, move to finalizeWorkflow
          await this.transitionToNextWorkflow(phoneNumber, "finalizeWorkflow");
      }
    } catch (error) {
      logger.error(
        `Error handling workflow transition for ${phoneNumber}:`,
        error
      );

      try {
        // Get the user state again to make sure we have the latest
        const userState = this.userStates.get(phoneNumber);

        if (userState && userState.workflowId === "memberWorkflow") {
          // We know this is where the issue is happening - move to medical questions
          await this.moveToMedicalQuestions(phoneNumber);
        } else {
          // For other workflows, provide a more generic recovery
          await this.watiService.sendTextMessage(
            phoneNumber,
            "Sorry, we encountered an issue with your application. Let's continue with the next section."
          );

          // Try to move to next logical workflow based on current workflow
          const nextWorkflow = this.determineNextWorkflow(
            userState?.workflowId
          );
          if (nextWorkflow) {
            await this.transitionToNextWorkflow(phoneNumber, nextWorkflow);
          }
        }
      } catch (recoveryError) {
        logger.error(`Failed to recover from transition error:`, recoveryError);
      }
    }
  }

  // Add this new method to handle the merged workflow logic
  private async moveToMedicalQuestions(phoneNumber: string): Promise<void> {
    logger.info(`Moving ${phoneNumber} to medical questions`);

    const userState = this.userStates.get(phoneNumber);
    if (!userState) return;

    // Keep the same member ID, but move to medical questions by loading them inline
    await this.watiService.sendTextMessage(
      phoneNumber,
      "Now, let's continue with some medical questions."
    );

    // Load the medical questions workflow data
    const medicalWorkflowData = this.workflowBuilder.buildWorkflow(
      "medicalQuestionsWorkflow"
    );
    if (!medicalWorkflowData) {
      logger.error(`Could not load medical questions workflow`);
      return;
    }

    // Update the state to use the medical questions
    userState.workflowId = "medicalQuestionsWorkflow";
    userState.currentQuestionIndex = 0;
    userState.workflowHistory.push("medicalQuestionsWorkflow");
    userState.isWaitingForResponse = false;
    await this.saveWorkflowState(userState);

    // Send the first medical question
    await this.sendNextQuestion(phoneNumber);
  }

  private determineNextWorkflow(currentWorkflow?: string | null): string {
    if (!currentWorkflow) return "policyWorkflow";

    const workflowSequence = [
      "policyWorkflow",
      "memberWorkflow",
      "medicalQuestionsWorkflow",
      "summaryWorkflow",
      "paymentWorkflow",
      "promoCodeWorkflow",
      "finalizeWorkflow",
    ];

    const currentIndex = workflowSequence.indexOf(currentWorkflow);
    if (currentIndex === -1 || currentIndex === workflowSequence.length - 1) {
      return "finalizeWorkflow";
    }

    return workflowSequence[currentIndex + 1];
  }

  private async calculatePolicyPrice(
    phoneNumber: string,
    policyId?: string
  ): Promise<void> {
    if (!policyId) return;

    try {
      // Calculate price using PayPal service
      const price = await this.paypalService.calculatePolicyPrice(policyId);

      // Update policy in database
      await prisma.policy.update({
        where: { id: policyId },
        data: {
          totalPrice: price,
          calculatedAt: new Date(),
        },
      });

      // Get member count
      const memberCount = await prisma.member.count({
        where: { policyId },
      });

      // Update entity store
      await entityStore.update(policyId, {
        totalPrice: price,
        calculatedAt: new Date().toISOString(),
        memberCount,
      });

      // Send price notification
      await this.watiService.sendTextMessage(
        phoneNumber,
        `Your policy price has been calculated: $${price.toFixed(2)}`
      );

      logger.info(
        `Calculated policy price for ${policyId}: $${price.toFixed(2)}`
      );
    } catch (error) {
      logger.error(`Error calculating policy price:`, error);
    }
  }

  private async processPayPalPayment(
    phoneNumber: string,
    policyId?: string
  ): Promise<void> {
    if (!policyId) return;

    try {
      // Create a user ID for PayPal
      const userId = `user-${Math.random().toString(36).substring(2, 9)}`;

      // Get policy price
      const price = await this.paypalService.calculatePolicyPrice(policyId);

      // Create payment request
      const paymentRequest = {
        userId,
        amount: price,
        description: "Insurance Policy Payment",
        policyId,
        currency: "USD",
      };

      // Create PayPal payment
      const payment = await this.paypalService.createPayment(paymentRequest);

      // Send payment link
      await this.paypalService.displayPaymentLink(payment, phoneNumber);

      logger.info(
        `Created PayPal payment for policy ${policyId}: ${payment.id}`
      );
    } catch (error) {
      logger.error(`Error processing PayPal payment:`, error);

      // Send error message
      await this.watiService.sendTextMessage(
        phoneNumber,
        "Sorry, there was an error processing your payment. Please try again later or contact customer support."
      );
    }
  }

  private async transitionToNextWorkflow(
    phoneNumber: string,
    nextWorkflowId: string
  ): Promise<void> {
    const userState = this.userStates.get(phoneNumber);
    if (!userState) return;

    // Reset state for new workflow
    userState.workflowId = nextWorkflowId;
    userState.currentQuestionIndex = 0;
    userState.workflowHistory.push(nextWorkflowId);
    userState.isWaitingForResponse = false;
    userState.pendingTransition = null;
    await this.saveWorkflowState(userState);

    // Get workflow name for introduction message
    const workflow = this.workflowBuilder.getWorkflow(nextWorkflowId);

    if (workflow) {
      await this.watiService.sendTextMessage(
        phoneNumber,
        `Moving to ${workflow.name} section...`
      );
    }

    // Send the first question of the new workflow
    await this.sendNextQuestion(phoneNumber);
  }

  async sendNextQuestion(phoneNumber: string): Promise<void> {
    const userState = this.userStates.get(phoneNumber);
    if (!userState || !userState.workflowId) return;

    const workflowData = this.workflowBuilder.buildWorkflow(
      userState.workflowId
    );
    if (!workflowData) {
      logger.error(`Workflow ${userState.workflowId} not found`);
      return;
    }

    // Check if we still have questions
    if (userState.currentQuestionIndex >= workflowData.questions.length) {
      // No more questions, handle workflow transition
      await this.handleWorkflowTransition(phoneNumber);
      return;
    }

    // Get the next question
    const nextQuestion = workflowData.questions[userState.currentQuestionIndex];

    // Check if question should be skipped
    const skipContext = {
      currentEntityType: nextQuestion.entity,
      userAnswers: userState.answers,
    };

    if (nextQuestion.skip(skipContext)) {
      // Skip this question and move to the next one
      userState.currentQuestionIndex++;
      await this.saveWorkflowState(userState);
      await this.sendNextQuestion(phoneNumber);
      return;
    }

    // Send the question
    await this.sendQuestion(phoneNumber, nextQuestion);
    userState.isWaitingForResponse = true;
    await this.saveWorkflowState(userState);
  }

  private async sendQuestion(
    phoneNumber: string,
    question: QuestionWithLogic
  ): Promise<void> {
    if (question.options && question.options.length > 0) {
      // Question with multiple choice options
      if (question.options.length <= 3) {
        // Use buttons for up to 3 options
        await this.watiService.sendInteractiveButtonsMessage(phoneNumber, {
          body: question.text,
          buttons: question.options.map((option) => ({ text: option })),
        });
      } else {
        // Use list for more than 3 options
        const options = question.options.map((option) => ({
          title: option,
          description: "",
        }));

        await this.watiService.sendInteractiveListMessage(
          phoneNumber,
          "Choose an option",
          question.text,
          "Please select one of the following options:",
          "Select",
          options
        );
      }
    } else {
      // Simple text question
      await this.watiService.sendTextMessage(phoneNumber, question.text);
    }
  }

  async handleWebhookEvent(event: any): Promise<void> {
    // Determine if this is an incoming regular text message
    if (
      event.eventType === "message" &&
      event.text &&
      event.waId &&
      event.type === "text"
    ) {
      const phoneNumber = event.waId;
      const message = event.text;

      logger.info(`Received text message from ${phoneNumber}: ${message}`);

      // Process the incoming message
      await this.processIncomingMessage(phoneNumber, message);
      return;
    }

    // Handle button responses
    if (event.eventType === "buttonResponse" && event.waId) {
      const phoneNumber = event.waId;
      const buttonText = event.text || event.buttonText;

      logger.info(
        `Received button response from ${phoneNumber}: ${buttonText}`
      );

      // Process the button response
      await this.processIncomingMessage(phoneNumber, buttonText);
      return;
    }

    // Handle interactive button responses
    if (
      event.eventType === "message" &&
      event.type === "interactive" &&
      event.interactiveButtonReply &&
      event.waId
    ) {
      const phoneNumber = event.waId;
      const buttonText = event.interactiveButtonReply.title;

      logger.info(
        `Received interactive button response from ${phoneNumber}: ${buttonText}`
      );

      // Process the interactive button response
      await this.processIncomingMessage(phoneNumber, buttonText);
      return;
    }

    // Handle interactive list responses
    if (
      event.eventType === "message" &&
      event.type === "interactive" &&
      event.listReply &&
      event.waId
    ) {
      const phoneNumber = event.waId;
      const selectedOption = event.listReply.title;

      logger.info(
        `Received list response from ${phoneNumber}: ${selectedOption}`
      );

      // Process the list selection
      await this.processIncomingMessage(phoneNumber, selectedOption);
      return;
    }

    // Log other events
    logger.info(`Received webhook event of type ${event.eventType}`);
  }
  public async handlePaymentCompletion(
    phoneNumber: string,
    policyId: string
  ): Promise<void> {
    try {
      // Retrieve the complete policy with members
      const policy = await prisma.policy.findUnique({
        where: { id: policyId },
        include: { members: true },
      });

      if (!policy) {
        logger.error(`Policy not found: ${policyId}`);
        return;
      }

      // Get the primary member
      const primaryMember =
        policy.members.find((m) => m.isPrimary) || policy.members[0];

      if (!primaryMember) {
        logger.error(`No members found for policy: ${policyId}`);
        return;
      }

      // Format data for output and API calls
      const outputData = {
        memberDetails: {
          firstName: primaryMember.firstName,
          lastName: primaryMember.lastName,
          dateOfBirth: primaryMember.dateOfBirth,
          gender: primaryMember.gender,
          houseNumber: primaryMember.houseNumber,
          streetNumber: primaryMember.streetNumber,
          city: primaryMember.city,
          state: primaryMember.state,
          zipCode: primaryMember.zipCode,
          country: primaryMember.country,
          mobileNumber: primaryMember.mobileNumber,
          email: primaryMember.email,
          passportNumber: primaryMember.passportNumber,
          placeOfIssue: primaryMember.placeOfIssue,
          passportExpiry: primaryMember.passportExpiry,
          issuingCountry: primaryMember.issuingCountry,
          phoneNumber: primaryMember.phoneNumber || primaryMember.mobileNumber,
          preExistingCondition: primaryMember.preExistingCondition,
          onMedicalTreatment: primaryMember.onMedicalTreatment === "Yes",
          isSmoker: primaryMember.isSmoker === "Yes",
          alcoholConsumption: primaryMember.alcoholConsumption,
          isPregnant: primaryMember.isPregnant === "Yes",
          hasSexuallyTransmittedDisease:
            primaryMember.hasSexuallyTransmittedDisease === "Yes",
          hasOtherInsurance: policy.hasOtherInsurance === "Yes",
          travelingAgainstMedicalAdvice:
            primaryMember.travelingAgainstMedicalAdvice === "Yes",
          hasMentalHealthIssues: primaryMember.hasMentalHealthIssues === "Yes",
          wasHospitalized: primaryMember.wasHospitalized === "Yes",
        },
        policyDetails: {
          productType: "Travel Insurance",
          policyPeriod: policy.policyPeriod,
          ticketVesselNumber: policy.ticketVesselNumber,
          arrivalDate: policy.arrivalDate,
          flightNumber: policy.flightNumber,
          airline: policy.airline,
          flightFrom: policy.flightFrom,
          paymentMethod: policy.paymentMethod,
          promoCode: policy.promoCode,
          sessionId: `session_${Math.random().toString(36).slice(2)}`,
          isCompleted: true,
          crtd_Dt: policy.createdAt?.toISOString(),
          lst_Updt_Dt: policy.updatedAt?.toISOString(),
        },
      };

      // Log the data in the required format
      console.log("🔵 PAYMENT CONFIRMED - POLICY DATA 🔵");
      console.log(JSON.stringify(outputData, null, 2));
      logger.info(`Payment confirmed for policy ${policyId}. Data logged.`);

      // Import policy API service
      const { policyApiService } = require("../services/policy-api-service");

      // Call the policy issuance API
      try {
        const policyNumber = await policyApiService.issuePolicyFromPaymentData(
          outputData
        );

        if (policyNumber) {
          logger.info(
            `Successfully issued policy number: ${policyNumber} for policy ${policyId}`
          );

          // Update our database with the policy number
          await prisma.policy.update({
            where: { id: policyId },
            data: {
              policyNumber: policyNumber,
              policyIssuedAt: new Date(),
            },
          });

          // Now generate and send the policy letter
          const email = primaryMember.email;
          const name =
            `${primaryMember.firstName} ${primaryMember.lastName}`.trim();

          if (email) {
            const letterSent = await policyApiService.generatePolicyLetter(
              policyNumber,
              email,
              name
            );

            if (letterSent) {
              logger.info(
                `Policy letter sent successfully to ${email} for policy ${policyNumber}`
              );

              // Send a WhatsApp message about the policy being issued
              await this.watiService.sendTextMessage(
                phoneNumber,
                `🎉 Congratulations! Your insurance policy has been issued.\n\nPolicy Number: ${policyNumber}\n\nA copy of your policy has been sent to your email address: ${email}\n\nThank you for choosing our insurance services!`
              );
            } else {
              logger.error(
                `Failed to send policy letter for policy ${policyNumber}`
              );

              // Send a notification about the policy but mention email issue
              await this.watiService.sendTextMessage(
                phoneNumber,
                `Your insurance policy has been issued with policy number: ${policyNumber}.\n\nHowever, we couldn't send the policy document to your email. Please contact customer support for assistance.`
              );
            }
          } else {
            logger.warn(
              `Cannot send policy letter - no email found for policy ${policyId}`
            );

            // Send a notification about the policy without email
            await this.watiService.sendTextMessage(
              phoneNumber,
              `Your insurance policy has been issued with policy number: ${policyNumber}.\n\nSince we don't have your email address, please contact customer support to receive your policy document.`
            );
          }
        } else {
          logger.error(`Failed to issue policy for ${policyId}`);

          // Send an error message to the customer
          await this.watiService.sendTextMessage(
            phoneNumber,
            "We've received your payment and your application is being processed. However, there was a delay in generating your policy number. Our team has been notified and will assist you shortly."
          );
        }
      } catch (apiError) {
        logger.error(`Error calling policy APIs:`, apiError);

        // Send a message about the processing delay
        await this.watiService.sendTextMessage(
          phoneNumber,
          "Thank you for your payment! Your insurance application is being processed. You'll receive your policy details shortly."
        );
      }
    } catch (error) {
      logger.error(`Error handling payment completion: ${error}`);
    }
  }
  // Add this function to handle promo code application
  private async applyPromoCode(
    phoneNumber: string,
    policyId: string
  ): Promise<void> {
    try {
      // Get the policy
      const policy = await prisma.policy.findUnique({
        where: { id: policyId },
      });

      if (!policy || !policy.promoCode) return;

      // Apply discount based on promo code
      let discountRate = 0;

      // Simple promo code logic - can be expanded
      if (policy.promoCode === "TRAVEL25") {
        discountRate = 0.25; // 25% discount
      } else if (policy.promoCode === "TRAVEL10") {
        discountRate = 0.1; // 10% discount
      } else if (policy.promoCode === "WELCOME") {
        discountRate = 0.15; // 15% discount
      }

      // Update policy with discount
      await prisma.policy.update({
        where: { id: policyId },
        data: {
          discountRate,
          paymentStatus: "APPROVED", // Auto-approve with promo code
          paymentCompletedAt: new Date(),
        },
      });

      // Recalculate the price
      const price = await this.paypalService.calculatePolicyPrice(policyId);

      // Send message about discount
      if (discountRate > 0) {
        await this.watiService.sendTextMessage(
          phoneNumber,
          `Your promo code has been applied! You've received a ${
            discountRate * 100
          }% discount. Your total is now $${price.toFixed(2)}.`
        );
      } else {
        await this.watiService.sendTextMessage(
          phoneNumber,
          `The promo code you entered is invalid or expired. No discount has been applied. Your total remains $${price.toFixed(
            2
          )}.`
        );
      }

      // Log policy data (same as payment completion)
      await this.handlePaymentCompletion(phoneNumber, policyId);
    } catch (error) {
      logger.error(`Error applying promo code: ${error}`);
    }
  }
}
