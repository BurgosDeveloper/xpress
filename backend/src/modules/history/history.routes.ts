import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { last10CounterpartiesController } from "./history.controller";

export const historyRouter = Router();

historyRouter.use(requireAuth);

historyRouter.get("/last10", requireRole(["USER", "DRIVER"]), last10CounterpartiesController);
