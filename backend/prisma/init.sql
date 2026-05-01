-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'DRIVER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'DRIVER', 'ADMIN') NOT NULL,
    `phoneRaw` VARCHAR(191) NOT NULL,
    `phoneLast3` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PasswordResetRequest_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PasswordResetRequest_expiresAt_consumedAt_idx`(`expiresAt`, `consumedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `platform` ENUM('ANDROID', 'IOS') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PushToken_token_key`(`token`),
    INDEX `PushToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PassengerProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `homeAddress` VARCHAR(191) NULL,
    `age` INTEGER NULL,
    `photoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PassengerProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriverProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `photoUrl` VARCHAR(191) NOT NULL,
    `serviceType` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL,
    `homeAddress` VARCHAR(191) NULL,
    `age` INTEGER NULL,
    `creditChargeFixedCop` INTEGER NULL,
    `status` ENUM('OBSERVATION', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
    `isAvailable` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DriverProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppConfig` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'global',
    `nightBaseFare` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `nightStartHour` INTEGER NOT NULL DEFAULT 20,
    `driverCreditChargeMode` ENUM('SERVICE_VALUE', 'FIXED_AMOUNT') NOT NULL DEFAULT 'SERVICE_VALUE',
    `driverCreditChargePercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriverLocation` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `lat` DECIMAL(10, 7) NOT NULL,
    `lng` DECIMAL(10, 7) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DriverLocation_driverId_key`(`driverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `plate` VARCHAR(191) NULL,
    `year` INTEGER NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `doors` INTEGER NULL,
    `hasAC` BOOLEAN NOT NULL DEFAULT false,
    `hasTrunk` BOOLEAN NOT NULL DEFAULT false,
    `allowsPets` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vehicle_driverId_key`(`driverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriverDocument` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `type` ENUM('LICENSE', 'VEHICLE_CERT', 'VEHICLE_PHOTO') NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DriverDocument_driverId_type_idx`(`driverId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PricingConfig` (
    `id` VARCHAR(191) NOT NULL,
    `serviceType` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL,
    `baseFare` DECIMAL(10, 2) NOT NULL,
    `perKm` DECIMAL(10, 2) NOT NULL,
    `includedMeters` INTEGER NOT NULL DEFAULT 0,
    `stepMeters` INTEGER NOT NULL DEFAULT 0,
    `stepPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `acSurcharge` DECIMAL(10, 2) NOT NULL,
    `trunkSurcharge` DECIMAL(10, 2) NOT NULL,
    `petsSurcharge` DECIMAL(10, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PricingConfig_serviceType_key`(`serviceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PricingAddon` (
    `id` VARCHAR(191) NOT NULL,
    `serviceType` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PricingAddon_serviceType_isActive_idx`(`serviceType`, `isActive`),
    UNIQUE INDEX `PricingAddon_serviceType_name_key`(`serviceType`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `balanceCop` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreditAccount_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideRequest` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `serviceTypeWanted` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL,
    `pickupLat` DECIMAL(10, 7) NOT NULL,
    `pickupLng` DECIMAL(10, 7) NOT NULL,
    `pickupAddress` VARCHAR(191) NULL,
    `dropoffLat` DECIMAL(10, 7) NOT NULL,
    `dropoffLng` DECIMAL(10, 7) NOT NULL,
    `dropoffAddress` VARCHAR(191) NULL,
    `distanceMeters` INTEGER NULL,
    `durationSeconds` INTEGER NULL,
    `routePath` JSON NULL,
    `wantsAC` BOOLEAN NOT NULL DEFAULT false,
    `wantsTrunk` BOOLEAN NOT NULL DEFAULT false,
    `wantsPets` BOOLEAN NOT NULL DEFAULT false,
    `estimatedPrice` DECIMAL(10, 2) NOT NULL,
    `agreedPrice` DECIMAL(10, 2) NULL,
    `pricingBaseFare` DECIMAL(10, 2) NULL,
    `pricingPerKm` DECIMAL(10, 2) NULL,
    `pricingIncludedMeters` INTEGER NULL,
    `pricingStepMeters` INTEGER NULL,
    `pricingStepPrice` DECIMAL(10, 2) NULL,
    `pricingAcSurcharge` DECIMAL(10, 2) NULL,
    `pricingTrunkSurcharge` DECIMAL(10, 2) NULL,
    `pricingPetsSurcharge` DECIMAL(10, 2) NULL,
    `meterDistanceMeters` INTEGER NOT NULL DEFAULT 0,
    `meterPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `searchRadiusM` INTEGER NOT NULL DEFAULT 2000,
    `status` ENUM('OPEN', 'ASSIGNED', 'ACCEPTED', 'MATCHED', 'IN_PROGRESS', 'CANCELLED', 'EXPIRED', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `expiresAt` DATETIME(3) NULL,
    `matchedDriverId` VARCHAR(191) NULL,
    `matchedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `assignedByAdmin` BOOLEAN NOT NULL DEFAULT false,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `driverCreditChargedCop` INTEGER NULL,
    `driverCreditChargedAt` DATETIME(3) NULL,
    `passengerCompletedConfirmedAt` DATETIME(3) NULL,
    `driverCompletedConfirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RideRequest_passengerId_status_idx`(`passengerId`, `status`),
    INDEX `RideRequest_matchedDriverId_idx`(`matchedDriverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideCandidate` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `status` ENUM('OFFERED', 'REJECTED', 'WITHDRAWN', 'SELECTED') NOT NULL DEFAULT 'OFFERED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RideCandidate_rideId_status_createdAt_idx`(`rideId`, `status`, `createdAt`),
    INDEX `RideCandidate_driverId_status_createdAt_idx`(`driverId`, `status`, `createdAt`),
    UNIQUE INDEX `RideCandidate_rideId_driverId_key`(`rideId`, `driverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideOffer` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `serviceTypeWanted` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL,
    `pickupLat` DECIMAL(10, 7) NOT NULL,
    `pickupLng` DECIMAL(10, 7) NOT NULL,
    `pickupAddress` VARCHAR(191) NULL,
    `dropoffLat` DECIMAL(10, 7) NOT NULL,
    `dropoffLng` DECIMAL(10, 7) NOT NULL,
    `dropoffAddress` VARCHAR(191) NULL,
    `distanceMeters` INTEGER NULL,
    `durationSeconds` INTEGER NULL,
    `routePath` JSON NULL,
    `estimatedPrice` DECIMAL(10, 2) NOT NULL,
    `offeredPrice` DECIMAL(10, 2) NOT NULL,
    `searchRadiusM` INTEGER NOT NULL DEFAULT 5000,
    `status` ENUM('OPEN', 'COMMITTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'OPEN',
    `expiresAt` DATETIME(3) NULL,
    `committedDriverId` VARCHAR(191) NULL,
    `committedAt` DATETIME(3) NULL,
    `rideId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RideOffer_rideId_key`(`rideId`),
    INDEX `RideOffer_passengerId_status_createdAt_idx`(`passengerId`, `status`, `createdAt`),
    INDEX `RideOffer_committedDriverId_idx`(`committedDriverId`),
    INDEX `RideOffer_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideAddon` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `addonId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RideAddon_addonId_idx`(`addonId`),
    UNIQUE INDEX `RideAddon_rideId_addonId_key`(`rideId`, `addonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rating` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `direction` ENUM('PASSENGER_TO_DRIVER', 'DRIVER_TO_PASSENGER') NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NOT NULL,
    `stars` INTEGER NOT NULL,
    `comment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Rating_toUserId_idx`(`toUserId`),
    UNIQUE INDEX `Rating_rideId_direction_key`(`rideId`, `direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordResetRequest` ADD CONSTRAINT `PasswordResetRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushToken` ADD CONSTRAINT `PushToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PassengerProfile` ADD CONSTRAINT `PassengerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriverProfile` ADD CONSTRAINT `DriverProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriverLocation` ADD CONSTRAINT `DriverLocation_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `DriverProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `DriverProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DriverDocument` ADD CONSTRAINT `DriverDocument_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `DriverProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PricingAddon` ADD CONSTRAINT `PricingAddon_serviceType_fkey` FOREIGN KEY (`serviceType`) REFERENCES `PricingConfig`(`serviceType`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditAccount` ADD CONSTRAINT `CreditAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideRequest` ADD CONSTRAINT `RideRequest_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `PassengerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideRequest` ADD CONSTRAINT `RideRequest_matchedDriverId_fkey` FOREIGN KEY (`matchedDriverId`) REFERENCES `DriverProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideCandidate` ADD CONSTRAINT `RideCandidate_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `RideRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideCandidate` ADD CONSTRAINT `RideCandidate_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `DriverProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideOffer` ADD CONSTRAINT `RideOffer_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `PassengerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideOffer` ADD CONSTRAINT `RideOffer_committedDriverId_fkey` FOREIGN KEY (`committedDriverId`) REFERENCES `DriverProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideOffer` ADD CONSTRAINT `RideOffer_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `RideRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideAddon` ADD CONSTRAINT `RideAddon_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `RideRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideAddon` ADD CONSTRAINT `RideAddon_addonId_fkey` FOREIGN KEY (`addonId`) REFERENCES `PricingAddon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rating` ADD CONSTRAINT `Rating_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `RideRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rating` ADD CONSTRAINT `Rating_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rating` ADD CONSTRAINT `Rating_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

