import { Router } from "express";
import { getPublicAppConfigController, getPublicZonesController } from "./config.controller";

export const configRouter = Router();

// Público: no requiere auth (tasas/ajustes no son sensibles).
configRouter.get("/app", getPublicAppConfigController);
configRouter.get("/zones", getPublicZonesController);
