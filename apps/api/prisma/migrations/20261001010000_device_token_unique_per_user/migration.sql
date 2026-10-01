-- A globally-unique push token meant that re-registering it under a different
-- account reassigned the row — so knowing someone's token was enough to
-- redirect their notifications to your account and silence their phone.
--
-- Scoped per user instead. Handing a device to someone else is handled by
-- signing out, which deletes the row, rather than by re-registration.
DROP INDEX "DeviceToken_token_key";

CREATE UNIQUE INDEX "DeviceToken_userId_token_key" ON "DeviceToken" ("userId", "token");

-- Expo reports dead tokens without reference to a user, so the prune path
-- still needs to find rows by token alone.
CREATE INDEX "DeviceToken_token_idx" ON "DeviceToken" ("token");
