-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('MENTIONS', 'ASSIGNMENTS', 'SCHEDULE', 'REMINDERS', 'DUE_TASKS');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'SUPPRESSED');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles';

-- AlterTable
ALTER TABLE "TaskAssignee" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "template" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_dedupeKey_key" ON "EmailDelivery"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_sendAfter_idx" ON "EmailDelivery"("status", "sendAfter");

-- CreateIndex
CREATE INDEX "EmailDelivery_boardId_createdAt_idx" ON "EmailDelivery"("boardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_boardId_userId_category_key" ON "NotificationPreference"("boardId", "userId", "category");

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
