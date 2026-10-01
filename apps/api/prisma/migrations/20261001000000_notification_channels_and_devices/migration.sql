-- Generalises the email outbox into a notification outbox with a channel, and
-- adds Expo device tokens.
--
-- Hand-written. `prisma migrate dev` wanted to DROP "EmailDelivery" (33 rows at
-- the time) and recreate it under the new name, which would have thrown away
-- every delivery record and, with it, the dedupe history that stops already-sent
-- mail being sent again. Everything below renames in place instead.

-- 1. Enums: rename the two that were email-specific in name only.
ALTER TYPE "EmailCategory" RENAME TO "NotificationCategory";
ALTER TYPE "EmailStatus" RENAME TO "NotificationStatus";

CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH');
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- 2. The outbox table, renamed in place so its rows survive.
ALTER TABLE "EmailDelivery" RENAME TO "NotificationDelivery";

-- Postgres keeps the old names on dependent objects after a table rename;
-- renaming them too keeps Prisma's drift detection quiet.
ALTER TABLE "NotificationDelivery" RENAME CONSTRAINT "EmailDelivery_pkey" TO "NotificationDelivery_pkey";
ALTER TABLE "NotificationDelivery" RENAME CONSTRAINT "EmailDelivery_boardId_fkey" TO "NotificationDelivery_boardId_fkey";
ALTER TABLE "NotificationDelivery" RENAME CONSTRAINT "EmailDelivery_userId_fkey" TO "NotificationDelivery_userId_fkey";
ALTER INDEX "EmailDelivery_status_sendAfter_idx" RENAME TO "NotificationDelivery_status_sendAfter_idx";
ALTER INDEX "EmailDelivery_boardId_createdAt_idx" RENAME TO "NotificationDelivery_boardId_createdAt_idx";

-- 3. Channel on the outbox. Existing rows are all email, which is the default.
ALTER TABLE "NotificationDelivery"
  ADD COLUMN "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL';

-- dedupeKey alone is no longer unique: one trigger legitimately produces an
-- email row and a push row for the same recipient, and they must not dedupe
-- each other away.
DROP INDEX "EmailDelivery_dedupeKey_key";
CREATE UNIQUE INDEX "NotificationDelivery_dedupeKey_channel_key"
  ON "NotificationDelivery" ("dedupeKey", "channel");

-- 4. Preferences gain the same dimension: muting email for a category must not
-- mute push for it. Pre-existing rows are email preferences.
ALTER TABLE "NotificationPreference"
  ADD COLUMN "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL';

DROP INDEX "NotificationPreference_boardId_userId_category_key";
CREATE UNIQUE INDEX "NotificationPreference_boardId_userId_category_channel_key"
  ON "NotificationPreference" ("boardId", "userId", "category", "channel");

-- 5. Expo push tokens. One row per install rather than per user, so the same
-- person on a phone and a tablet gets both.
CREATE TABLE "DeviceToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken" ("token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken" ("userId");

ALTER TABLE "DeviceToken"
  ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
