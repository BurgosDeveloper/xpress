import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation error",
      issues: err.issues,
    });
  }

  // DB / Prisma errors: no exponer detalles internos al cliente.
  if (err instanceof Prisma.PrismaClientInitializationError) {
    // Ej: "Can't reach database server at localhost:3306"
    // eslint-disable-next-line no-console
    console.error("[db] prisma init error", err);
    return res.status(503).json({ message: "Database unavailable" });
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    // eslint-disable-next-line no-console
    console.error("[db] prisma error", err);
    return res.status(500).json({ message: "Internal server error" });
  }

  if (err instanceof Error) {
    // eslint-disable-next-line no-console
    console.error("[api] unhandled error", err);
    return res.status(500).json({ message: "Internal server error" });
  }

  return res.status(500).json({ message: "Unknown error" });
}
