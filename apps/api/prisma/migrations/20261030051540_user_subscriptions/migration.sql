/*
  Warnings:

  - You are about to drop the column `boardId` on the `BillingWebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the `BoardSubscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BoardSubscription" DROP CONSTRAINT "BoardSubscription_boardId_fkey";

-- AlterTable
ALTER TABLE "BillingWebhookEvent" DROP COLUMN "boardId",
ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "ownerId" UUID;

-- DropTable
DROP TABLE "BoardSubscription";

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entitlement" TEXT NOT NULL DEFAULT 'band_wall',
    "status" "SubscriptionStatus" NOT NULL,
    "store" "SubscriptionStore" NOT NULL,
    "productId" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "willRenew" BOOLEAN NOT NULL DEFAULT true,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "revenueCatAppUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "UserSubscription"("userId");

-- CreateIndex
CREATE INDEX "Board_ownerId_idx" ON "Board"("ownerId");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing band's owner is its oldest admin, the closest thing to "the
-- person who started it" the data has. A band with no admin stays ownerless,
-- which locks it once billing is enforced, until someone sets an owner by hand.
UPDATE "Board" b
SET "ownerId" = (
  SELECT m."userId"
  FROM "Membership" m
  WHERE m."boardId" = b."id" AND m."role" = 'ADMIN'
  ORDER BY m."createdAt" ASC, m."id" ASC
  LIMIT 1
);

-- Like the table it replaces: served only by the authenticated Nest API, never
-- Supabase's public Data API. RLS on with no policies keeps the anon and
-- authenticated roles out.
ALTER TABLE "UserSubscription" ENABLE ROW LEVEL SECURITY;
