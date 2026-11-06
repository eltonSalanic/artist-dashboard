-- AlterEnum
ALTER TYPE "FinanceState" ADD VALUE 'REJECTED';
ALTER TYPE "NotificationCategory" ADD VALUE 'APPROVALS';

-- CreateEnum
CREATE TYPE "InboxKind" AS ENUM ('MENTION', 'APPROVAL', 'DECISION');

-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "decisionNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "MentionNotification" ADD COLUMN     "entryId" UUID,
ADD COLUMN     "kind" "InboxKind" NOT NULL DEFAULT 'MENTION',
ALTER COLUMN "taskId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MentionNotification_entryId_idx" ON "MentionNotification"("entryId");

-- AddForeignKey
ALTER TABLE "MentionNotification" ADD CONSTRAINT "MentionNotification_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
