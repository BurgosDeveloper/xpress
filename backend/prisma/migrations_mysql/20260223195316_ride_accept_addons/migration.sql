-- AlterTable
ALTER TABLE `RideRequest` ADD COLUMN `acceptedAt` DATETIME(3) NULL,
    ADD COLUMN `assignedByAdmin` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `status` ENUM('OPEN', 'ASSIGNED', 'ACCEPTED', 'MATCHED', 'IN_PROGRESS', 'CANCELLED', 'EXPIRED', 'COMPLETED') NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE `PricingAddon` (
    `id` VARCHAR(191) NOT NULL,
    `serviceType` ENUM('TAXI', 'MOTO') NOT NULL,
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
CREATE TABLE `RideAddon` (
    `id` VARCHAR(191) NOT NULL,
    `rideId` VARCHAR(191) NOT NULL,
    `addonId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RideAddon_addonId_idx`(`addonId`),
    UNIQUE INDEX `RideAddon_rideId_addonId_key`(`rideId`, `addonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PricingAddon` ADD CONSTRAINT `PricingAddon_serviceType_fkey` FOREIGN KEY (`serviceType`) REFERENCES `PricingConfig`(`serviceType`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideAddon` ADD CONSTRAINT `RideAddon_rideId_fkey` FOREIGN KEY (`rideId`) REFERENCES `RideRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideAddon` ADD CONSTRAINT `RideAddon_addonId_fkey` FOREIGN KEY (`addonId`) REFERENCES `PricingAddon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
