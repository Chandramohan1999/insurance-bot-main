// src/api/promo-code-routes.ts
import express from "express";
import { prisma } from "../core/prisma-client";
import { logger } from "../core/logger";

export const promoCodeRouter = express.Router();

// Create a new promo code
promoCodeRouter.post("/", async (req, res) => {
  try {
    const {
      code,
      discountPercent,
      description,
      startDate,
      endDate,
      usageLimit,
    } = req.body;

    // Validate required fields
    if (!code || !discountPercent) {
      return res.status(400).json({
        success: false,
        message: "Code and discountPercent are required",
      });
    }

    // Check if promo code already exists
    const existingCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: "Promo code already exists",
      });
    }

    // Create the promo code
    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        discountPercent,
        description,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        usageLimit,
      },
    });

    logger.info(`Created new promo code: ${promoCode.code}`);

    res.status(201).json({
      success: true,
      data: promoCode,
    });
  } catch (error: any) {
    logger.error("Error creating promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create promo code",
      error: error.message,
    });
  }
});

// Get all promo codes
promoCodeRouter.get("/", async (req, res) => {
  try {
    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: promoCodes,
    });
  } catch (error: any) {
    logger.error("Error fetching promo codes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promo codes",
      error: error.message,
    });
  }
});

// Get a specific promo code by code
promoCodeRouter.get("/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    res.json({
      success: true,
      data: promoCode,
    });
  } catch (error: any) {
    logger.error("Error fetching promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promo code",
      error: error.message,
    });
  }
});

// Update a promo code
promoCodeRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        ...updateData,
        code: updateData.code ? updateData.code.toUpperCase() : undefined,
        startDate: updateData.startDate
          ? new Date(updateData.startDate)
          : undefined,
        endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
      },
    });

    logger.info(`Updated promo code: ${promoCode.code}`);

    res.json({
      success: true,
      data: promoCode,
    });
  } catch (error: any) {
    logger.error("Error updating promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update promo code",
      error: error.message,
    });
  }
});

// Activate/Deactivate a promo code
promoCodeRouter.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      });
    }

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: { isActive },
    });

    logger.info(
      `Updated promo code status: ${promoCode.code} - Active: ${isActive}`
    );

    res.json({
      success: true,
      data: promoCode,
    });
  } catch (error: any) {
    logger.error("Error updating promo code status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update promo code status",
      error: error.message,
    });
  }
});

// Delete a promo code
promoCodeRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.promoCode.delete({
      where: { id },
    });

    logger.info(`Deleted promo code with ID: ${id}`);

    res.json({
      success: true,
      message: "Promo code deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete promo code",
      error: error.message,
    });
  }
});

// Validate a promo code (used during policy creation)
promoCodeRouter.post("/validate", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Code is required",
      });
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    // Check if promo code is active
    if (!promoCode.isActive) {
      return res.status(400).json({
        success: false,
        message: "Promo code is not active",
      });
    }

    // Check date validity
    const now = new Date();
    if (promoCode.startDate && now < promoCode.startDate) {
      return res.status(400).json({
        success: false,
        message: "Promo code is not yet valid",
      });
    }

    if (promoCode.endDate && now > promoCode.endDate) {
      return res.status(400).json({
        success: false,
        message: "Promo code has expired",
      });
    }

    // Check usage limit
    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Promo code usage limit reached",
      });
    }

    res.json({
      success: true,
      data: {
        code: promoCode.code,
        discountPercent: promoCode.discountPercent,
      },
    });
  } catch (error: any) {
    logger.error("Error validating promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate promo code",
      error: error.message,
    });
  }
});
