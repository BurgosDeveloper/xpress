-- Expand ServiceType enum from ('TAXI','MOTO') to ('CARRO','MOTO','MOTO_CARGA','CARRO_CARGA')
-- and migrate existing data: TAXI -> CARRO.

-- Drop FK that references PricingConfig(serviceType) so we can safely alter both enums
ALTER TABLE `PricingAddon` DROP FOREIGN KEY `PricingAddon_serviceType_fkey`;

-- 1) Temporarily expand ENUMs to allow both old (TAXI) and new (CARRO, *_CARGA) values
ALTER TABLE `DriverProfile`
  MODIFY `serviceType` ENUM('TAXI', 'CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

ALTER TABLE `PricingConfig`
  MODIFY `serviceType` ENUM('TAXI', 'CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

ALTER TABLE `PricingAddon`
  MODIFY `serviceType` ENUM('TAXI', 'CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

ALTER TABLE `RideRequest`
  MODIFY `serviceTypeWanted` ENUM('TAXI', 'CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

ALTER TABLE `RideOffer`
  MODIFY `serviceTypeWanted` ENUM('TAXI', 'CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

-- 2) Data migration: rename TAXI to CARRO
UPDATE `DriverProfile` SET `serviceType` = 'CARRO' WHERE `serviceType` = 'TAXI';
UPDATE `PricingConfig` SET `serviceType` = 'CARRO' WHERE `serviceType` = 'TAXI';
UPDATE `PricingAddon` SET `serviceType` = 'CARRO' WHERE `serviceType` = 'TAXI';
UPDATE `RideRequest` SET `serviceTypeWanted` = 'CARRO' WHERE `serviceTypeWanted` = 'TAXI';
UPDATE `RideOffer` SET `serviceTypeWanted` = 'CARRO' WHERE `serviceTypeWanted` = 'TAXI';

-- 3) Final ENUMs (remove TAXI)
ALTER TABLE `DriverProfile`
  MODIFY `serviceType` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

ALTER TABLE `PricingConfig`
  MODIFY `serviceType` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

ALTER TABLE `PricingAddon`
  MODIFY `serviceType` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

ALTER TABLE `RideRequest`
  MODIFY `serviceTypeWanted` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

ALTER TABLE `RideOffer`
  MODIFY `serviceTypeWanted` ENUM('CARRO', 'MOTO', 'MOTO_CARGA', 'CARRO_CARGA') NOT NULL;

-- Recreate FK
ALTER TABLE `PricingAddon`
  ADD CONSTRAINT `PricingAddon_serviceType_fkey`
  FOREIGN KEY (`serviceType`) REFERENCES `PricingConfig`(`serviceType`) ON DELETE CASCADE ON UPDATE CASCADE;
