-- AlterEnum
ALTER TYPE "FinanceState" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "settleKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_settleKey_key" ON "FinanceEntry"("settleKey");

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Band Wall keeps books in US dollars only; the currency picker is gone.
UPDATE "Board" SET "currency" = 'USD' WHERE "currency" <> 'USD';
