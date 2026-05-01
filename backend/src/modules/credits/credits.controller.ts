import type { Request, Response } from "express";
import { getMyCredits } from "./credits.service";

export async function getMyCreditsController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const result = await getMyCredits({ userId });
  return res.status(200).json(result);
}
