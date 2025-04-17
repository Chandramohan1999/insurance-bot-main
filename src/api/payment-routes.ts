import express from "express";
import { logger } from "../core/logger";
import { getWhatsAppIntegration } from "../whatsapp/whatsapp-integration";
import { prisma } from "../core/prisma-client";

export const paymentRouter = express.Router();

paymentRouter.get("/success", async (req, res) => {
  try {
    const { paymentId, token, PayerID, policyId } = req.query;

    logger.info(
      `Payment success callback received: PaymentID=${paymentId}, PolicyID=${policyId}`
    );

    if (!policyId) {
      return res.status(400).json({
        success: false,
        message: "Policy ID is required",
      });
    }

    // Get the policy
    const policy = await prisma.policy.findUnique({
      where: { id: policyId as string },
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: `Policy with ID ${policyId} not found`,
      });
    }

    // Update policy payment status
    await prisma.policy.update({
      where: { id: policyId as string },
      data: {
        paymentStatus: "COMPLETED",
        paymentCompletedAt: new Date(),
        payerID: (PayerID as string) || undefined,
      },
    });

    // Update payment status if it exists
    if (policy.paymentId) {
      try {
        await prisma.payment.update({
          where: { id: policy.paymentId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      } catch (error) {
        logger.error(`Error updating payment status: ${error}`);
      }
    }

    // Get the WhatsApp integration and workflow handler
    const whatsAppIntegration = getWhatsAppIntegration();
    const whatsAppWorkflowHandler = whatsAppIntegration.getWorkflowHandler();

    // Send confirmation message via WhatsApp if phone number is available
    if (policy.whatsappNumber) {
      try {
        const watiService = whatsAppIntegration.getWatiService();

        let message = `Great news! Your payment has been successfully processed. Your insurance policy is now being generated.\n\nTransaction ID: ${
          paymentId || token || "N/A"
        }`;

        await watiService.sendTextMessage(policy.whatsappNumber, message);
        logger.info(
          `Payment success notification sent to ${policy.whatsappNumber}`
        );
      } catch (error) {
        logger.error(
          `Failed to send payment success notification via WhatsApp:`,
          error
        );
      }
    }

    // Call the handlePaymentCompletion method to process policy issuance
    try {
      await whatsAppWorkflowHandler.handlePaymentCompletion(
        policy.whatsappNumber,
        policy.id
      );
    } catch (error) {
      logger.error(`Error in handlePaymentCompletion: ${error}`);
    }

    // Return a nice HTML page
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px 20px;
              background-color: #f8f9fa;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .success-icon {
              color: #28a745;
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #28a745;
            }
            p {
              font-size: 18px;
              color: #333;
              margin-bottom: 15px;
            }
            .policy-id {
              font-family: monospace;
              padding: 8px 12px;
              background-color: #f1f1f1;
              border-radius: 4px;
              display: inline-block;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Payment Successful!</h1>
            <p>Your insurance policy is now being processed.</p>
            <p>Reference Number: <span class="policy-id">${policyId}</span></p>
            <p>Thank you for choosing our service.</p>
            <p>You can close this window and return to the conversation.</p>
            <p>Your policy documents will be sent to your email shortly.</p>
          </div>
        </body>
      </html>
    `;

    res.send(htmlResponse);
  } catch (error: any) {
    logger.error("Error processing payment success callback:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment success",
      error: error.message,
    });
  }
});
/**
 * Handle cancelled payment callback from PayPal
 * GET /api/payment/cancel
 */
paymentRouter.get("/cancel", async (req, res) => {
  try {
    const { token, policyId } = req.query;

    logger.info(`Payment cancelled: Token=${token}, PolicyID=${policyId}`);

    if (!policyId) {
      return res.status(400).json({
        success: false,
        message: "Policy ID is required",
      });
    }

    // Get the policy
    const policy = await prisma.policy.findUnique({
      where: { id: policyId as string },
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: `Policy with ID ${policyId} not found`,
      });
    }

    // Update policy payment status
    await prisma.policy.update({
      where: { id: policyId as string },
      data: {
        paymentStatus: "CANCELLED",
      },
    });

    // Update payment status if it exists
    if (policy.paymentId) {
      try {
        await prisma.payment.update({
          where: { id: policy.paymentId },
          data: {
            status: "CANCELLED",
          },
        });
      } catch (error) {
        logger.error(`Error updating payment status: ${error}`);
      }
    }

    // Send notification via WhatsApp if phone number is available
    if (policy.whatsappNumber) {
      try {
        const whatsAppIntegration = getWhatsAppIntegration();
        const watiService = whatsAppIntegration.getWatiService();

        await watiService.sendTextMessage(
          policy.whatsappNumber,
          `Your payment was cancelled. Don't worry - you can try again or choose a different payment method.\n\nIf you need assistance, please contact our support team.`
        );
        logger.info(
          `Payment cancellation notification sent to ${policy.whatsappNumber}`
        );
      } catch (error) {
        logger.error(
          `Failed to send payment cancellation notification via WhatsApp:`,
          error
        );
      }
    }

    // Return a nice HTML page
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Cancelled</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px 20px;
              background-color: #f8f9fa;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .cancel-icon {
              color: #dc3545;
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #dc3545;
            }
            p {
              font-size: 18px;
              color: #333;
              margin-bottom: 15px;
            }
            .policy-id {
              font-family: monospace;
              padding: 8px 12px;
              background-color: #f1f1f1;
              border-radius: 4px;
              display: inline-block;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="cancel-icon">✗</div>
            <h1>Payment Cancelled</h1>
            <p>Your payment was not completed.</p>
            <p>Policy ID: <span class="policy-id">${policyId}</span></p>
            <p>Don't worry - you can try again or choose a different payment method.</p>
            <p>Please return to the conversation to continue.</p>
          </div>
        </body>
      </html>
    `;

    res.send(htmlResponse);
  } catch (error: any) {
    logger.error("Error processing payment cancel callback:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment cancellation",
      error: error.message,
    });
  }
});
