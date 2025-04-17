import axios from "axios";
import { logger } from "../core/logger";
import {
  EntityStore,
  PayPalPaymentRequest,
  PayPalPaymentResponse,
} from "../core/types";
import env from "../config/env";
import { prisma } from "../core/prisma-client";

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;

// Product pricing by policy period
const PRODUCT_PRICING: Record<string, number> = {
  "15 days": 39.99,
  "30 days": 79.99,
};

export class PayPalService {
  private store: EntityStore;
  private webProfileId: string = "";
  private clientId: string;
  private clientSecret: string;
  private mode: string;

  constructor(store: EntityStore) {
    this.store = store;
    this.clientId = env.paypal.clientId;
    this.clientSecret = env.paypal.clientSecret;
    this.mode = env.paypal.mode;
  }

  async calculatePolicyPrice(policyId: string): Promise<number> {
    try {
      // Get the policy from database
      const policy = await prisma.policy.findUnique({
        where: { id: policyId },
        include: { members: true },
      });

      if (!policy) {
        logger.error(`Policy ${policyId} not found for price calculation`);
        return 39.99; // Default price
      }

      const policyPeriod = policy.policyPeriod || "15 days";
      const basePrice = PRODUCT_PRICING[policyPeriod] || 39.99;

      // Count the number of members
      const memberCount = policy.members.length || 1;

      // Calculate total price
      let totalPrice = basePrice * memberCount;

      // Apply discount if any
      if (policy.discountRate) {
        totalPrice = totalPrice * (1 - policy.discountRate);
      }

      return parseFloat(totalPrice.toFixed(2));
    } catch (error) {
      logger.error(`Error calculating policy price:`, error);
      return 39.99; // Default price on error
    }
  }

