BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Policy] (
    [id] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Policy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [isCompleted] BIT NOT NULL CONSTRAINT [Policy_isCompleted_df] DEFAULT 0,
    [whatsappNumber] NVARCHAR(1000) NOT NULL,
    [policyPeriod] NVARCHAR(1000),
    [ticketVesselNumber] NVARCHAR(1000),
    [arrivalDate] NVARCHAR(1000),
    [flightNumber] NVARCHAR(1000),
    [airline] NVARCHAR(1000),
    [flightFrom] NVARCHAR(1000),
    [hasOtherInsurance] NVARCHAR(1000),
    [confirmApplication] NVARCHAR(1000),
    [totalPrice] FLOAT(53),
    [calculatedAt] DATETIME2,
    [memberCount] INT CONSTRAINT [Policy_memberCount_df] DEFAULT 0,
    [paymentMethod] NVARCHAR(1000),
    [paymentStatus] NVARCHAR(1000),
    [paymentId] NVARCHAR(1000),
    [paymentApprovalUrl] NVARCHAR(1000),
    [paymentCreatedAt] DATETIME2,
    [paymentCompletedAt] DATETIME2,
    [payerID] NVARCHAR(1000),
    [policyNumber] NVARCHAR(1000),
    [policyIssuedAt] DATETIME2,
    [promoCode] NVARCHAR(1000),
    [discountRate] FLOAT(53),
    CONSTRAINT [Policy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Policy_paymentId_key] UNIQUE NONCLUSTERED ([paymentId]),
    CONSTRAINT [Policy_policyNumber_key] UNIQUE NONCLUSTERED ([policyNumber])
);

-- CreateTable
CREATE TABLE [dbo].[Member] (
    [id] NVARCHAR(1000) NOT NULL,
    [isPrimary] BIT NOT NULL CONSTRAINT [Member_isPrimary_df] DEFAULT 0,
    [addedAt] DATETIME2 NOT NULL CONSTRAINT [Member_addedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [firstName] NVARCHAR(1000) NOT NULL,
    [lastName] NVARCHAR(1000) NOT NULL,
    [dateOfBirth] NVARCHAR(1000) NOT NULL,
    [gender] NVARCHAR(1000) NOT NULL,
    [houseNumber] NVARCHAR(1000),
    [streetNumber] NVARCHAR(1000),
    [city] NVARCHAR(1000),
    [state] NVARCHAR(1000),
    [zipCode] NVARCHAR(1000),
    [country] NVARCHAR(1000),
    [mobileNumber] NVARCHAR(1000),
    [phoneNumber] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [passportNumber] NVARCHAR(1000),
    [placeOfIssue] NVARCHAR(1000),
    [passportExpiry] NVARCHAR(1000),
    [issuingCountry] NVARCHAR(1000),
    [preExistingCondition] NVARCHAR(1000),
    [onMedicalTreatment] NVARCHAR(1000),
    [isSmoker] NVARCHAR(1000),
    [alcoholConsumption] NVARCHAR(1000),
    [isPregnant] NVARCHAR(1000),
    [hasSexuallyTransmittedDisease] NVARCHAR(1000),
    [hasMentalHealthIssues] NVARCHAR(1000),
    [wasHospitalized] NVARCHAR(1000),
    [travelingAgainstMedicalAdvice] NVARCHAR(1000),
    [policyId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Member_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Payment] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [amount] FLOAT(53) NOT NULL,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [Payment_currency_df] DEFAULT 'USD',
    [status] NVARCHAR(1000) NOT NULL,
    [paymentMethod] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [approvalUrl] NVARCHAR(1000),
    [gatewayPaymentId] NVARCHAR(1000),
    [gatewayResponseText] NVARCHAR(1000),
    [returnUrl] NVARCHAR(1000),
    [cancelUrl] NVARCHAR(1000),
    [completedAt] DATETIME2,
    [policyId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Payment_policyId_key] UNIQUE NONCLUSTERED ([policyId])
);

-- CreateTable
CREATE TABLE [dbo].[WorkflowState] (
    [id] NVARCHAR(1000) NOT NULL,
    [phoneNumber] NVARCHAR(1000) NOT NULL,
    [workflowId] NVARCHAR(1000),
    [currentQuestionIndex] INT NOT NULL CONSTRAINT [WorkflowState_currentQuestionIndex_df] DEFAULT 0,
    [lastMessageTimestamp] DATETIME2 NOT NULL CONSTRAINT [WorkflowState_lastMessageTimestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [answersJson] NVARCHAR(1000),
    [workflowHistoryJson] NVARCHAR(1000),
    [isWaitingForResponse] BIT NOT NULL CONSTRAINT [WorkflowState_isWaitingForResponse_df] DEFAULT 0,
    [pendingTransition] NVARCHAR(1000),
    [policyId] NVARCHAR(1000),
    [memberId] NVARCHAR(1000),
    CONSTRAINT [WorkflowState_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkflowState_phoneNumber_key] UNIQUE NONCLUSTERED ([phoneNumber])
);

-- AddForeignKey
ALTER TABLE [dbo].[Member] ADD CONSTRAINT [Member_policyId_fkey] FOREIGN KEY ([policyId]) REFERENCES [dbo].[Policy]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_policyId_fkey] FOREIGN KEY ([policyId]) REFERENCES [dbo].[Policy]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
