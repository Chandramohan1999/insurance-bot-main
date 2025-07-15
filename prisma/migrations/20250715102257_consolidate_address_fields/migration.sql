/*
  Warnings:

  - You are about to drop the column `city` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `houseNumber` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `streetNumber` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `zipCode` on the `Member` table. All the data in the column will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Member] DROP COLUMN [city],
[country],
[houseNumber],
[state],
[streetNumber],
[zipCode];
ALTER TABLE [dbo].[Member] ADD [address] NVARCHAR(1000);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
