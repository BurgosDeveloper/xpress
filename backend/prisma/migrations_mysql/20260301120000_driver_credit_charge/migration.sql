-- AlterTable
ALTER TABLE `RideRequest`
  ADD COLUMN `driverCreditChargedCop` INTEGER NULL,
  ADD COLUMN `driverCreditChargedAt` DATETIME(3) NULL;
