-- AlterTable
ALTER TABLE `RideRequest` ADD COLUMN `agreedPrice` DECIMAL(10, 2) NULL,
    ADD COLUMN `driverCompletedConfirmedAt` DATETIME(3) NULL,
    ADD COLUMN `passengerCompletedConfirmedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `RideOffer` (
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

-- AddForeignKey
ALTER TABLE `RideOffer` ADD CONSTRAINT `RideOffer_passengerId_fkey` FOREIGN KEY (`passengerId`) REFERENCES `PassengerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideOffer` ADD CONSTRAINT `RideOffer_committedDriverId_fkey` FOREIGN KEY (`committedDriverId`) REFERENCES `DriverProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideOffer` ADD CONSTRAINT `RideOffer_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `RideRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
