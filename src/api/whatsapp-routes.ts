import express from "express";
import { getWhatsAppIntegration } from "../whatsapp/whatsapp-integration";
import { logger } from "../core/logger";

export const whatsappRouter = express.Router();

/**
 * Webhook endpoint to receive WhatsApp events from WATI
 * POST /api/webhook
 */
whatsappRouter.post("/", async (req, res) => {
  try {
    const webhookData = req.body;

    // Get WhatsApp integration
    const whatsAppIntegration = getWhatsAppIntegration();

    // Process the webhook event
    await whatsAppIntegration.processWebhookEvent(webhookData);

    // Return success response
    res.status(200).json({
      success: true,
      message: "Webhook data processed successfully",
    });
  } catch (error: any) {
    logger.error("Error processing webhook data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error processing webhook data",
      error: error.message,
    });
  }
});

/**
 * Start a new conversation with a WhatsApp user
 * POST /api/whatsapp/start
 */
whatsappRouter.post("/start", async (req, res) => {
  try {
    const { phoneNumber, workflowId, userName } = req.body;

    // Validate request
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Format phone number if needed
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    // Get the WhatsApp integration
    const whatsAppIntegration = getWhatsAppIntegration();

    // Send welcome message if userName is provided
    // CHOOSE ONE APPROACH:

    // APPROACH 1: Modified to use skipWelcomeMessage parameter
    if (userName) {
      // Send custom welcome with user's name
      await whatsAppIntegration.sendWelcomeMessage(
        formattedPhoneNumber,
        userName
      );
      // Then start workflow but skip its default welcome message
      await whatsAppIntegration.startWorkflow(
        formattedPhoneNumber,
        workflowId || "policyWorkflow",
        true // Skip the default welcome message
      );
    } else {
      // No userName, just start workflow with its default welcome
      await whatsAppIntegration.startWorkflow(
        formattedPhoneNumber,
        workflowId || "policyWorkflow"
      );
    }

    // APPROACH 2: Remove the separate welcome message entirely
    // Just uncomment the line below and comment out the APPROACH 1 block above
    /*
    // Start workflow (which will send its own welcome message)
    await whatsAppIntegration.startWorkflow(
      formattedPhoneNumber,
      workflowId || "policyWorkflow"
    );
    */

    // Return success response
    res.status(200).json({
      success: true,
      message: "Conversation started successfully",
      data: {
        phoneNumber: formattedPhoneNumber,
        workflowId: workflowId || "policyWorkflow",
      },
    });
  } catch (error: any) {
    logger.error("Error starting conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start conversation",
      error: error.message,
    });
  }
});

/**
 * Format phone number to ensure it's valid for WhatsApp API
 * - Removes spaces, dashes, and parentheses
 * - Ensures it has a country code (defaults to +1 if none)
 */
function formatPhoneNumber(phoneNumber: string): string {
  // Remove spaces, dashes, parentheses, and other non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, "");

  // If the number doesn't start with a plus sign, add it
  if (!phoneNumber.startsWith("+")) {
    // If no country code, assume US (+1)
    if (cleaned.length === 10) {
      cleaned = "1" + cleaned;
    }
    cleaned = "+" + cleaned;
  }

  return cleaned;
}
