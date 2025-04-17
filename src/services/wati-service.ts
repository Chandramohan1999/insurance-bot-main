import axios from "axios";
import { EntityStore } from "../core/types";
import { logger } from "../core/logger";
import env from "../config/env";
import { prisma } from "../core/prisma-client";

interface InteractiveButtonsMessage {
  body: string;
  footer?: string;
  buttons: Array<{ text: string }>;
}

interface WatiTemplateParam {
  name: string;
  value: string;
}

export class WatiService {
  private apiUrl: string;
  private apiToken: string;
  private store: EntityStore;

  constructor(store: EntityStore) {
    this.store = store;
    this.apiUrl = env.wati.apiUrl;
    this.apiToken = env.wati.apiToken;
  }

  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    broadcastName: string,
    templateParams: Record<string, string>
  ): Promise<any> {
    try {
      // Convert parameters to the format expected by WATI API
      const formattedParams = Object.entries(templateParams).map(
        ([name, value]) => ({ name, value })
      );

      logger.info(`Sending template message ${templateName} to ${phoneNumber}`);

      // Make the API call to WATI
      const response = await axios.post(
        `${this.apiUrl}/sendTemplateMessage?whatsappNumber=${phoneNumber}`,
        {
          template_name: templateName,
          broadcast_name: broadcastName,
          parameters: formattedParams,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      logger.info(`Template message sent successfully to ${phoneNumber}`);
      return response.data;
    } catch (error) {
      logger.error(`Error sending template message to ${phoneNumber}:`, error);
      throw error;
    }
  }

  async sendTextMessage(
    phoneNumber: string,
    messageText: string
  ): Promise<any> {
    try {
      logger.info(`Sending text message to ${phoneNumber}`);

      const formData = new URLSearchParams();
      formData.append("messageText", messageText);

      const response = await axios.post(
        `${this.apiUrl}/sendSessionMessage/${phoneNumber}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      logger.info(`Text message sent successfully to ${phoneNumber}`);
      return response.data;
    } catch (error) {
      logger.error(`Error sending text message to ${phoneNumber}:`, error);
      throw error;
    }
  }

  async sendInteractiveButtonsMessage(
    phoneNumber: string,
    message: InteractiveButtonsMessage
  ): Promise<any> {
    try {
      logger.info(`Sending interactive buttons message to ${phoneNumber}`);

      // Ensure we don't exceed the 3 button limit
      if (message.buttons.length > 3) {
        message.buttons = message.buttons.slice(0, 3);
        logger.warn(
          `Truncated buttons to 3 for ${phoneNumber} due to WhatsApp limit`
        );
      }

      const response = await axios.post(
        `${this.apiUrl}/sendInteractiveButtonsMessage?whatsappNumber=${phoneNumber}`,
        message,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      logger.info(
        `Interactive buttons message sent successfully to ${phoneNumber}`
      );
      return response.data;
    } catch (error) {
      logger.error(
        `Error sending interactive buttons message to ${phoneNumber}:`,
        error
      );
      throw error;
    }
  }

  async sendInteractiveListMessage(
    phoneNumber: string,
    header: string,
    body: string,
    footer: string,
    buttonText: string,
    options: Array<{ title: string; description?: string }>
  ): Promise<any> {
    try {
      logger.info(`Sending interactive list message to ${phoneNumber}`);

      const payload = {
        header,
        body,
        footer,
        buttonText,
        sections: [
          {
            title: "Available Options",
            rows: options,
          },
        ],
      };

      const response = await axios.post(
        `${this.apiUrl}/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      logger.info(
        `Interactive list message sent successfully to ${phoneNumber}`
      );
      return response.data;
    } catch (error) {
      logger.error(
        `Error sending interactive list message to ${phoneNumber}:`,
        error
      );
      throw error;
    }
  }

  async sendPolicySummary(phoneNumber: string, policyId: string): Promise<any> {
    try {
      // Get the policy details from the database
      const policy = await prisma.policy.findUnique({
        where: { id: policyId },
        include: { members: true },
      });

      if (!policy) {
        throw new Error(`Policy with ID ${policyId} not found`);
      }

      // Create the policy summary
      const policyPeriod = policy.policyPeriod || "Not specified";
      const totalAmount = policy.totalPrice
        ? `$${policy.totalPrice}`
        : "Pending calculation";

      const primaryMember =
        policy.members.find((m) => m.isPrimary) || policy.members[0];
      const memberName = primaryMember
        ? `${primaryMember.firstName || ""} ${
            primaryMember.lastName || ""
          }`.trim()
        : "Not specified";

      // Format date for the template
      const currentDate = new Date().toISOString().split("T")[0];

      // Send the template message
      return await this.sendTemplateMessage(
        phoneNumber,
        env.wati.policySummaryTemplate,
        env.wati.defaultBroadcastName,
        {
          name: memberName,
          policy_type: "Travel Insurance",
          policy_period: policyPeriod,
          total_amount: totalAmount,
          date: currentDate,
          policy_id: policyId,
        }
      );
    } catch (error) {
      logger.error(`Error sending policy summary to ${phoneNumber}:`, error);
      throw error;
    }
  }

  async sendApplicationSummary(
    phoneNumber: string,
    policyId: string
  ): Promise<any> {
    try {
      // Get the policy details from the database
      const policy = await prisma.policy.findUnique({
        where: { id: policyId },
        include: { members: true },
      });

      if (!policy) {
        throw new Error(`Policy with ID ${policyId} not found`);
      }

      // Build a text summary of the application
      let summaryText = "*YOUR INSURANCE APPLICATION SUMMARY*\n\n";

      // Policy details
      summaryText += "*Policy Details*\n";
      summaryText += `Policy Type: Travel Insurance\n`;
      summaryText += `Policy Period: ${
        policy.policyPeriod || "Not specified"
      }\n`;
      summaryText += `Total Amount: ${
        policy.totalPrice ? `$${policy.totalPrice}` : "Pending calculation"
      }\n\n`;

      // Member details
      policy.members.forEach((member, index) => {
        summaryText += `*Member ${index + 1}${
          member.isPrimary ? " (Primary)" : ""
        }*\n`;
        summaryText += `Name: ${member.firstName || ""} ${
          member.lastName || ""
        }\n`;
        summaryText += `Date of Birth: ${
          member.dateOfBirth || "Not provided"
        }\n`;
        summaryText += `Email: ${member.email || "Not provided"}\n`;
        summaryText += `Phone: ${member.mobileNumber || "Not provided"}\n\n`;
      });

      // Confirmation message
      summaryText +=
        "Thank you for using our service! Your application has been submitted successfully.";

      // Send the formatted text message
      return await this.sendTextMessage(phoneNumber, summaryText);
    } catch (error) {
      logger.error(
        `Error sending application summary to ${phoneNumber}:`,
        error
      );
      throw error;
    }
  }
}
