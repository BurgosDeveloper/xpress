-- Add night base fare by service type
ALTER TABLE "PricingConfig" ADD COLUMN "nightBaseFare" DECIMAL(10, 2) NOT NULL DEFAULT 0;
