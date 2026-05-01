import type { NextFunction, Request, Response } from "express";

export function requireRole(roles: Array<"USER" | "DRIVER" | "ADMIN">) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: "Unauthorized" });
    if (!roles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}
