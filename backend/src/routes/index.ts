import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { adminRouter } from "../modules/admin/admin.routes";
import { driverRouter } from "../modules/driver/driver.routes";
import { historyRouter } from "../modules/history/history.routes";
import { notificationsRouter } from "../modules/notifications/notifications.routes";
import { ratingsRouter } from "../modules/ratings/ratings.routes";
import { ridesRouter } from "../modules/rides/rides.routes";
import { offersRouter } from "../modules/offers/offers.routes";
import { profileRouter } from "../modules/profile/profile.routes";
import { uploadsRouter } from "../modules/uploads/uploads.routes";
import { creditsRouter } from "../modules/credits/credits.routes";
import { configRouter } from "../modules/config/config.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/driver", driverRouter);
apiRouter.use("/history", historyRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/ratings", ratingsRouter);
apiRouter.use("/rides", ridesRouter);
apiRouter.use("/offers", offersRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/uploads", uploadsRouter);
apiRouter.use("/credits", creditsRouter);
apiRouter.use("/config", configRouter);
