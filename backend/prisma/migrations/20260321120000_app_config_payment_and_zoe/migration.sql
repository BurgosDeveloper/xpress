-- Add WhatsApp operator phone + payment methods info
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "zoeWhatsappPhone" TEXT;

ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "paymentBancolombiaHolder" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "paymentBancolombiaDocument" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "paymentBancolombiaAccountType" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "paymentBancolombiaAccountNumber" TEXT;

ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "paymentZelleHolder" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "paymentZelleEmail" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "paymentZellePhone" TEXT;
