-- CreateEnum
CREATE TYPE "DisbursementMode" AS ENUM ('ORGANIZER_PAYOUT', 'DIRECT_TO_INSTITUTION');

-- CreateEnum
CREATE TYPE "PayeeType" AS ENUM ('EDUCATION', 'MEDICAL', 'FUNERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PayeeStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('PENDING', 'APPROVED', 'SENT', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DONATION_RECEIVED', 'DISBURSEMENT_SENT', 'REFUND', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "disbursementMode" "DisbursementMode" NOT NULL DEFAULT 'ORGANIZER_PAYOUT',
ADD COLUMN     "heldAmountCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Payee" (
    "id" TEXT NOT NULL,
    "type" "PayeeType" NOT NULL,
    "name" TEXT NOT NULL,
    "ein" TEXT,
    "payInstructions" JSONB NOT NULL,
    "status" "PayeeStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignPayee" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "beneficiaryRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignPayee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disbursement" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "externalRef" TEXT,
    "proofUrl" TEXT,
    "initiatedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "donationId" TEXT,
    "disbursementId" TEXT,
    "proofUrl" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payee_type_status_idx" ON "Payee"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignPayee_campaignId_key" ON "CampaignPayee"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignPayee_payeeId_idx" ON "CampaignPayee"("payeeId");

-- CreateIndex
CREATE INDEX "Disbursement_campaignId_status_idx" ON "Disbursement"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Disbursement_payeeId_idx" ON "Disbursement"("payeeId");

-- CreateIndex
CREATE INDEX "LedgerEntry_campaignId_occurredAt_idx" ON "LedgerEntry"("campaignId", "occurredAt");

-- AddForeignKey
ALTER TABLE "CampaignPayee" ADD CONSTRAINT "CampaignPayee_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPayee" ADD CONSTRAINT "CampaignPayee_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

