import { WorkflowBuilder } from "../workflow/workflow-builder";
import { WatiService } from "../services/wati-service";
import { WhatsAppWorkflowHandler } from "./whatsapp-workflow-handler";
import { logger } from "../core/logger";
import * as fs from "fs";
import * as path from "path";
import { entityStore } from "../core/entity-store";

export class WhatsAppIntegration {
  private workflowBuilder: WorkflowBuilder;
  private watiService: WatiService;
  private workflowHandler: WhatsAppWorkflowHandler;

  constructor() {
    // Create core components
    this.workflowBuilder = new WorkflowBuilder();
    this.watiService = new WatiService(entityStore);

    // Load workflow configuration
    this.loadConfigurationData();

    // Create the workflow handler
    this.workflowHandler = new WhatsAppWorkflowHandler(
      this.watiService,
      this.workflowBuilder
    );

    logger.info("WhatsApp integration initialized");
  }

  /**
   * Load workflow and question configurations from JSON files
   */
  private loadConfigurationData(): void {
    try {
      // Use the exact locations provided
      const questionsPath = path.resolve(
        process.cwd(),
        "./src/config/questions.json"
      );
      const workflowsPath = path.resolve(
        process.cwd(),
        "./src/config/workflows.json"
      );

      let questionsData: any = [];
      let workflowsData: any = [];

      // Try to load questions
      if (fs.existsSync(questionsPath)) {
        const questionsJson = fs.readFileSync(questionsPath, "utf-8");
        questionsData = JSON.parse(questionsJson).questions;
      } else {
        logger.error("Questions file not found at: " + questionsPath);
        return;
      }

      // Try to load workflows
      if (fs.existsSync(workflowsPath)) {
        const workflowsJson = fs.readFileSync(workflowsPath, "utf-8");
        workflowsData = JSON.parse(workflowsJson).workflows;
      } else {
        logger.error("Workflows file not found at: " + workflowsPath);
        return;
      }

      // Register questions and workflows
      this.workflowBuilder.registerQuestions(questionsData);
      this.workflowBuilder.registerWorkflows(workflowsData);

      logger.info(
        `Loaded ${questionsData.length} questions and ${workflowsData.length} workflows for WhatsApp integration`
      );
    } catch (error) {
      logger.error(
        "Error loading configuration data for WhatsApp integration:",
        error
      );
    }
  }

  /**
   * Start a new workflow for a WhatsApp user
   */
  async startWorkflow(
    phoneNumber: string,
    workflowId: string = "policyWorkflow",
    skipWelcomeMessage: boolean = false // Add this parameter
  ): Promise<void> {
    await this.workflowHandler.startWorkflow(
      phoneNumber,
      workflowId,
      skipWelcomeMessage
    );
  }

  /**
   * Process a webhook event from WATI
   */
  async processWebhookEvent(event: any): Promise<void> {
    await this.workflowHandler.handleWebhookEvent(event);
  }

  /**
   * Send a welcome message to a new user
   */
  async sendWelcomeMessage(
    phoneNumber: string,
    userName: string = "Customer"
  ): Promise<void> {
    try {
      await this.watiService.sendTextMessage(
        phoneNumber,
        `Welcome, ${userName}! 👋\n\nThank you for using our Insurance Application System. I'll guide you through the process of creating an insurance policy. Let's get started!`
      );
    } catch (error) {
      logger.error(`Error sending welcome message to ${phoneNumber}:`, error);
    }
  }

  /**
   * Get the workflow handler instance
   */
  getWorkflowHandler(): WhatsAppWorkflowHandler {
    return this.workflowHandler;
  }

  /**
   * Get the WATI service instance
   */
  getWatiService(): WatiService {
    return this.watiService;
  }
}

/**
 * Create and return a WhatsApp integration singleton
 */
let whatsAppIntegration: WhatsAppIntegration | null = null;

export function getWhatsAppIntegration(): WhatsAppIntegration {
  if (!whatsAppIntegration) {
    whatsAppIntegration = new WhatsAppIntegration();
  }
  return whatsAppIntegration;
}
