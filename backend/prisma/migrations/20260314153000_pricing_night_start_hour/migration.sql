-- Add per-service-type night start hour (0-23)
ALTER TABLE "PricingConfig"
ADD COLUMN "nightStartHour" INTEGER NOT NULL DEFAULT 20;
