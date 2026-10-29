-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStore" AS ENUM ('APP_STORE', 'PLAY_STORE', 'STRIPE', 'PROMOTIONAL');

-- CreateTable
CREATE TABLE "BoardSubscription" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "entitlement" TEXT NOT NULL DEFAULT 'band_wall',
    "status" "SubscriptionStatus" NOT NULL,
    "store" "SubscriptionStore" NOT NULL,
    "productId" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "willRenew" BOOLEAN NOT NULL DEFAULT true,
    "revenueCatAppUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "boardId" UUID,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardSubscription_boardId_key" ON "BoardSubscription"("boardId");

-- AddForeignKey
ALTER TABLE "BoardSubscription" ADD CONSTRAINT "BoardSubscription_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Billing rows are served only by the authenticated Nest API (and written by
-- the RevenueCat webhook), never Supabase's public Data API: RLS on with no
-- policies means the anon and authenticated roles see nothing.
ALTER TABLE "BoardSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingWebhookEvent" ENABLE ROW LEVEL SECURITY;
