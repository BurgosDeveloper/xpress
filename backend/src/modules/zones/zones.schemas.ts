import { z } from "zod";
import { ServiceType } from "@prisma/client";

const GeoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  // coordinates: Array<LinearRing>; LinearRing: Array<[lng, lat]>
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const GeoJsonMultiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  // coordinates: Array<PolygonCoordinates>
  coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
});

export const GeoJsonSchema = z.union([GeoJsonPolygonSchema, GeoJsonMultiPolygonSchema]);

export const AdminCreateZoneSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isHub: z.boolean().optional(),
  isActive: z.boolean().optional(),
  geojson: GeoJsonSchema,
});

export const AdminUpdateZoneSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isHub: z.boolean().optional(),
  isActive: z.boolean().optional(),
  geojson: GeoJsonSchema.optional(),
});

export const AdminUpsertZoneFixedPriceSchema = z.object({
  hubZoneId: z.string().min(1),
  targetZoneId: z.string().min(1),
  serviceType: z.nativeEnum(ServiceType),
  amountCop: z.coerce.number().finite().nonnegative(),
  isActive: z.boolean().optional(),
});
