import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import {
  cancelOfferController,
  commitOfferController,
  createOfferController,
  estimateOfferController,
  getOfferController,
  myOffersController,
  nearbyOffersController,
} from "./offers.controller";

export const offersRouter = Router();

offersRouter.use(requireAuth);

// Cliente
offersRouter.post("/estimate", requireRole(["USER"]), estimateOfferController);
offersRouter.post("/", requireRole(["USER"]), createOfferController);
offersRouter.get("/mine", requireRole(["USER"]), myOffersController);
offersRouter.post("/:offerId/cancel", requireRole(["USER"]), cancelOfferController);

// Chofer
offersRouter.get("/nearby", requireRole(["DRIVER"]), nearbyOffersController);
offersRouter.get("/:offerId", requireRole(["DRIVER"]), getOfferController);
offersRouter.post("/:offerId/commit", requireRole(["DRIVER"]), commitOfferController);
