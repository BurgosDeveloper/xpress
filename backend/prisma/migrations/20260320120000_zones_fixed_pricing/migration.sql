-- Zonas con precio fijo (San Cristóbal <-> zonas externas)

-- CreateTable
CREATE TABLE IF NOT EXISTS "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHub" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "geojson" JSONB NOT NULL,
    "minLat" DECIMAL(10,7) NOT NULL,
    "minLng" DECIMAL(10,7) NOT NULL,
    "maxLat" DECIMAL(10,7) NOT NULL,
    "maxLng" DECIMAL(10,7) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ZoneFixedPrice" (
    "id" TEXT NOT NULL,
    "hubZoneId" TEXT NOT NULL,
    "targetZoneId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "amountCop" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoneFixedPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ZoneFixedPrice_hubZoneId_targetZoneId_serviceType_key" ON "ZoneFixedPrice"("hubZoneId", "targetZoneId", "serviceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Zone_isActive_isHub_idx" ON "Zone"("isActive", "isHub");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ZoneFixedPrice_serviceType_isActive_idx" ON "ZoneFixedPrice"("serviceType", "isActive");

-- AlterTable
ALTER TABLE "RideRequest" ADD COLUMN IF NOT EXISTS "isFixedPrice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RideRequest" ADD COLUMN IF NOT EXISTS "fixedPriceCop" DECIMAL(10,2);
ALTER TABLE "RideRequest" ADD COLUMN IF NOT EXISTS "fixedHubZoneId" TEXT;
ALTER TABLE "RideRequest" ADD COLUMN IF NOT EXISTS "fixedTargetZoneId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RideRequest_isFixedPrice_idx" ON "RideRequest"("isFixedPrice");
CREATE INDEX IF NOT EXISTS "RideRequest_fixedHubZoneId_idx" ON "RideRequest"("fixedHubZoneId");
CREATE INDEX IF NOT EXISTS "RideRequest_fixedTargetZoneId_idx" ON "RideRequest"("fixedTargetZoneId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ZoneFixedPrice" ADD CONSTRAINT "ZoneFixedPrice_hubZoneId_fkey" FOREIGN KEY ("hubZoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ZoneFixedPrice" ADD CONSTRAINT "ZoneFixedPrice_targetZoneId_fkey" FOREIGN KEY ("targetZoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_fixedHubZoneId_fkey" FOREIGN KEY ("fixedHubZoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_fixedTargetZoneId_fkey" FOREIGN KEY ("fixedTargetZoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
