-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedWithId" UUID;

-- CreateIndex
CREATE INDEX "Event_boardId_archivedAt_idx" ON "Event"("boardId", "archivedAt");

-- CreateIndex
CREATE INDEX "Goal_boardId_archivedAt_idx" ON "Goal"("boardId", "archivedAt");

-- CreateIndex
CREATE INDEX "Reminder_boardId_archivedAt_idx" ON "Reminder"("boardId", "archivedAt");

-- CreateIndex
CREATE INDEX "Task_boardId_archivedAt_idx" ON "Task"("boardId", "archivedAt");

-- CreateIndex
CREATE INDEX "Task_archivedWithId_idx" ON "Task"("archivedWithId");
