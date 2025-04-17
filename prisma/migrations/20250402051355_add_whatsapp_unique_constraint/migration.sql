/*
  Warnings:

  - A unique constraint covering the columns `[whatsappNumber]` on the table `Policy` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[Policy] DROP CONSTRAINT [Policy_paymentId_key];

-- DropIndex
ALTER TABLE [dbo].[Policy] DROP CONSTRAINT [Policy_policyNumber_key];

-- CreateIndex
ALTER TABLE [dbo].[Policy] ADD CONSTRAINT [Policy_whatsappNumber_key] UNIQUE NONCLUSTERED ([whatsappNumber]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
