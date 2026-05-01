import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../db/prisma";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!token) {
      return res.status(401).json({ message: "Missing Authorization bearer token" });
    }

    const result = verifyAccessToken(token);
    if (!result.ok) {
      return res.status(401).json({ message: result.error });
    }

    const userId = result.payload.sub;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
    if (!user) return res.status(401).json({ message: "User not found" });
    if (!user.isActive) return res.status(403).json({ message: "User disabled" });

    req.user = { id: user.id, role: user.role };
    return next();
  } catch (e) {
    return next(e);
  }
}
