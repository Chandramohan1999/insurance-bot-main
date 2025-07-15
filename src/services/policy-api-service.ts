// src/services/policy-api-service.ts
import axios from "axios";
import { logger } from "../core/logger";

const POLICY_ISSUANCE_API =
  "https://fijicare-whatsapp-api.enoviq.com/v1/PolicyIssuance/PolicyDataResponse";
const POLICY_LETTER_API =
  "https://fijicare-whatsapp-api.enoviq.com/v1/PolicyIssuance/PolicyLetter";

/**
 * Service to handle policy issuance API calls
 */
export class PolicyApiService {
  /**
   * Issues a new policy by calling the external API
   * @param policyData The formatted policy data to send to the API
   * @returns The policy number if successful
   */
  async issuePolicyFromPaymentData(policyData: any): Promise<string | null> {
    try {
      // Extract and format the data for the API
      const apiPayload = this.formatDataForPolicyIssuance(policyData);

      logger.info(
        `Calling policy issuance API with payload: ${JSON.stringify(
          apiPayload
        )}`
      );

      // Call the policy issuance API
      const response = await axios.post(POLICY_ISSUANCE_API, apiPayload);

      logger.info(
        `Policy issuance API response: ${JSON.stringify(response.data)}`
      );
      console.log(
        "================issuePolicyFromPaymentData===================="
      );
      console.log(response.data);
      console.log(
        "================issuePolicyFromPaymentData===================="
      );
      // Check if the response is successful
      if (response.data.errorObj && response.data.errorObj[0].errorCode === 0) {
        const policyNumber = response.data.responseObj.policy_No;
        logger.info(`Successfully created policy with number: ${policyNumber}`);
        return policyNumber;
      } else {
        const errorMessage =
          response.data.errorObj?.[0]?.errorMessage || "Unknown error";
        logger.error(`Policy issuance API error: ${errorMessage}`);
        return null;
      }
    } catch (error) {
      logger.error(`Error calling policy issuance API:`, error);
      return null;
    }
  }

  /**
   * Generates and sends a policy letter
   * @param policyNumber The policy number
   * @param email The email to send the policy to
   * @param name The name of the policy holder
   * @returns True if successful, false otherwise
   */
  async generatePolicyLetter(
    policyNumber: string,
    email: string,
    name: string
  ): Promise<boolean> {
    try {
      const payload = {
        flag: "POLICYCOPY",
        ref_No: policyNumber,
        product_Cd: policyNumber.split("-")[0] || "9112",
        mail_Ind: "1",
        email: email,
        name: name || "nil",
        mode: "",
      };

      logger.info(
        `Calling policy letter API with payload: ${JSON.stringify(payload)}`
      );

      const response = await axios.post(POLICY_LETTER_API, payload);

      logger.info(
        `Policy letter API response: ${JSON.stringify(response.data)}`
      );
      console.log("===================response.data=================");
      console.log(response.status, payload, policyNumber);
      console.log("===================response.data=================");
      // Check if the response is successful
      if (response.status == 200) {
        logger.info(
          `Successfully generated policy letter for policy: ${policyNumber}`
        );
        return true;
      } else {
        const errorMessage =
          response.data.errorObj?.[0]?.errorMessage || "Unknown error";
        logger.error(`Policy letter API error: ${errorMessage}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error calling policy letter API:`, error);
      return false;
    }
  }

  /**
   * Format the data from our internal structure to the API's expected format
   */
  private formatDataForPolicyIssuance(data: any): any {
    // Extract member and policy details
    const memberDetails = data.memberDetails || {};
    const policyDetails = data.policyDetails || {};

    // Parse address if it exists (you might want to implement smarter parsing)
    let addressComponents = {
      houseNumber: "",
      streetNumber: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
    };

    if (memberDetails.address) {
      // Simple parsing - you might want to make this more sophisticated
      const addressParts = memberDetails.address
        .split(",")
        .map((part: string) => part.trim());

      if (addressParts.length >= 6) {
        addressComponents = {
          houseNumber: addressParts[0] || "",
          streetNumber: addressParts[1] || "",
          city: addressParts[2] || "",
          state: addressParts[3] || "",
          zipCode: addressParts[4] || "",
          country: addressParts[5] || "",
        };
      } else if (addressParts.length >= 4) {
        // Fallback for shorter addresses
        addressComponents = {
          houseNumber: "",
          streetNumber: addressParts[0] || "",
          city: addressParts[1] || "",
          state: addressParts[2] || "",
          zipCode: "",
          country: addressParts[3] || "",
        };
      } else {
        // Use the full address as street if parsing fails
        addressComponents = {
          houseNumber: "",
          streetNumber: memberDetails.address,
          city: "",
          state: "",
          zipCode: "",
          country: "",
        };
      }
    }

    // Format the data according to the API's expected schema
    return {
      firstName: memberDetails.firstName,
      lastName: memberDetails.lastName,
      dateOfBirth: memberDetails.dateOfBirth,
      gender: memberDetails.gender,
      houseNumber: addressComponents.houseNumber,
      streetNumber: addressComponents.streetNumber,
      city: addressComponents.city,
      state: addressComponents.state,
      zipCode: addressComponents.zipCode,
      country: addressComponents.country,
      mobileNumber: memberDetails.mobileNumber,
      email: memberDetails.email,
      passportNumber: memberDetails.passportNumber,
      placeOfIssue: memberDetails.placeOfIssue,
      passportExpiry: memberDetails.passportExpiry,
      issuingCountry: memberDetails.issuingCountry,
      ticketVesselNumber: policyDetails.ticketVesselNumber,
      arrivalDate: policyDetails.arrivalDate,
      flightNumber: policyDetails.flightNumber,
      airline: policyDetails.airline,
      flightFrom: policyDetails.flightFrom,
      productType: policyDetails.productType,
      policyPeriod: policyDetails.policyPeriod,
      preExistingCondition: memberDetails.preExistingCondition,
      onMedicalTreatment: memberDetails.onMedicalTreatment,
      isSmoker: memberDetails.isSmoker,
      alcoholConsumption: memberDetails.alcoholConsumption,
      isPregnant: memberDetails.isPregnant,
      hasSexuallyTransmittedDisease:
        memberDetails.hasSexuallyTransmittedDisease,
      hasOtherInsurance: memberDetails.hasOtherInsurance,
      travelingAgainstMedicalAdvice:
        memberDetails.travelingAgainstMedicalAdvice,
      hasMentalHealthIssues: memberDetails.hasMentalHealthIssues,
      wasHospitalized: memberDetails.wasHospitalized,
      paymentMethod: policyDetails.paymentMethod,
      promoCode: policyDetails.promoCode,
      phoneNumber: memberDetails.phoneNumber || memberDetails.mobileNumber,
      sessionId: policyDetails.sessionId,
      isCompleted: policyDetails.isCompleted,
      crtd_Dt: policyDetails.crtd_Dt,
      lst_Updt_Dt: policyDetails.lst_Updt_Dt,
    };
  }
}

// Export singleton instance
export const policyApiService = new PolicyApiService();
