-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'DRIVER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
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
    `phone` VARCHAR(191) NOT NULL,
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
    `phone` VARCHAR(191) NOT NULL,
    `photoUrl` VARCHAR(191) NOT NULL,
    `serviceType` ENUM('TAXI', 'MOTO') NOT NULL,
    `status` ENUM('OBSERVATION', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'OBSERVATION',
    `isAvailable` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DriverProfile_userId_key`(`userId`),
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
    `serviceType` ENUM('TAXI', 'MOTO') NOT NULL,
    `baseFare` DECIMAL(10, 2) NOT NULL,
    `perKm` DECIMAL(10, 2) NOT NULL,
    `acSurcharge` DECIMAL(10, 2) NOT NULL,
    `trunkSurcharge` DECIMAL(10, 2) NOT NULL,
    `petsSurcharge` DECIMAL(10, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PricingConfig_serviceType_key`(`serviceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideRequest` (
    `id` VARCHAR(191) NOT NULL,
    `passengerId` VARCHAR(191) NOT NULL,
    `serviceTypeWanted` ENUM('TAXI', 'MOTO') NOT NULL,
    `pickupLat` DECIMAL(10, 7) NOT NULL,
    `pickupLng` DECIMAL(10, 7) NOT NULL,
    `pickupAddress` VARCHAR(191) NULL,
    `dropoffLat` DECIMAL(10, 7) NOT NULL,
    `dropoffLng` DECIMAL(10, 7) NOT NULL,
    `dropoffAddress` VARCHAR(191) NULL,
    `distanceMeters` INTEGER NULL,
    `durationSeconds` INTEGER NULL,
    `wantsAC` BOOLEAN NOT NULL DEFAULT false,
    `wantsTrunk` BOOLEAN NOT NULL DEFAULT false,
    `wantsPets` BOOLEAN NOT NULL DEFAULT false,
    `estimatedPrice` DECIMAL(10, 2) NOT NULL,
    `pricingBaseFare` DECIMAL(10, 2) NULL,
    `pricingPerKm` DECIMAL(10, 2) NULL,
    `pricingAcSurcharge` DECIMAL(10, 2) NULL,
    `pricingTrunkSurcharge` DECIMAL(10, 2) NULL,
    `pricingPetsSurcharge` DECIMAL(10, 2) NULL,
    `meterDistanceMeters` INTEGER NOT NULL DEFAULT 0,
    `meterPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `searchRadiusM` INTEGER NOT NULL DEFAULT 2000,
    `status` ENUM('OPEN', 'MATCHED', 'IN_PROGRESS', 'CANCELLED', 'EXPIRED', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `expiresAt` DATETIME(3) NULL,
    `matchedDriverId` VARCHAR(191) NULL,
    `matchedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RideRequest_passengerId_status_idx`(`passengerId`, `status`),
    INDEX `RideRequest_matchedDriverId_idx`(`matchedDriverId`),
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
ALTER TABLE `RideRequest` ADD CONSTRAINT `RideRequest_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `PassengerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideRequest` ADD CONSTRAINT `RideRequest_matchedDriverId_fkey` FOREIGN KEY (`matchedDriverId`) REFERENCES `DriverProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rating` ADD CONSTRAINT `Rating_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `RideRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rating` ADD CONSTRAINT `Rating_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rating` ADD CONSTRAINT `Rating_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
