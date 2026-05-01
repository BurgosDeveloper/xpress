import { z } from "zod";

export const SetAvailabilitySchema = z.object({
  isAvailable: z.coerce.boolean(),
});

export const UpsertLocationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const UpdateMeterSchema = z.object({
  meterDistanceMeters: z.coerce.number().int().nonnegative(),
});
