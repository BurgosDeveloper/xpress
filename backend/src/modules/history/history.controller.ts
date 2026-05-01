import type { Request, Response } from "express";
import { last10Counterparties } from "./history.service";

export async function last10CounterpartiesController(req: Request, res: Response) {
  const userId = req.user?.id;
  const role = req.user?.role;
  if (!userId || !role) return res.status(401).json({ message: "Unauthorized" });

  const result = await last10Counterparties({ userId, role });
  if (!result.ok) return res.status(400).json({ message: result.error });

  return res.status(200).json({ ok: true, items: result.items });
}
