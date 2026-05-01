import { z } from "zod";

export const OfferPointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: z.string().min(1).optional(),
});

const RoutePathPointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const EstimateOfferSchema = z.object({
  serviceTypeWanted: z.enum(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"]),
  pickup: OfferPointSchema,
  dropoff: OfferPointSchema,
  distanceMeters: z.coerce.number().int().positive().optional(),
  durationSeconds: z.coerce.number().int().positive().optional(),
  routePath: z.array(RoutePathPointSchema).min(2).max(500).optional(),
  wantsAC: z.coerce.boolean().optional().default(false),
  wantsTrunk: z.coerce.boolean().optional().default(false),
  wantsPets: z.coerce.boolean().optional().default(false),
});

export const CreateOfferSchema = z.object({
  serviceTypeWanted: z.enum(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"]),
  pickup: OfferPointSchema,
  dropoff: OfferPointSchema,
  distanceMeters: z.coerce.number().int().positive().optional(),
  durationSeconds: z.coerce.number().int().positive().optional(),
  routePath: z.array(RoutePathPointSchema).min(2).max(500).optional(),
  offeredPrice: z.coerce.number().positive(),
  searchRadiusM: z.coerce.number().int().positive().max(20000).optional().default(2000),
});

export const NearbyOffersQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().positive().max(20000).optional().default(2000),
  serviceType: z.enum(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"]).optional(),
});

export const CommitOfferSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((v) => (v.lat == null && v.lng == null) || (v.lat != null && v.lng != null), {
    message: "lat y lng deben venir juntos",
  });
