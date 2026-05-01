-- AlterTable
ALTER TABLE `AppConfig` ADD COLUMN `driverCreditChargePercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    MODIFY `id` VARCHAR(191) NOT NULL DEFAULT 'global';

-- AlterTable
ALTER TABLE `DriverProfile` MODIFY `status` ENUM('OBSERVATION', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE `PricingConfig` ADD COLUMN `includedMeters` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `stepMeters` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `stepPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `RideRequest` ADD COLUMN `pricingIncludedMeters` INTEGER NULL,
    ADD COLUMN `pricingStepMeters` INTEGER NULL,
    ADD COLUMN `pricingStepPrice` DECIMAL(10, 2) NULL;
