-- Add per-service-type night end hour (0-23)
-- Default 23 to preserve historical behavior (night applied from start hour until end of day)
ALTER TABLE "PricingConfig"
ADD COLUMN "nightEndHour" INTEGER NOT NULL DEFAULT 23;
