-- Dev-only: datos ficticios para pruebas en 2 teléfonos
-- - PricingConfig (TAXI/MOTO)
-- - Cliente demo (USER) + PassengerProfile
-- - Chofer demo (DRIVER) aprobado + DriverProfile + DriverLocation + Vehicle
--
-- Credenciales:
-- - Cliente: cliente@xpress.local / xpress_test
-- - Chofer:  chofer@xpress.local / xpress_test
--
-- Nota: idempotente (no duplica si ya existe por email/serviceType)

SET @now := NOW(3);

-- -----------------------------
-- Pricing (mínimo para createRide)
-- -----------------------------
INSERT INTO PricingConfig (id, serviceType, baseFare, perKm, acSurcharge, trunkSurcharge, petsSurcharge, updatedAt, createdAt)
SELECT 'pricing_taxi', 'TAXI', 1200.00, 450.00, 250.00, 200.00, 200.00, @now, @now
WHERE NOT EXISTS (SELECT 1 FROM PricingConfig WHERE serviceType = 'TAXI');

INSERT INTO PricingConfig (id, serviceType, baseFare, perKm, acSurcharge, trunkSurcharge, petsSurcharge, updatedAt, createdAt)
SELECT 'pricing_moto', 'MOTO', 800.00, 300.00, 0.00, 0.00, 0.00, @now, @now
WHERE NOT EXISTS (SELECT 1 FROM PricingConfig WHERE serviceType = 'MOTO');

-- -----------------------------
-- Users de prueba
-- -----------------------------
-- Password hash (bcryptjs, 10 rounds) para 'xpress_test'
SET @passHash := '$2a$10$NDOUSo/01jBNB9cd//K.HuZc3mRN80LQeaiPTVxpoppLBFCTcDo0q';

-- Cliente demo
INSERT INTO User (id, username, email, passwordHash, role, createdAt, updatedAt)
VALUES ('dev_user_cliente', NULL, 'cliente@xpress.local', @passHash, 'USER', @now, @now)
ON DUPLICATE KEY UPDATE
	passwordHash = VALUES(passwordHash),
	role = VALUES(role),
	updatedAt = VALUES(updatedAt);

SET @clienteUserId := (SELECT id FROM User WHERE email = 'cliente@xpress.local' LIMIT 1);

INSERT INTO PassengerProfile (id, userId, fullName, phone, photoUrl, createdAt, updatedAt)
VALUES ('dev_passenger_cliente', @clienteUserId, 'daniel burgos', '04245600261', NULL, @now, @now)
ON DUPLICATE KEY UPDATE
	fullName = VALUES(fullName),
	phone = VALUES(phone),
	updatedAt = VALUES(updatedAt);

-- Campos extra de perfil (si existen)
UPDATE PassengerProfile
SET firstName = 'daniel',
	lastName = 'burgos',
	homeAddress = 'centro',
	age = 20,
	updatedAt = @now
WHERE userId = @clienteUserId;

-- Chofer demo
INSERT INTO User (id, username, email, passwordHash, role, createdAt, updatedAt)
VALUES ('dev_user_chofer', 'chofer_demo', 'chofer@xpress.local', @passHash, 'DRIVER', @now, @now)
ON DUPLICATE KEY UPDATE
	passwordHash = VALUES(passwordHash),
	role = VALUES(role),
	updatedAt = VALUES(updatedAt);

SET @choferUserId := (SELECT id FROM User WHERE email = 'chofer@xpress.local' LIMIT 1);

INSERT INTO DriverProfile (id, userId, fullName, phone, photoUrl, serviceType, status, isAvailable, createdAt, updatedAt)
VALUES ('dev_driver_chofer', @choferUserId, 'yojhan villamizar', '04247405708', 'https://example.com/driver.png', 'MOTO', 'APPROVED', 1, @now, @now)
ON DUPLICATE KEY UPDATE
	fullName = VALUES(fullName),
	phone = VALUES(phone),
	photoUrl = VALUES(photoUrl),
	serviceType = VALUES(serviceType),
	status = VALUES(status),
	isAvailable = VALUES(isAvailable),
	updatedAt = VALUES(updatedAt);

UPDATE DriverProfile
SET firstName = 'yojhan',
    lastName = 'villamizar',
    homeAddress = 'palo gordo',
    age = 21,
    updatedAt = @now
WHERE userId = @choferUserId;

SET @choferDriverId := (SELECT id FROM DriverProfile WHERE userId = @choferUserId LIMIT 1);

-- Ubicación (San Fernando aprox.)
INSERT INTO DriverLocation (id, driverId, lat, lng, updatedAt)
VALUES ('dev_driverloc_chofer', @choferDriverId, -34.4477000, -58.5584000, @now)
ON DUPLICATE KEY UPDATE
	lat = VALUES(lat),
	lng = VALUES(lng),
	updatedAt = VALUES(updatedAt);

INSERT INTO Vehicle (id, driverId, brand, model, plate, year, color, doors, hasAC, hasTrunk, allowsPets, createdAt, updatedAt)
VALUES ('dev_vehicle_chofer', @choferDriverId, 'empire', 'tx keeway', 'aae182', 2021, 'morado con negro', NULL, 0, 0, 0, @now, @now)
ON DUPLICATE KEY UPDATE
	brand = VALUES(brand),
	model = VALUES(model),
	plate = VALUES(plate),
	year = VALUES(year),
	color = VALUES(color),
	doors = VALUES(doors),
	hasAC = VALUES(hasAC),
	hasTrunk = VALUES(hasTrunk),
	allowsPets = VALUES(allowsPets),
	updatedAt = VALUES(updatedAt);

-- -----------------------------
-- Limpieza: eliminar carreras/ofertas demo
-- (para poder probar desde cero siempre)
-- -----------------------------
SET @clientePassengerId := (SELECT id FROM PassengerProfile WHERE userId = @clienteUserId LIMIT 1);

-- Si hay ofertas comprometidas que apuntan a rides, primero desvincular para evitar restricciones.
UPDATE RideOffer
SET rideId = NULL
WHERE (passengerId = @clientePassengerId OR committedDriverId = @choferDriverId)
  AND rideId IS NOT NULL;

DELETE FROM RideOffer
WHERE passengerId = @clientePassengerId OR committedDriverId = @choferDriverId;

DELETE FROM RideRequest
WHERE passengerId = @clientePassengerId OR matchedDriverId = @choferDriverId;
