-- CreateEnum
CREATE TYPE "FinanceKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceState" AS ENUM ('EXPECTED', 'SETTLED', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'FINANCE_ENTRY_ADDED';
ALTER TYPE "ActivityType" ADD VALUE 'SHOW_SETTLED';
ALTER TYPE "ActivityType" ADD VALUE 'PAYOUT_RECORDED';

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "financeEntryId" UUID;

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "kind" "FinanceKind" NOT NULL,
    "state" "FinanceState" NOT NULL DEFAULT 'SETTLED',
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "occurredOn" DATE NOT NULL,
    "counterparty" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "eventId" UUID,
    "handledById" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSplit" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "userId" UUID,
    "shareBps" INTEGER NOT NULL,

    CONSTRAINT "FinanceSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitShare" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "userId" UUID,
    "shareBps" INTEGER NOT NULL,

    CONSTRAINT "SplitShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceEntry_boardId_occurredOn_idx" ON "FinanceEntry"("boardId", "occurredOn");

-- CreateIndex
CREATE INDEX "FinanceEntry_eventId_idx" ON "FinanceEntry"("eventId");

-- CreateIndex
CREATE INDEX "FinanceSplit_entryId_idx" ON "FinanceSplit"("entryId");

-- CreateIndex
CREATE INDEX "SplitShare_boardId_idx" ON "SplitShare"("boardId");

-- CreateIndex
CREATE INDEX "Payout_boardId_paidOn_idx" ON "Payout"("boardId", "paidOn");

-- CreateIndex
CREATE INDEX "Attachment_financeEntryId_idx" ON "Attachment"("financeEntryId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSplit" ADD CONSTRAINT "FinanceSplit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSplit" ADD CONSTRAINT "FinanceSplit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitShare" ADD CONSTRAINT "SplitShare_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitShare" ADD CONSTRAINT "SplitShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Amounts carry no sign (the kind does) and shares are basis points.
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "FinanceSplit" ADD CONSTRAINT "FinanceSplit_share_range" CHECK ("shareBps" BETWEEN 0 AND 10000);
ALTER TABLE "SplitShare" ADD CONSTRAINT "SplitShare_share_range" CHECK ("shareBps" BETWEEN 0 AND 10000);
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_amount_nonzero" CHECK ("amountCents" <> 0);
