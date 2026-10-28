-- CreateEnum
CREATE TYPE "ShowStatusCategory" AS ENUM ('HOLD', 'BOOKED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'SHOW_STATUS_CHANGED';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "showStatusId" UUID;

-- CreateTable
CREATE TABLE "ShowStatus" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "category" "ShowStatusCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowStatus_boardId_idx" ON "ShowStatus"("boardId");

-- CreateIndex
CREATE INDEX "Event_showStatusId_idx" ON "Event"("showStatusId");

-- AddForeignKey
ALTER TABLE "ShowStatus" ADD CONSTRAINT "ShowStatus_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_showStatusId_fkey" FOREIGN KEY ("showStatusId") REFERENCES "ShowStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing band gets the defaults (DEFAULT_SHOW_STATUSES in
-- packages/shared/src/statuses.ts) ...
INSERT INTO "ShowStatus" ("id", "boardId", "name", "color", "sortOrder", "category")
SELECT gen_random_uuid(), b."id", d."name", d."color", d."sortOrder", d."category"::"ShowStatusCategory"
FROM "Board" b
CROSS JOIN (VALUES
    ('Hold', '#8b8fa3', 0, 'HOLD'),
    ('Details pending', '#f5a623', 1, 'BOOKED'),
    ('Confirmed', '#2fbf71', 2, 'BOOKED'),
    ('Cancelled', '#e5484d', 3, 'CANCELLED')
) AS d("name", "color", "sortOrder", "category");

-- ... and every show already on a calendar was meant, so it is Confirmed.
UPDATE "Event" e
SET "showStatusId" = s."id"
FROM "ShowStatus" s
WHERE e."type" = 'SHOW' AND s."boardId" = e."boardId" AND s."name" = 'Confirmed';

-- Shows always have a status; meetings and rehearsals never do.
ALTER TABLE "Event" ADD CONSTRAINT "Event_show_status" CHECK (("type" = 'SHOW') = ("showStatusId" IS NOT NULL));