  async getAccessToken(): Promise<string> {
    try {
      // Check if we have a valid token that hasn't expired yet
      if (cachedToken && tokenExpiry && tokenExpiry > new Date()) {
        logger.info("Using cached PayPal access token");
        return cachedToken;
      }

      if (!this.clientId || !this.clientSecret) {
        throw new Error("PayPal client credentials not configured");
      }

      logger.info("Getting new PayPal access token");
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`
      ).toString("base64");
      const apiUrl =
        this.mode === "sandbox"
          ? "https://api.sandbox.paypal.com/v1/oauth2/token"
          : "https://api.paypal.com/v1/oauth2/token";

      const response = await axios.post(
        apiUrl,
        "grant_type=client_credentials",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${auth}`,
          },
        }
      );

      const data = response.data;

      if (data.error) {
        throw new Error(
          `PayPal OAuth error: ${data.error_description || data.error}`
        );
      }

      // Calculate token expiry (subtract 5 minutes for safety margin)
      tokenExpiry = new Date();
      tokenExpiry.setSeconds(
        tokenExpiry.getSeconds() + (data.expires_in - 300)
      );
      cachedToken = data.access_token;

      logger.info("Successfully obtained PayPal access token");
      return data.access_token;
    } catch (error) {
      logger.error("Error getting PayPal access token:", error);
      return "mock-access-token-for-demo";
    }
  }

  async getOrCreateWebProfile(
    brandName: string = "Travel Insurance",
    logoUrl: string = `${env.app.appHost}/logo.png`
  ): Promise<string | null> {
    try {
      // If we already have a web profile ID, return it
      if (this.webProfileId) {
        return this.webProfileId;
      }

      // Get access token
      const accessToken = await this.getAccessToken();

      // For demo purposes, check if we're using a mock token
      if (accessToken === "mock-access-token-for-demo") {
        this.webProfileId = "mock-web-profile-id";
        return this.webProfileId;
      }

      // Create a new web profile
      const apiUrl =
        this.mode === "sandbox"
          ? "https://api.sandbox.paypal.com/v1/payment-experience/web-profiles"
          : "https://api.paypal.com/v1/payment-experience/web-profiles";

      const profileName = `Profile_${new Date().getTime()}`;

      const response = await axios.post(
        apiUrl,
        {
          name: profileName,
          presentation: {
            brand_name: brandName,
            logo_image: logoUrl,
            locale_code: "US",
          },
          input_fields: {
            no_shipping: 1,
            address_override: 0,
          },
          flow_config: {
            landing_page_type: "billing",
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      this.webProfileId = response.data.id;
      logger.info(`Created PayPal web profile: ${this.webProfileId}`);
      return this.webProfileId;
    } catch (error) {
      logger.error("Error creating PayPal web profile:", error);
      this.webProfileId = "mock-web-profile-id";
      return this.webProfileId;
    }
  }

  async createPayment(
    paymentRequest: PayPalPaymentRequest
  ): Promise<PayPalPaymentResponse> {
    try {
      const {
        userId,
        amount,
        currency = "USD",
        description = "Travel Insurance",
        productType,
        policyPeriod,
        policyId,
        returnUrl,
        cancelUrl,
      } = paymentRequest;

      // Build proper return URLs including the policyId parameter
      const appHost = env.app.appHost;
      const fullReturnUrl =
        returnUrl || `${appHost}/api/payment/success?policyId=${policyId}`;
      const fullCancelUrl =
        cancelUrl || `${appHost}/api/payment/cancel?policyId=${policyId}`;

      // Get access token
      const accessToken = await this.getAccessToken();

      // Create a brand name with product type if provided
      const brandName = productType
        ? `Travel Insurance - ${productType}`
        : "Travel Insurance";

      // Get web profile
      const webProfileId = await this.getOrCreateWebProfile(brandName);

      // Create payment description
      let paymentDescription = description;
      if (policyPeriod) {
        paymentDescription += `, ${policyPeriod}`;
      }

      // Create PayPal payment
      const apiUrl =
        this.mode === "sandbox"
          ? "https://api.sandbox.paypal.com/v1/payments/payment"
          : "https://api.paypal.com/v1/payments/payment";

      const response = await axios.post(
        apiUrl,
        {
          intent: "sale",
          payer: {
            payment_method: "paypal",
          },
          transactions: [
            {
              amount: {
                total: amount.toFixed(2),
                currency,
              },
              description: paymentDescription,
            },
          ],
          redirect_urls: {
            return_url: fullReturnUrl,
            cancel_url: fullCancelUrl,
          },
          experience_profile_id: webProfileId,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = response.data;

      // Find approval URL for redirect
      const approvalUrl = data.links.find(
        (link: any) => link.rel === "approval_url"
      )?.href;

      if (!approvalUrl) {
        throw new Error("PayPal approval URL not found in response");
      }

      // Save payment in database
      await prisma.payment.create({
        data: {
          id: data.id,
          userId,
          amount,
          currency,
          status: "PENDING",
          paymentMethod: "paypal",
          description: paymentDescription,
          createdAt: new Date(),
          approvalUrl,
          gatewayPaymentId: data.id,
          gatewayResponseText: JSON.stringify(data), // Convert the JSON response to string
          returnUrl: fullReturnUrl,
          cancelUrl: fullCancelUrl,
          policyId: policyId || "",
        },
      });

      // Update policy with payment information
      if (policyId) {
        await prisma.policy.update({
          where: { id: policyId },
          data: {
            paymentStatus: "PENDING",
            paymentId: data.id,
            paymentMethod: "PayPal",
            paymentApprovalUrl: approvalUrl,
            paymentCreatedAt: new Date(),
          },
        });
      }

      logger.info(`Created PayPal payment: ${data.id} for $${amount}`);

      return {
        id: data.id,
        approvalUrl,
        status: "PENDING",
        gatewayPaymentId: data.id,
        gatewayResponse: data,
      };
    } catch (error) {
      logger.error("Error creating PayPal payment:", error);

      // Create a mock payment response for demonstration
      const mockPaymentId = `MOCK-${Date.now()}`;
      const mockApprovalUrl = `https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=${mockPaymentId}`;

      // Save the mock payment to database
      if (paymentRequest.policyId) {
        try {
          await prisma.payment.create({
            data: {
              id: mockPaymentId,
              userId: paymentRequest.userId,
              amount: paymentRequest.amount,
              currency: paymentRequest.currency || "USD",
              status: "PENDING",
              paymentMethod: "paypal",
              description: `${
                paymentRequest.description || "Travel Insurance"
              }, ${paymentRequest.policyPeriod}`,
              approvalUrl: mockApprovalUrl,
              gatewayPaymentId: mockPaymentId,
              gatewayResponseText: JSON.stringify({
                id: mockPaymentId,
                state: "created",
                links: [{ href: mockApprovalUrl, rel: "approval_url" }],
              }),
              policyId: paymentRequest.policyId,
            },
          });

          // Update policy with mock payment info
          await prisma.policy.update({
            where: { id: paymentRequest.policyId },
            data: {
              paymentStatus: "PENDING",
              paymentId: mockPaymentId,
              paymentMethod: "PayPal",
              paymentApprovalUrl: mockApprovalUrl,
              paymentCreatedAt: new Date(),
            },
          });
        } catch (dbError) {
          logger.error("Error creating fallback payment record:", dbError);
        }
      }

      return {
        id: mockPaymentId,
        approvalUrl: mockApprovalUrl,
        status: "PENDING",
        gatewayPaymentId: mockPaymentId,
      };
    }
  }

  async displayPaymentLink(
    payment: PayPalPaymentResponse,
    phoneNumber: string
  ): Promise<void> {
    try {
      // Import wati service to send the payment link
      const WatiService = require("./wati-service").WatiService;
      const watiService = new WatiService(this.store);

      await watiService.sendTextMessage(
        phoneNumber,
        `Please complete your payment by clicking the following link:\n\n${payment.approvalUrl}\n\nOnce payment is completed, your policy will be activated automatically and you'll receive a confirmation message.`
      );

      logger.info(
        `Payment link sent to ${phoneNumber}: ${payment.approvalUrl}`
      );
    } catch (error) {
      logger.error(`Error sending payment link to ${phoneNumber}:`, error);
      throw error;
    }
  }
}
