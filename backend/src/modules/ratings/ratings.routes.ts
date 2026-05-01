import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { createRatingController, getMyRatingsController } from "./ratings.controller";

export const ratingsRouter = Router();

ratingsRouter.use(requireAuth);

ratingsRouter.post("/", createRatingController);
ratingsRouter.get("/me", getMyRatingsController);
