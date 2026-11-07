-- Paying a member back replaces approvals. An expense a member paid out of
-- pocket counts at once and stays owed to them until an admin pays it back.
-- Income no longer records who is holding it, and recorded payments go.

-- Approval states fold into SETTLED: everything logged counts.
UPDATE "FinanceEntry" SET "state" = 'SETTLED' WHERE "state" IN ('PENDING', 'REJECTED');

-- AlterEnum: Postgres can't drop enum values, so rebuild the type.
ALTER TYPE "FinanceState" RENAME TO "FinanceState_old";
CREATE TYPE "FinanceState" AS ENUM ('EXPECTED', 'SETTLED', 'VOID');
ALTER TABLE "FinanceEntry" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "FinanceEntry" ALTER COLUMN "state" TYPE "FinanceState" USING ("state"::text::"FinanceState");
ALTER TABLE "FinanceEntry" ALTER COLUMN "state" SET DEFAULT 'SETTLED';
DROP TYPE "FinanceState_old";

-- Income has no "who has the money".
UPDATE "FinanceEntry" SET "handledById" = NULL WHERE "kind" = 'INCOME';

-- DropForeignKey
ALTER TABLE "FinanceEntry" DROP CONSTRAINT "FinanceEntry_approvedById_fkey";

-- AlterTable
ALTER TABLE "FinanceEntry" DROP COLUMN "approvedAt",
DROP COLUMN "approvedById",
DROP COLUMN "decisionNote",
ADD COLUMN     "paidBackAt" TIMESTAMP(3),
ADD COLUMN     "paidBackById" UUID;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_paidBackById_fkey" FOREIGN KEY ("paidBackById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Old approval alerts would say the wrong thing; drop them, and any still
-- waiting to be sent.
DELETE FROM "MentionNotification" WHERE "kind" IN ('APPROVAL', 'DECISION');
DELETE FROM "NotificationDelivery" WHERE "template" IN ('expense-approval', 'expense-decided') AND "status" = 'QUEUED';

-- Old payment activity has no matching entry to point at any more.
DELETE FROM "Activity" WHERE "type" = 'PAYOUT_RECORDED';

-- AlterEnum
ALTER TYPE "InboxKind" RENAME VALUE 'APPROVAL' TO 'PAYBACK';
ALTER TYPE "InboxKind" RENAME VALUE 'DECISION' TO 'PAID_BACK';
ALTER TYPE "ActivityType" RENAME VALUE 'PAYOUT_RECORDED' TO 'EXPENSE_PAID_BACK';

-- DropTable
DROP TABLE "Payout";
