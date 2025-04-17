import { startServer } from "./api/server";
import { logger } from "./core/logger";
import { prisma } from "./core/prisma-client";
import { getWhatsAppIntegration } from "./whatsapp/whatsapp-integration";

// Self-invoking async function to allow for await
(async function main() {
  try {
    // Connect to database and verify connection
    await prisma.$connect();
    logger.info("Connected to database successfully");

    // Initialize WhatsApp integration - loads workflows and questions
    getWhatsAppIntegration();
    logger.info("WhatsApp integration initialized");

    // Start the server
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    startServer(PORT);
    logger.info(`Server started on port ${PORT}`);
  } catch (error) {
    logger.error("Failed to start application:", error);
    process.exit(1);
  }
})().catch((error) => {
  console.error("Unhandled error in main function:", error);
  process.exit(1);
});

// Handle application shutdown
process.on("SIGINT", async () => {
  logger.info("Application shutdown initiated");
  await prisma.$disconnect();
  logger.info("Database disconnected");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Application termination requested");
  await prisma.$disconnect();
  logger.info("Database disconnected");
  process.exit(0);
});
