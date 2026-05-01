import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import {
  createRideController,
  nearbyDriversController,
  getDriverTechSheetController,
  getRideCandidatesController,
  driverNearbyRequestsController,
  driverOfferRideController,
  getRideOffersController,
  rejectRideOfferController,
  selectRideDriverController,
  getRideController,
  listMyRidesController,
  cancelRideController,
  confirmRideCompleteController,
  getActiveRideController,
} from "./rides.controller";

export const ridesRouter = Router();

ridesRouter.use(requireAuth);

ridesRouter.post("/", requireRole(["USER"]), createRideController);
ridesRouter.get("/mine", requireRole(["USER"]), listMyRidesController);
ridesRouter.get("/driver/mine", requireRole(["DRIVER"]), listMyRidesController);

// Servicio activo / pendiente de calificación
ridesRouter.get("/active", getActiveRideController);

// Debe ir antes de "/:rideId" para evitar colisión
ridesRouter.get("/nearby-drivers", requireRole(["USER"]), nearbyDriversController);

// DRIVER: solicitudes cercanas (para ofrecer servicio)
ridesRouter.get("/driver/nearby-requests", requireRole(["DRIVER"]), driverNearbyRequestsController);

// Ficha técnica de chofer (cliente)
ridesRouter.get("/drivers/:driverId", requireRole(["USER"]), getDriverTechSheetController);

ridesRouter.get("/:rideId", getRideController);

ridesRouter.get("/:rideId/candidates", requireRole(["USER"]), getRideCandidatesController);

// USER: choferes que ofrecieron este servicio
ridesRouter.get("/:rideId/offers", requireRole(["USER"]), getRideOffersController);
ridesRouter.post("/:rideId/offers/:driverId/reject", requireRole(["USER"]), rejectRideOfferController);

// DRIVER: ofrecer servicio a una solicitud
ridesRouter.post("/:rideId/offer", requireRole(["DRIVER"]), driverOfferRideController);

ridesRouter.post("/:rideId/select-driver", requireRole(["USER"]), selectRideDriverController);
ridesRouter.post("/:rideId/cancel", requireRole(["USER"]), cancelRideController);
ridesRouter.post("/:rideId/confirm-complete", requireRole(["USER", "DRIVER"]), confirmRideCompleteController);
