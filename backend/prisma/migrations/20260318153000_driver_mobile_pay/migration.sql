-- Add Pago Móvil fields to DriverProfile

ALTER TABLE "DriverProfile" ADD COLUMN IF NOT EXISTS "mobilePayBank" TEXT;
ALTER TABLE "DriverProfile" ADD COLUMN IF NOT EXISTS "mobilePayDocument" TEXT;
ALTER TABLE "DriverProfile" ADD COLUMN IF NOT EXISTS "mobilePayPhone" TEXT;
