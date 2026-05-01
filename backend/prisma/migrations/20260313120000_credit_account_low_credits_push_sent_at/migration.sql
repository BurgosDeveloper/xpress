-- Add low-credit push throttle timestamp
ALTER TABLE "CreditAccount" ADD COLUMN "lowCreditsPushSentAt" TIMESTAMP(3);
