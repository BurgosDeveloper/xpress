import { ServiceType } from "@prisma/client";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import { prisma } from "../../db/prisma";

type LatLng = { lat: number; lng: number };

type ZoneRow = {
  id: string;
  name: string;
  isHub: boolean;
  isActive: boolean;
  geojson: any;
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function extractLngLatFromGeoJson(geojson: any): Array<[number, number]> {
  if (!geojson || typeof geojson !== "object") return [];

  const type = geojson.type;
  const coords = geojson.coordinates;

  const out: Array<[number, number]> = [];

  const pushPair = (pair: any) => {
    if (!Array.isArray(pair) || pair.length < 2) return;
    const lng = pair[0];
    const lat = pair[1];
    if (isFiniteNumber(lng) && isFiniteNumber(lat)) out.push([lng, lat]);
  };

  if (type === "Polygon" && Array.isArray(coords)) {
    for (const ring of coords) {
      if (!Array.isArray(ring)) continue;
      for (const pair of ring) pushPair(pair);
    }
  }

  if (type === "MultiPolygon" && Array.isArray(coords)) {
    for (const poly of coords) {
      if (!Array.isArray(poly)) continue;
      for (const ring of poly) {
        if (!Array.isArray(ring)) continue;
        for (const pair of ring) pushPair(pair);
      }
    }
  }

  return out;
}

export function computeBboxFromGeoJson(geojson: any): {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
} {
  const pairs = extractLngLatFromGeoJson(geojson);
  if (!pairs.length) throw new Error("Invalid GeoJSON: empty coordinates");

  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lng, lat] of pairs) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
    throw new Error("Invalid GeoJSON: bbox not finite");
  }

  return { minLat, minLng, maxLat, maxLng };
}

function pointWithinZone(point: LatLng, zone: ZoneRow): boolean {
  if (!zone.isActive) return false;
  if (point.lat < zone.minLat || point.lat > zone.maxLat) return false;
  if (point.lng < zone.minLng || point.lng > zone.maxLng) return false;

  try {
    return booleanPointInPolygon(turfPoint([point.lng, point.lat]), zone.geojson);
  } catch {
    return false;
  }
}

export async function adminListZones() {
  const zones = await prisma.zone.findMany({
    orderBy: [{ isHub: "desc" }, { name: "asc" }],
  });

  return { ok: true as const, zones };
}

export async function adminCreateZone(params: {
  name: string;
  isHub?: boolean;
  isActive?: boolean;
  geojson: any;
}) {
  const bbox = computeBboxFromGeoJson(params.geojson);

  const zone = await prisma.zone.create({
    data: {
      name: params.name,
      isHub: params.isHub ?? false,
      isActive: params.isActive ?? true,
      geojson: params.geojson,
      minLat: bbox.minLat,
      minLng: bbox.minLng,
      maxLat: bbox.maxLat,
      maxLng: bbox.maxLng,
    },
  });

  return { ok: true as const, zone };
}

export async function adminUpdateZone(params: {
  zoneId: string;
  name?: string;
  isHub?: boolean;
  isActive?: boolean;
  geojson?: any;
}) {
  const current = await prisma.zone.findUnique({ where: { id: params.zoneId } });
  if (!current) return { ok: false as const, status: 404 as const, error: "Zone not found" };

  const bbox = params.geojson ? computeBboxFromGeoJson(params.geojson) : null;

  const zone = await prisma.zone.update({
    where: { id: current.id },
    data: {
      ...(params.name !== undefined ? { name: params.name } : null),
      ...(params.isHub !== undefined ? { isHub: params.isHub } : null),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : null),
      ...(params.geojson !== undefined
        ? {
            geojson: params.geojson,
            minLat: bbox!.minLat,
            minLng: bbox!.minLng,
            maxLat: bbox!.maxLat,
            maxLng: bbox!.maxLng,
          }
        : null),
    },
  });

  return { ok: true as const, zone };
}

export async function adminDeleteZone(params: { zoneId: string }) {
  const current = await prisma.zone.findUnique({ where: { id: params.zoneId } });
  if (!current) return { ok: false as const, status: 404 as const, error: "Zone not found" };

  await prisma.zone.delete({ where: { id: current.id } });
  return { ok: true as const };
}

