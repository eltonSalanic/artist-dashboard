-- Settling a show is gone: a show's money is ordinary entries now.
DROP INDEX IF EXISTS "FinanceEntry_settleKey_key";
ALTER TABLE "FinanceEntry" DROP COLUMN IF EXISTS "settleKey";
