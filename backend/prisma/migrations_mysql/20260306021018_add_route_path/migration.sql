-- AlterTable
ALTER TABLE `RideOffer` ADD COLUMN `routePath` JSON NULL;

-- AlterTable
ALTER TABLE `RideRequest` ADD COLUMN `routePath` JSON NULL;
