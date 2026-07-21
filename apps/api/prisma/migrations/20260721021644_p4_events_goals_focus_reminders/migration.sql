-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SHOW', 'MEETING', 'REHEARSAL');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('YEARLY', 'MONTHLY', 'DAILY');

-- CreateEnum
CREATE TYPE "FocusPeriod" AS ENUM ('WEEK', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "eventId" UUID,
ADD COLUMN     "goalId" UUID;

-- CreateTable
CREATE TABLE "Goal" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "period" "GoalPeriod" NOT NULL DEFAULT 'MONTHLY',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusPin" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "period" "FocusPeriod" NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Goal_boardId_period_idx" ON "Goal"("boardId", "period");

-- CreateIndex
CREATE INDEX "Event_boardId_startsAt_idx" ON "Event"("boardId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "FocusPin_boardId_period_key" ON "FocusPin"("boardId", "period");

-- CreateIndex
CREATE INDEX "Reminder_boardId_remindAt_idx" ON "Reminder"("boardId", "remindAt");

-- CreateIndex
CREATE INDEX "Task_goalId_idx" ON "Task"("goalId");

-- CreateIndex
CREATE INDEX "Task_eventId_idx" ON "Task"("eventId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusPin" ADD CONSTRAINT "FocusPin_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
