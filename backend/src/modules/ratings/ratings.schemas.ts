import { z } from "zod";

export const CreateRatingSchema = z.object({
  rideId: z.string().min(1),
  stars: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(1).max(500).optional(),
});
