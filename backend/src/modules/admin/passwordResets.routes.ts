import { Router } from "express";
import { adminListPasswordResetsController, adminSendPasswordResetWhatsappController } from "./passwordResets.controller";

export const passwordResetsAdminRouter = Router();

passwordResetsAdminRouter.get("/password-resets", adminListPasswordResetsController);
passwordResetsAdminRouter.post("/password-resets/:resetRequestId/send-whatsapp", adminSendPasswordResetWhatsappController);
