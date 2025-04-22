BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[PromoCode] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [discountPercent] FLOAT(53) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [PromoCode_isActive_df] DEFAULT 1,
    [startDate] DATETIME2,
    [endDate] DATETIME2,
    [usageLimit] INT,
    [usageCount] INT NOT NULL CONSTRAINT [PromoCode_usageCount_df] DEFAULT 0,
    [description] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PromoCode_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PromoCode_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PromoCode_code_key] UNIQUE NONCLUSTERED ([code])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
