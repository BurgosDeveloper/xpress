-- AlterTable
ALTER TABLE `DriverProfile` ADD COLUMN `age` INTEGER NULL,
    ADD COLUMN `firstName` VARCHAR(191) NULL,
    ADD COLUMN `homeAddress` VARCHAR(191) NULL,
    ADD COLUMN `lastName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PassengerProfile` ADD COLUMN `age` INTEGER NULL,
    ADD COLUMN `firstName` VARCHAR(191) NULL,
    ADD COLUMN `homeAddress` VARCHAR(191) NULL,
    ADD COLUMN `lastName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Vehicle` ADD COLUMN `plate` VARCHAR(191) NULL;
