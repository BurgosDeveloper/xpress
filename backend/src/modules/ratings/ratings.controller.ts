import type { Request, Response } from "express";
import { CreateRatingSchema } from "./ratings.schemas";
import { createRating, listMyRatings } from "./ratings.service";

export async function createRatingController(req: Request, res: Response) {
  const userId = req.user?.id;
  const role = req.user?.role;
  if (!userId || !role) return res.status(401).json({ message: "Unauthorized" });

  const input = CreateRatingSchema.parse(req.body);
  const result = await createRating({
    userId,
    role,
    rideId: input.rideId,
    stars: input.stars,
    comment: input.comment,
  });

  if (!result.ok) return res.status(400).json({ message: result.error });
  return res.status(201).json(result);
}

export async function getMyRatingsController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const direction = req.query.direction ? String(req.query.direction) : undefined;
  const rows = await listMyRatings({ userId, direction });
  return res.status(200).json({ ok: true, ratings: rows });
}
