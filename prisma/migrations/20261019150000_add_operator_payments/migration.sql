CREATE TABLE "Operator" (
    "id" SERIAL NOT NULL,
    "businessName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "payheroUsernameCiphertext" TEXT,
    "payheroPasswordCiphertext" TEXT,
    "payheroChannelId" INTEGER,
    "mikrotikHost" TEXT,
    "mikrotikUsernameCiphertext" TEXT,
    "mikrotikPasswordCiphertext" TEXT,
    "mikrotikPort" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Operator_slug_key" ON "Operator"("slug");
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");

ALTER TABLE "Payment"
    ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'daraja',
    ADD COLUMN "providerReference" TEXT,
    ADD COLUMN "providerCheckoutId" TEXT,
    ADD COLUMN "providerReceipt" TEXT,
    ADD COLUMN "accessStatus" TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN "operatorId" INTEGER;

CREATE INDEX "Payment_operatorId_timePurchased_idx" ON "Payment"("operatorId", "timePurchased");
CREATE INDEX "Payment_provider_providerReference_idx" ON "Payment"("provider", "providerReference");

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_operatorId_fkey"
    FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
