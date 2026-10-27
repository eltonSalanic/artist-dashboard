-- CreateTable
CREATE TABLE "ItemLink" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "taskId" UUID,
    "eventId" UUID,
    "goalId" UUID,
    "reminderId" UUID,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemLink_boardId_taskId_idx" ON "ItemLink"("boardId", "taskId");

-- CreateIndex
CREATE INDEX "ItemLink_boardId_eventId_idx" ON "ItemLink"("boardId", "eventId");

-- CreateIndex
CREATE INDEX "ItemLink_boardId_goalId_idx" ON "ItemLink"("boardId", "goalId");

-- CreateIndex
CREATE INDEX "ItemLink_boardId_reminderId_idx" ON "ItemLink"("boardId", "reminderId");

-- CreateIndex
CREATE INDEX "ItemLink_taskId_idx" ON "ItemLink"("taskId");

-- CreateIndex
CREATE INDEX "ItemLink_eventId_idx" ON "ItemLink"("eventId");

-- CreateIndex
CREATE INDEX "ItemLink_goalId_idx" ON "ItemLink"("goalId");

-- CreateIndex
CREATE INDEX "ItemLink_reminderId_idx" ON "ItemLink"("reminderId");

-- CreateIndex
CREATE INDEX "ItemLink_createdById_idx" ON "ItemLink"("createdById");

-- AddForeignKey
ALTER TABLE "ItemLink" ADD CONSTRAINT "ItemLink_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLink" ADD CONSTRAINT "ItemLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLink" ADD CONSTRAINT "ItemLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLink" ADD CONSTRAINT "ItemLink_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLink" ADD CONSTRAINT "ItemLink_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLink" ADD CONSTRAINT "ItemLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Each link belongs to exactly one item; the API checks the board matches.
ALTER TABLE "ItemLink" ADD CONSTRAINT "ItemLink_one_parent" CHECK (num_nonnulls("taskId", "eventId", "goalId", "reminderId") = 1);

-- Links are served by the authenticated Nest API, never the public Data API.
ALTER TABLE "ItemLink" ENABLE ROW LEVEL SECURITY;
