import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import {
  driverGetMeController,
  driverSetAvailabilityController,
  driverUpsertLocationController,
  driverListMyRidesController,
  driverAcceptRideController,
  driverStartRideController,
  driverUpdateMeterController,
  driverNotifyArrivedController,
  driverCompleteRideController,
} from "./driver.controller";

export const driverRouter = Router();

driverRouter.use(requireAuth, requireRole(["DRIVER"]));

driverRouter.get("/me", driverGetMeController);
driverRouter.put("/me/availability", driverSetAvailabilityController);
driverRouter.put("/me/location", driverUpsertLocationController);
driverRouter.get("/rides", driverListMyRidesController);
driverRouter.post("/rides/:rideId/accept", driverAcceptRideController);
driverRouter.post("/rides/:rideId/start", driverStartRideController);
driverRouter.put("/rides/:rideId/meter", driverUpdateMeterController);
driverRouter.post("/rides/:rideId/notify-arrived", driverNotifyArrivedController);
driverRouter.post("/rides/:rideId/complete", driverCompleteRideController);
