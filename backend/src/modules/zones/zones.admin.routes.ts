import { Router } from "express";
import {
  adminCreateZoneController,
  adminDeleteZoneController,
  adminDeleteZoneFixedPriceController,
  adminListZoneFixedPricesController,
  adminListZonesController,
  adminUpdateZoneController,
  adminUpsertZoneFixedPriceController,
} from "./zones.admin.controller";

export const zonesAdminRouter = Router();

// Mounted under /admin
zonesAdminRouter.get("/zones", adminListZonesController);
zonesAdminRouter.post("/zones", adminCreateZoneController);
zonesAdminRouter.patch("/zones/:zoneId", adminUpdateZoneController);
zonesAdminRouter.delete("/zones/:zoneId", adminDeleteZoneController);

zonesAdminRouter.get("/zones/fixed-prices", adminListZoneFixedPricesController);
zonesAdminRouter.put("/zones/fixed-prices", adminUpsertZoneFixedPriceController);
zonesAdminRouter.delete("/zones/fixed-prices/:id", adminDeleteZoneFixedPriceController);
