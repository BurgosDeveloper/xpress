import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { apiRouter } from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { env } from "./utils/env";
import { prisma } from "./db/prisma";
import { ensurePricingConfigsForAllServiceTypes } from "./modules/config/pricingBootstrap";
import { legalRouter } from "./modules/legal/legal.routes";

function redactSensitive(input: string) {
  return input
    .replace(/mysql:\/\/[^\s]+/gi, "mysql://***REDACTED***")
    .replace(/password=([^&\s]+)/gi, "password=***REDACTED***");
}

export function createApp() {
  const app = express();

  // Best-effort bootstrap: evita que tipos *_CARGA queden sin pricing.
  void (async () => {
    try {
      const res = await ensurePricingConfigsForAllServiceTypes();
      if (res.created > 0) {
        // eslint-disable-next-line no-console
        console.log(`[pricing] created missing configs: ${res.created}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[pricing] bootstrap failed", e);
    }
  })();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  app.use(legalRouter);

  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/health/db", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({ ok: true });
    } catch (err) {
      const anyErr = err as any;
      const name = anyErr?.name ?? "Error";
      const code = anyErr?.errorCode ?? anyErr?.code;
      const message = typeof anyErr?.message === "string" ? redactSensitive(anyErr.message) : undefined;

      return res.status(503).json({
        ok: false,
        error: {
          name,
          code,
          message,
        },
      });
    }
  });
  app.use("/api", apiRouter);

  app.use(errorMiddleware);
  return app;
}
