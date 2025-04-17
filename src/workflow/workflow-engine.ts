import {
  EntityId,
  QuestionWithLogic,
  ValidationContext,
  WorkflowData,
} from "../core/types";
import { createEntity } from "../core/entity-store";
import { logger } from "../core/logger";
import { entityStore } from "../core/entity-store";
import { prisma } from "../core/prisma-client";
import { v4 as uuidv4 } from "uuid";

export class WorkflowEngine {
  async processQuestion(
    workflowData: WorkflowData,
    questionIndex: number,
    answer: string,
    policyId?: EntityId,
    memberId?: EntityId
  ): Promise<{
    isValid: boolean;
    errorMessage?: string;
    nextQuestionIndex: number;
    isComplete: boolean;
    entityId?: EntityId;
  }> {
    if (!workflowData || questionIndex >= workflowData.questions.length) {
      return {
        isValid: false,
        errorMessage: "Invalid question index",
        nextQuestionIndex: questionIndex,
        isComplete: true,
      };
    }

    // Get current question
    const question = workflowData.questions[questionIndex];

    // Build validation context
    const validationContext: ValidationContext = {
      currentEntityType: question.entity,
      userAnswers: {}, // We're handling one question at a time, so answers are less important here
    };

    // Validate answer
    const validationResult = question.validation(answer, validationContext);
    if (!validationResult.isValid) {
      return {
        isValid: false,
        errorMessage: validationResult.message,
        nextQuestionIndex: questionIndex,
        isComplete: false,
      };
    }

    // Process the answer based on entity type
    let entityId: EntityId | null = null;

    try {
      // Handle policy entity
      if (question.entity === "policy") {
        if (policyId) {
          // Update policy
          await prisma.policy.update({
            where: { id: policyId },
            data: { [question.id]: answer },
          });

          // Update entity in store
          await entityStore.update(policyId, { [question.id]: answer });
          entityId = policyId;
        } else {
          // Create new policy
          const policy = await prisma.policy.create({
            data: {
              whatsappNumber: `temp_${uuidv4()}`,
              createdAt: new Date(),
              isCompleted: false,
              [question.id]: answer,
            },
          });
          entityId = policy.id;

          // Create entity in store
          const policyEntity = createEntity(
            "policy",
            {
              createdAt: new Date().toISOString(),
              isCompleted: false,
              [question.id]: answer,
            },
            entityId
          );
          await entityStore.add(policyEntity);
        }
      }
      // Handle member entity
      else if (question.entity === "member") {
        if (memberId) {
          // Update member
          await prisma.member.update({
            where: { id: memberId },
            data: { [question.id]: answer },
          });

          // Update entity in store
          await entityStore.update(memberId, { [question.id]: answer });
          entityId = memberId;
        } else if (policyId) {
          // Create new member
          const member = await prisma.member.create({
            data: {
              isPrimary: true,
              policyId,
              firstName: "",
              lastName: "",
              dateOfBirth: "",
              gender: "",
              addedAt: new Date(),
              [question.id]: answer,
            },
          });
          entityId = member.id;

          // Create entity in store
          const memberEntity = createEntity(
            "member",
            {
              isPrimary: true,
              policyId,
              addedAt: new Date().toISOString(),
              [question.id]: answer,
            },
            entityId
          );
          await entityStore.add(memberEntity);
        }
      }
    } catch (error) {
      logger.error(`Error processing entity action:`, error);
      return {
        isValid: false,
        errorMessage: "Error processing your answer, please try again.",
        nextQuestionIndex: questionIndex,
        isComplete: false,
      };
    }

    // Determine next question index
    const nextQuestionIndex = questionIndex + 1;
    const isComplete = nextQuestionIndex >= workflowData.questions.length;

    return {
      isValid: true,
      nextQuestionIndex,
      isComplete,
      entityId: entityId || undefined, // Ensure entityId is either a string or undefined
    };
  }

  async skipQuestion(
    workflowData: WorkflowData,
    questionIndex: number,
    userAnswers: Record<string, string>
  ): Promise<boolean> {
    if (!workflowData || questionIndex >= workflowData.questions.length) {
      return false;
    }

    // Get current question
    const question = workflowData.questions[questionIndex];

    // Build validation context
    const validationContext: ValidationContext = {
      currentEntityType: question.entity,
      userAnswers,
    };

    // Check if question should be skipped
    return question.skip(validationContext);
  }
}
