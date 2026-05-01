import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { deleteMyAccountController, getMyProfileController, updateMyProfileController } from "./profile.controller";

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get("/me", getMyProfileController);
profileRouter.patch("/me", updateMyProfileController);
profileRouter.delete("/me", deleteMyAccountController);
