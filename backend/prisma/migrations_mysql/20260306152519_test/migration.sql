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

-- AddForeignKey
ALTER TABLE `RideCandidate` ADD CONSTRAINT `RideCandidate_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `RideRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideCandidate` ADD CONSTRAINT `RideCandidate_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `DriverProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
