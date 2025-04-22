// Update the src/api/server.ts file to include promo code routes

import express from "express";
import { logger } from "../core/logger";
import { whatsappRouter } from "./whatsapp-routes";
import { paymentRouter } from "./payment-routes";
import { promoCodeRouter } from "./promo-code-routes"; // Add this import
import env from "../config/env";

export function startServer(port: number = env.port): void {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Mount API routes
  app.use("/api/webhook", whatsappRouter);
  app.use("/api/payment", paymentRouter);
  app.use("/api/promo-codes", promoCodeRouter); // Add this line

  // Phone number endpoint for starting conversations
  app.post("/api/phone", async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      logger.warn("Phone number endpoint called without a phone number");
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Log the phone number to the console
    console.log(`Received phone number: ${phoneNumber}`);
    logger.info(`Received phone number: ${phoneNumber}`);

    try {
      // Get the WhatsApp integration
      const {
        getWhatsAppIntegration,
      } = require("../whatsapp/whatsapp-integration");
      const whatsAppIntegration = getWhatsAppIntegration();
      const watiService = whatsAppIntegration.getWatiService();

      // Try to send a welcome message
      await watiService.sendTextMessage(
        phoneNumber,
        "Welcome to our Insurance Application System! I'll help you get started with your insurance policy."
      );

      // Also start the workflow for this phone number
      try {
        await whatsAppIntegration.startWorkflow(phoneNumber, "policyWorkflow");
        logger.info(`Started workflow for ${phoneNumber}`);
      } catch (workflowError) {
        logger.error(
          `Error starting workflow for ${phoneNumber}:`,
          workflowError
        );
      }

      // Return success response
      res.status(200).json({
        success: true,
        message: "Phone number received and welcome message sent successfully",
        data: {
          phoneNumber,
        },
      });
    } catch (error: any) {
      logger.error(`Error sending welcome message to ${phoneNumber}:`, error);

      // Return success for phone number but note message failure
      res.status(200).json({
        success: true,
        message:
          "Phone number received successfully, but failed to send welcome message",
        data: {
          phoneNumber,
          error: error.message,
        },
      });
    }
  });

  // Error handling middleware
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      logger.error("API Error", err);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  );

  // Start the server
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    logger.info(`Server started on port ${port}`);
  });
}
