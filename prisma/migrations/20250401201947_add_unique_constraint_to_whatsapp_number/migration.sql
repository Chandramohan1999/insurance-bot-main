/*
  Warnings:

  - A unique constraint covering the columns `[whatsappNumber]` on the table `Policy` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

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
