-- Persist driver "arrived" notify timestamp for client catch-up
ALTER TABLE "RideRequest" ADD COLUMN IF NOT EXISTS "driverArrivedNotifiedAt" TIMESTAMP(3);