export async function adminListZoneFixedPrices() {
  const items = await prisma.zoneFixedPrice.findMany({
    include: {
      hubZone: { select: { id: true, name: true } },
      targetZone: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });

  return { ok: true as const, items };
}

export async function adminUpsertZoneFixedPrice(params: {
  hubZoneId: string;
  targetZoneId: string;
  serviceType: ServiceType;
  amountCop: number;
  isActive?: boolean;
}) {
  if (params.hubZoneId === params.targetZoneId) {
    return { ok: false as const, status: 400 as const, error: "hubZoneId and targetZoneId must be different" };
  }

  const [hub, target] = await Promise.all([
    prisma.zone.findUnique({ where: { id: params.hubZoneId } }),
    prisma.zone.findUnique({ where: { id: params.targetZoneId } }),
  ]);

  if (!hub) return { ok: false as const, status: 404 as const, error: "Hub zone not found" };
  if (!target) return { ok: false as const, status: 404 as const, error: "Target zone not found" };

  const item = await prisma.zoneFixedPrice.upsert({
    where: {
      hubZoneId_targetZoneId_serviceType: {
        hubZoneId: hub.id,
        targetZoneId: target.id,
        serviceType: params.serviceType,
      },
    },
    create: {
      hubZoneId: hub.id,
      targetZoneId: target.id,
      serviceType: params.serviceType,
      amountCop: Math.round(params.amountCop * 100) / 100,
      isActive: params.isActive ?? true,
    },
    update: {
      amountCop: Math.round(params.amountCop * 100) / 100,
      ...(params.isActive !== undefined ? { isActive: params.isActive } : null),
    },
  });

  return { ok: true as const, item };
}

export async function adminDeleteZoneFixedPrice(params: { id: string }) {
  const current = await prisma.zoneFixedPrice.findUnique({ where: { id: params.id } });
  if (!current) return { ok: false as const, status: 404 as const, error: "Fixed price not found" };

  await prisma.zoneFixedPrice.delete({ where: { id: current.id } });
  return { ok: true as const };
}

export async function getFixedZonePriceForTrip(params: {
  pickup: LatLng;
  dropoff: LatLng;
  serviceType: ServiceType;
}): Promise<
  | { ok: true; amountCop: number; hubZoneId: string; targetZoneId: string }
  | {
      ok: false;
      kind:
        | "IN_HUB"
        | "ZONE_TO_ZONE"
        | "OUTSIDE_NO_TARGET_ZONE"
        | "OUTSIDE_NO_FIXED_PRICE";
    }
> {
  const rawZones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: [{ isHub: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isHub: true,
      isActive: true,
      geojson: true,
      minLat: true,
      minLng: true,
      maxLat: true,
      maxLng: true,
    },
  });

  const zones: ZoneRow[] = rawZones.map((z) => ({
    id: z.id,
    name: z.name,
    isHub: z.isHub,
    isActive: z.isActive,
    geojson: z.geojson,
    minLat: Number(z.minLat),
    minLng: Number(z.minLng),
    maxLat: Number(z.maxLat),
    maxLng: Number(z.maxLng),
  }));

  if (!zones.length) return { ok: false, kind: "IN_HUB" };

  const hubZones = zones.filter((z) => z.isHub);
  const targetZones = zones.filter((z) => !z.isHub);

  // Si no hay zona hub configurada, no podemos decidir "fuera de SC".
  // Fallback: tratar como dentro (no forzar fijo).
  if (!hubZones.length) return { ok: false, kind: "IN_HUB" };

  const pickupHub = hubZones.find((z) => pointWithinZone(params.pickup, z)) ?? null;
  const dropoffHub = hubZones.find((z) => pointWithinZone(params.dropoff, z)) ?? null;

  const pickupInHub = !!pickupHub;
  const dropoffInHub = !!dropoffHub;

  // Ambos dentro de SC => se usa taxímetro / pricing normal.
  if (pickupInHub && dropoffInHub) return { ok: false, kind: "IN_HUB" };

  // Ambos fuera de SC => negociar por WhatsApp.
  if (!pickupInHub && !dropoffInHub) return { ok: false, kind: "ZONE_TO_ZONE" };

  // SC <-> fuera de SC: buscamos zona destino (no-hub) y precio fijo.
  const hubZone = pickupInHub ? pickupHub! : dropoffHub!;
  const outsidePoint = pickupInHub ? params.dropoff : params.pickup;
  const targetZone = targetZones.find((z) => pointWithinZone(outsidePoint, z)) ?? null;
  if (!targetZone) return { ok: false, kind: "OUTSIDE_NO_TARGET_ZONE" };

  const fixed = await prisma.zoneFixedPrice.findFirst({
    where: {
      hubZoneId: hubZone.id,
      targetZoneId: targetZone.id,
      serviceType: params.serviceType,
      isActive: true,
    },
    select: { amountCop: true, hubZoneId: true, targetZoneId: true },
  });

  if (!fixed) return { ok: false, kind: "OUTSIDE_NO_FIXED_PRICE" };

  return {
    ok: true,
    amountCop: Number(fixed.amountCop),
    hubZoneId: fixed.hubZoneId,
    targetZoneId: fixed.targetZoneId,
  };
}
