import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { getMyCreditsController } from "./credits.controller";

export const creditsRouter = Router();

creditsRouter.use(requireAuth, requireRole(["DRIVER"]));

creditsRouter.get("/me", getMyCreditsController);
