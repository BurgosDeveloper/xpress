import { z } from "zod";

const RideRoutePathPointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const CreateRideSchema = z.object({
  serviceTypeWanted: z.enum(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"]),
  pickup: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    address: z.string().min(1).optional(),
  }),
  dropoff: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    address: z.string().min(1).optional(),
  }),
  distanceMeters: z.coerce.number().int().positive().optional(),
  durationSeconds: z.coerce.number().int().positive().optional(),
  routePath: z.array(RideRoutePathPointSchema).min(2).max(500).optional(),
  wantsAC: z.coerce.boolean().default(false),
  wantsTrunk: z.coerce.boolean().default(false),
  wantsPets: z.coerce.boolean().default(false),
  addonIds: z.array(z.string().min(1)).max(20).optional(),
  searchRadiusM: z.coerce.number().int().positive().max(20000).default(2000),
});

export const SelectDriverSchema = z.object({
  driverId: z.string().min(1),
});

export const NearbyDriversSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().positive().max(20000).default(2000),
  serviceType: z.enum(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"]).optional(),
});

export const DriverTechSheetParamsSchema = z.object({
  driverId: z.string().min(1),
});

export const DriverNearbyRequestsSchema = z.object({
  radiusM: z.coerce.number().int().positive().max(20000).default(2000),
  take: z.coerce.number().int().positive().max(100).default(30),
});

export const RideOfferParamsSchema = z.object({
  rideId: z.string().min(1),
  driverId: z.string().min(1).optional(),
});
