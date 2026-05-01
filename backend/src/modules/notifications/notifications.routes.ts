import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { registerPushTokenController } from "./notifications.controller";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.post("/register-token", registerPushTokenController);
