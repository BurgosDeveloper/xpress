-- CreateIndex
CREATE INDEX `DriverLocation_lat_lng_idx` ON `DriverLocation`(`lat`, `lng`);

-- CreateIndex
CREATE INDEX `DriverLocation_updatedAt_idx` ON `DriverLocation`(`updatedAt`);
