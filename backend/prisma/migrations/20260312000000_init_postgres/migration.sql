-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'DRIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('OBSERVATION', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LICENSE', 'VEHICLE_CERT', 'VEHICLE_PHOTO');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('OPEN', 'ASSIGNED', 'ACCEPTED', 'MATCHED', 'IN_PROGRESS', 'CANCELLED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RideCandidateStatus" AS ENUM ('OFFERED', 'REJECTED', 'WITHDRAWN', 'SELECTED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('OPEN', 'COMMITTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DriverCreditChargeMode" AS ENUM ('SERVICE_VALUE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "RatingDirection" AS ENUM ('PASSENGER_TO_DRIVER', 'DRIVER_TO_PASSENGER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phoneRaw" TEXT NOT NULL,
    "phoneLast3" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassengerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT NOT NULL,
    "homeAddress" TEXT,
    "age" INTEGER,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassengerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "homeAddress" TEXT,
    "age" INTEGER,
    "creditChargeFixedCop" INTEGER,
    "status" "DriverStatus" NOT NULL DEFAULT 'APPROVED',
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "nightBaseFare" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nightStartHour" INTEGER NOT NULL DEFAULT 20,
    "driverCreditChargeMode" "DriverCreditChargeMode" NOT NULL DEFAULT 'SERVICE_VALUE',
    "driverCreditChargePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverLocation" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "plate" TEXT,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "doors" INTEGER,
    "hasAC" BOOLEAN NOT NULL DEFAULT false,
    "hasTrunk" BOOLEAN NOT NULL DEFAULT false,
    "allowsPets" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "perKm" DECIMAL(10,2) NOT NULL,
    "includedMeters" INTEGER NOT NULL DEFAULT 0,
    "stepMeters" INTEGER NOT NULL DEFAULT 0,
    "stepPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "acSurcharge" DECIMAL(10,2) NOT NULL,
    "trunkSurcharge" DECIMAL(10,2) NOT NULL,
    "petsSurcharge" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingAddon" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceCop" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideRequest" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "serviceTypeWanted" "ServiceType" NOT NULL,
    "pickupLat" DECIMAL(10,7) NOT NULL,
    "pickupLng" DECIMAL(10,7) NOT NULL,
    "pickupAddress" TEXT,
    "dropoffLat" DECIMAL(10,7) NOT NULL,
    "dropoffLng" DECIMAL(10,7) NOT NULL,
    "dropoffAddress" TEXT,
    "distanceMeters" INTEGER,
    "durationSeconds" INTEGER,
    "routePath" JSONB,
    "wantsAC" BOOLEAN NOT NULL DEFAULT false,
    "wantsTrunk" BOOLEAN NOT NULL DEFAULT false,
    "wantsPets" BOOLEAN NOT NULL DEFAULT false,
    "estimatedPrice" DECIMAL(10,2) NOT NULL,
    "agreedPrice" DECIMAL(10,2),
    "pricingBaseFare" DECIMAL(10,2),
    "pricingPerKm" DECIMAL(10,2),
    "pricingIncludedMeters" INTEGER,
    "pricingStepMeters" INTEGER,
    "pricingStepPrice" DECIMAL(10,2),
    "pricingAcSurcharge" DECIMAL(10,2),
    "pricingTrunkSurcharge" DECIMAL(10,2),
    "pricingPetsSurcharge" DECIMAL(10,2),
    "meterDistanceMeters" INTEGER NOT NULL DEFAULT 0,
    "meterPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "searchRadiusM" INTEGER NOT NULL DEFAULT 2000,
    "status" "RideStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3),
    "matchedDriverId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "assignedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "driverCreditChargedCop" INTEGER,
    "driverCreditChargedAt" TIMESTAMP(3),
    "passengerCompletedConfirmedAt" TIMESTAMP(3),
    "driverCompletedConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideCandidate" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "RideCandidateStatus" NOT NULL DEFAULT 'OFFERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideOffer" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "serviceTypeWanted" "ServiceType" NOT NULL,
    "pickupLat" DECIMAL(10,7) NOT NULL,
    "pickupLng" DECIMAL(10,7) NOT NULL,
    "pickupAddress" TEXT,
    "dropoffLat" DECIMAL(10,7) NOT NULL,
    "dropoffLng" DECIMAL(10,7) NOT NULL,
    "dropoffAddress" TEXT,
    "distanceMeters" INTEGER,
    "durationSeconds" INTEGER,
    "routePath" JSONB,
    "estimatedPrice" DECIMAL(10,2) NOT NULL,
    "offeredPrice" DECIMAL(10,2) NOT NULL,
    "searchRadiusM" INTEGER NOT NULL DEFAULT 5000,
    "status" "OfferStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3),
    "committedDriverId" TEXT,
    "committedAt" TIMESTAMP(3),
    "rideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideAddon" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "direction" "RatingDirection" NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_userId_createdAt_idx" ON "PasswordResetRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_expiresAt_consumedAt_idx" ON "PasswordResetRequest"("expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PassengerProfile_userId_key" ON "PassengerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "DriverProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverLocation_driverId_key" ON "DriverLocation"("driverId");

-- CreateIndex
CREATE INDEX "DriverLocation_lat_lng_idx" ON "DriverLocation"("lat", "lng");

-- CreateIndex
CREATE INDEX "DriverLocation_updatedAt_idx" ON "DriverLocation"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_driverId_key" ON "Vehicle"("driverId");

-- CreateIndex
CREATE INDEX "DriverDocument_driverId_type_idx" ON "DriverDocument"("driverId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PricingConfig_serviceType_key" ON "PricingConfig"("serviceType");

-- CreateIndex
CREATE INDEX "PricingAddon_serviceType_isActive_idx" ON "PricingAddon"("serviceType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PricingAddon_serviceType_name_key" ON "PricingAddon"("serviceType", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_userId_key" ON "CreditAccount"("userId");

-- CreateIndex
CREATE INDEX "RideRequest_passengerId_status_idx" ON "RideRequest"("passengerId", "status");

-- CreateIndex
CREATE INDEX "RideRequest_matchedDriverId_idx" ON "RideRequest"("matchedDriverId");

-- CreateIndex
CREATE INDEX "RideCandidate_rideId_status_createdAt_idx" ON "RideCandidate"("rideId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RideCandidate_driverId_status_createdAt_idx" ON "RideCandidate"("driverId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RideCandidate_rideId_driverId_key" ON "RideCandidate"("rideId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "RideOffer_rideId_key" ON "RideOffer"("rideId");

-- CreateIndex
CREATE INDEX "RideOffer_passengerId_status_createdAt_idx" ON "RideOffer"("passengerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RideOffer_committedDriverId_idx" ON "RideOffer"("committedDriverId");

-- CreateIndex
CREATE INDEX "RideOffer_status_createdAt_idx" ON "RideOffer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RideAddon_addonId_idx" ON "RideAddon"("addonId");

-- CreateIndex
CREATE UNIQUE INDEX "RideAddon_rideId_addonId_key" ON "RideAddon"("rideId", "addonId");

-- CreateIndex
CREATE INDEX "Rating_toUserId_idx" ON "Rating"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_rideId_direction_key" ON "Rating"("rideId", "direction");

-- AddForeignKey
ALTER TABLE "PasswordResetRequest" ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerProfile" ADD CONSTRAINT "PassengerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingAddon" ADD CONSTRAINT "PricingAddon_serviceType_fkey" FOREIGN KEY ("serviceType") REFERENCES "PricingConfig"("serviceType") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "PassengerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_matchedDriverId_fkey" FOREIGN KEY ("matchedDriverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideCandidate" ADD CONSTRAINT "RideCandidate_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "RideRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideCandidate" ADD CONSTRAINT "RideCandidate_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideOffer" ADD CONSTRAINT "RideOffer_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "PassengerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideOffer" ADD CONSTRAINT "RideOffer_committedDriverId_fkey" FOREIGN KEY ("committedDriverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideOffer" ADD CONSTRAINT "RideOffer_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "RideRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideAddon" ADD CONSTRAINT "RideAddon_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "RideRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideAddon" ADD CONSTRAINT "RideAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "PricingAddon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "RideRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

