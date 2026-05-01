-- Remove global night pricing from AppConfig.
-- Night base fare and start hour are configured per service type in PricingConfig.

ALTER TABLE "AppConfig" DROP COLUMN IF EXISTS "nightBaseFare";
ALTER TABLE "AppConfig" DROP COLUMN IF EXISTS "nightStartHour";
