-- CreateTable
CREATE TABLE "Note" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "taskId" UUID,
    "eventId" UUID,
    "goalId" UUID,
    "reminderId" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "sortOrder" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_taskId_idx" ON "Note"("taskId");

-- CreateIndex
CREATE INDEX "Note_eventId_idx" ON "Note"("eventId");

-- CreateIndex
CREATE INDEX "Note_goalId_idx" ON "Note"("goalId");

-- CreateIndex
CREATE INDEX "Note_reminderId_idx" ON "Note"("reminderId");

-- CreateIndex
CREATE INDEX "Note_boardId_idx" ON "Note"("boardId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one parent per note.
ALTER TABLE "Note" ADD CONSTRAINT "Note_one_parent" CHECK (num_nonnulls("taskId", "eventId", "goalId", "reminderId") = 1);

-- Move each existing description into a first note titled "Notes".
INSERT INTO "Note" ("id", "boardId", "taskId", "title", "body", "sortOrder", "updatedAt")
  SELECT gen_random_uuid(), "boardId", "id", 'Notes', "description", 1000, CURRENT_TIMESTAMP FROM "Task" WHERE btrim(coalesce("description", '')) <> '';
INSERT INTO "Note" ("id", "boardId", "eventId", "title", "body", "sortOrder", "updatedAt")
  SELECT gen_random_uuid(), "boardId", "id", 'Notes', "description", 1000, CURRENT_TIMESTAMP FROM "Event" WHERE btrim(coalesce("description", '')) <> '';
INSERT INTO "Note" ("id", "boardId", "goalId", "title", "body", "sortOrder", "updatedAt")
  SELECT gen_random_uuid(), "boardId", "id", 'Notes', "description", 1000, CURRENT_TIMESTAMP FROM "Goal" WHERE btrim(coalesce("description", '')) <> '';
INSERT INTO "Note" ("id", "boardId", "reminderId", "title", "body", "sortOrder", "updatedAt")
  SELECT gen_random_uuid(), "boardId", "id", 'Notes', "description", 1000, CURRENT_TIMESTAMP FROM "Reminder" WHERE btrim(coalesce("description", '')) <> '';

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "Reminder" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "description";
