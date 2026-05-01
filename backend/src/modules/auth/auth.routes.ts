import { Router } from "express";
import {
	loginController,
	meController,
	registerPassengerController,
} from "./auth.controller";
import {
  passwordResetConfirmController,
  passwordResetRequestController,
  passwordResetVerifyController,
} from "./passwordReset.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

export const authRouter = Router();

authRouter.post("/register/passenger", registerPassengerController);
authRouter.post("/login", loginController);
authRouter.get("/me", requireAuth, meController);

authRouter.post("/password-reset/request", passwordResetRequestController);
authRouter.post("/password-reset/verify", passwordResetVerifyController);
authRouter.post("/password-reset/confirm", passwordResetConfirmController);
