-- Add fx rates to AppConfig (COP per 1 unit of currency)
ALTER TABLE "AppConfig" ADD COLUMN "fxCopPerUsd" DECIMAL(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "AppConfig" ADD COLUMN "fxCopPerVes" DECIMAL(18,6) NOT NULL DEFAULT 0;
