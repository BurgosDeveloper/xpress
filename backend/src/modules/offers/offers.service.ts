import { DriverStatus, OfferStatus, RideStatus, ServiceType } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { boundingBoxKm, haversineDistanceMeters } from "../../utils/geo";
import { sendPushToAdmins, sendPushToUser } from "../notifications/notifications.service";
import { normalizeRoutePathInput, resolveDrivingMetrics } from "../../utils/directions";
import { calculateFare } from "../../utils/fare";
import { env } from "../../utils/env";
import { effectiveBaseFare } from "../config/appConfig.service";
import { ensureDriverHasMinCredits } from "../credits/credits.service";
import { getFixedZonePriceForTrip } from "../zones/zones.service";
import { emitToUser, emitToUsers } from "../../realtime/realtime";

const DRIVER_LOCATION_MAX_AGE_MS = 2 * 60 * 1000;

function driverLocationFreshSince() {
  return new Date(Date.now() - DRIVER_LOCATION_MAX_AGE_MS);
}

function pricingServiceTypeFor(serviceTypeWanted: ServiceType): ServiceType {
  return serviceTypeWanted;
}

function routeUnavailableEstimate() {
  return {
    ok: false as const,
    status: 503 as const,
    error: "No se pudo calcular la ruta real en este momento. Intentá de nuevo.",
    code: "ROUTE_UNAVAILABLE" as const,
  };
}

function positiveIntOrNull(value: unknown) {
  const raw = Math.floor(Number(value));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

async function getNearbyDriverUserIdsForOffer(offer: {
  id: string;
  pickupLat: unknown;
  pickupLng: unknown;
  searchRadiusM: unknown;
  serviceTypeWanted: ServiceType;
}) {
  const pickup = { lat: Number(offer.pickupLat), lng: Number(offer.pickupLng) };
  const radiusM = Math.max(250, Math.min(50_000, Number(offer.searchRadiusM ?? 5000)));
  const radiusKm = radiusM / 1000;
  const box = boundingBoxKm(pickup, radiusKm);
  const freshSince = driverLocationFreshSince();

  const drivers = await prisma.driverProfile.findMany({
    where: {
      status: DriverStatus.APPROVED,
      isAvailable: true,
      user: { is: { isActive: true } },
      serviceType: offer.serviceTypeWanted,
      location: {
        is: {
          updatedAt: { gte: freshSince },
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
        },
      },
      matchedRides: {
        none: {
          status: { in: [RideStatus.ASSIGNED, RideStatus.ACCEPTED, RideStatus.MATCHED, RideStatus.IN_PROGRESS] },
        },
      },
    },
    select: {
      userId: true,
      location: { select: { lat: true, lng: true } },
    },
    take: 200,
  });

  return drivers
    .map((d) => {
      const loc = d.location ? { lat: Number(d.location.lat), lng: Number(d.location.lng) } : null;
      const dist = loc ? haversineDistanceMeters(pickup, loc) : Number.NaN;
      return { userId: d.userId, distanceMeters: Math.round(dist) };
    })
    .filter((x) => Number.isFinite(x.distanceMeters) && x.distanceMeters <= radiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 50)
    .map((x) => x.userId);
}

async function emitNearbyOfferChange(
  offer: {
    id: string;
    pickupLat: unknown;
    pickupLng: unknown;
    searchRadiusM: unknown;
    serviceTypeWanted: ServiceType;
  },
  type: "OFFER_AVAILABLE" | "OFFER_UNAVAILABLE"
) {
  const userIds = await getNearbyDriverUserIdsForOffer(offer);
  if (!userIds.length) return;
  emitToUsers(userIds, "driver:nearby:changed", { type, offerId: offer.id, eventId: `${type}:${offer.id}` });
}

export async function listMyOffers(params: { userId: string }) {
  const passenger = await prisma.passengerProfile.findUnique({ where: { userId: params.userId }, select: { id: true } });
  if (!passenger) return { ok: false as const, error: "Passenger profile not found" };

  const offers = await prisma.rideOffer.findMany({
    where: { passengerId: passenger.id, status: OfferStatus.OPEN },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { ok: true as const, offers };
}

export async function cancelOffer(params: { userId: string; offerId: string }) {
  const passenger = await prisma.passengerProfile.findUnique({ where: { userId: params.userId }, select: { id: true } });
  if (!passenger) return { ok: false as const, error: "Passenger profile not found" };

  const offer = await prisma.rideOffer.findUnique({ where: { id: params.offerId } });
  if (!offer) return { ok: false as const, error: "Offer not found" };
  if (offer.passengerId !== passenger.id) return { ok: false as const, error: "Forbidden" };
  if (offer.status !== OfferStatus.OPEN) return { ok: false as const, error: "Offer is not cancellable" };

  const updated = await prisma.rideOffer.update({ where: { id: offer.id }, data: { status: OfferStatus.CANCELLED } });

  void emitNearbyOfferChange(updated, "OFFER_UNAVAILABLE");

  void sendPushToAdmins({
    title: "Contraoferta cancelada",
    body: `Oferta ${offer.id}`,
    data: { offerId: offer.id, type: "OFFER_CANCELLED" },
  });

  return { ok: true as const, offer: updated };
}

export async function estimateOffer(params: {
  serviceTypeWanted: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  pickup: { lat: number; lng: number; address?: string };
  dropoff: { lat: number; lng: number; address?: string };
  distanceMeters?: number;
  durationSeconds?: number;
  routePath?: Array<{ lat: number; lng: number }>;
  wantsAC: boolean;
  wantsTrunk: boolean;
  wantsPets: boolean;
}) {
  const fixed = await getFixedZonePriceForTrip({
    pickup: { lat: params.pickup.lat, lng: params.pickup.lng },
    dropoff: { lat: params.dropoff.lat, lng: params.dropoff.lng },
    serviceType: params.serviceTypeWanted as ServiceType,
  });

  if (!fixed.ok && fixed.kind !== "IN_HUB") {
    return {
      ok: false as const,
      status: 409 as const,
      error:
        fixed.kind === "ZONE_TO_ZONE"
          ? "Traslados entre zonas externas: se negocia por WhatsApp."
          : "No hay tarifa fija configurada para este destino. Se negocia por WhatsApp.",
      code: "NEGOTIATE_WHATSAPP" as const,
      details: { kind: fixed.kind },
    };
  }

  const pricingType = pricingServiceTypeFor(params.serviceTypeWanted as ServiceType);
  const pricing = await prisma.pricingConfig.findUnique({ where: { serviceType: pricingType } });
  if (!pricing) return { ok: false as const, error: "Pricing not configured for this service type" };

  if (fixed.ok) {
    const fixedAmount = Math.round(fixed.amountCop * 100) / 100;
    return {
      ok: true as const,
      distanceMeters: positiveIntOrNull(params.distanceMeters) ?? 1,
      durationSeconds: positiveIntOrNull(params.durationSeconds) ?? undefined,
      routePath: normalizeRoutePathInput(params.routePath ?? null),
      estimatedPrice: fixedAmount,
      isFixedPrice: true,
      fixedPriceCop: fixedAmount,
      pricing: {
        baseFare: Number(pricing.baseFare),
        perKm: Number(pricing.perKm),
        includedMeters: Number((pricing as any).includedMeters ?? 0),
        stepMeters: Number((pricing as any).stepMeters ?? 0),
        stepPrice: Number((pricing as any).stepPrice ?? 0),
        acSurcharge: Number(pricing.acSurcharge),
        trunkSurcharge: Number(pricing.trunkSurcharge),
        petsSurcharge: Number(pricing.petsSurcharge),
      },
    };
  }

  const route = await resolveDrivingMetrics({
    from: { lat: params.pickup.lat, lng: params.pickup.lng },
    to: { lat: params.dropoff.lat, lng: params.dropoff.lng },
    distanceMeters: params.distanceMeters,
    durationSeconds: params.durationSeconds,
    routePath: params.routePath,
  });
  if (!route) return routeUnavailableEstimate();

  const dist = route.distanceMeters;

  const surcharge =
    (params.wantsAC ? Number(pricing.acSurcharge) : 0) +
    (params.wantsTrunk ? Number(pricing.trunkSurcharge) : 0) +
    (params.wantsPets ? Number(pricing.petsSurcharge) : 0);

  const now = new Date();
  const pricingNightBaseFare = Math.max(0, Number((pricing as any).nightBaseFare ?? 0));
  const pricingNightStartHour = Number((pricing as any).nightStartHour ?? 20);
  const pricingNightEndHour = Number((pricing as any).nightEndHour ?? 23);
  const baseFare = effectiveBaseFare({
    dayBaseFare: Number(pricing.baseFare),
    now,
    nightBaseFare: pricingNightBaseFare,
    nightStartHour: pricingNightStartHour,
    nightEndHour: pricingNightEndHour,
  });

  const estimated = calculateFare({
    distanceMeters: dist,
    baseFare,
    perKm: Number(pricing.perKm),
    includedKm: env.METER_INCLUDED_KM,
    includedMeters: Number((pricing as any).includedMeters ?? 0),
    stepMeters: Number((pricing as any).stepMeters ?? 0),
    stepPrice: Number((pricing as any).stepPrice ?? 0),
    surcharge,
    addonsTotal: 0,
  });

  return {
    ok: true as const,
    distanceMeters: dist,
    durationSeconds: route.durationSeconds,
    routePath: route.path,
    estimatedPrice: Math.round(estimated * 100) / 100,
    isFixedPrice: false,
    fixedPriceCop: null,
    pricing: {
      baseFare,
      perKm: Number(pricing.perKm),
      includedMeters: Number((pricing as any).includedMeters ?? 0),
      stepMeters: Number((pricing as any).stepMeters ?? 0),
      stepPrice: Number((pricing as any).stepPrice ?? 0),
      acSurcharge: Number(pricing.acSurcharge),
      trunkSurcharge: Number(pricing.trunkSurcharge),
      petsSurcharge: Number(pricing.petsSurcharge),
    },
  };
}

export async function createOffer(params: {
  userId: string;
  serviceTypeWanted: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  pickup: { lat: number; lng: number; address?: string };
  dropoff: { lat: number; lng: number; address?: string };
  distanceMeters?: number;
  durationSeconds?: number;
  routePath?: Array<{ lat: number; lng: number }>;
  offeredPrice: number;
  searchRadiusM: number;
}) {
  const passenger = await prisma.passengerProfile.findUnique({
    where: { userId: params.userId },
    select: { id: true },
  });
  if (!passenger) return { ok: false as const, error: "Passenger profile not found" };

  const activeRide = await prisma.rideRequest.findFirst({
    where: {
      passengerId: passenger.id,
      status: { in: [RideStatus.OPEN, RideStatus.ASSIGNED, RideStatus.ACCEPTED, RideStatus.MATCHED, RideStatus.IN_PROGRESS] },
    },
    select: { id: true, status: true },
    orderBy: { updatedAt: "desc" },
  });

  if (activeRide) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "Ya tenés un servicio activo. Cancelalo antes de crear una contraoferta.",
    };
  }

  const openOffer = await prisma.rideOffer.findFirst({
    where: { passengerId: passenger.id, status: OfferStatus.OPEN },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  if (openOffer) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "Ya tenés una contraoferta activa. Cancelala antes de crear otra.",
    };
  }

  const estimation = await estimateOffer({
    serviceTypeWanted: params.serviceTypeWanted,
    pickup: params.pickup,
    dropoff: params.dropoff,
    distanceMeters: params.distanceMeters,
    durationSeconds: params.durationSeconds,
    routePath: params.routePath,
    wantsAC: false,
    wantsTrunk: false,
    wantsPets: false,
  });
  if (!estimation.ok) return estimation;

  const offer = await prisma.rideOffer.create({
    data: {
      passengerId: passenger.id,
      serviceTypeWanted: params.serviceTypeWanted as ServiceType,
      pickupLat: params.pickup.lat,
      pickupLng: params.pickup.lng,
      pickupAddress: params.pickup.address,
      dropoffLat: params.dropoff.lat,
      dropoffLng: params.dropoff.lng,
      dropoffAddress: params.dropoff.address,
      distanceMeters: estimation.distanceMeters,
      durationSeconds: estimation.durationSeconds,
      routePath: estimation.routePath as any,
      estimatedPrice: estimation.estimatedPrice,
      offeredPrice: params.offeredPrice,
      searchRadiusM: params.searchRadiusM,
      status: OfferStatus.OPEN,
    },
  });

  // Push a choferes disponibles dentro del radio.
  // Fire-and-forget: no bloquea la creación.
  void (async () => {
    try {
      const targets = await getNearbyDriverUserIdsForOffer(offer);

      emitToUsers(
        targets,
        "driver:nearby:changed",
        { type: "OFFER_AVAILABLE", offerId: offer.id, eventId: `OFFER_AVAILABLE:${offer.id}` }
      );

      await Promise.all(
        targets.map((userId) =>
          sendPushToUser({
            userId,
            title: "Contraoferta cerca",
            body: "Hay una contraoferta disponible.",
            soundName: "disponibles",
            data: { offerId: offer.id, type: "OFFER_AVAILABLE", eventId: `OFFER_AVAILABLE:${offer.id}` },
          }).catch(() => null)
        )
      );
    } catch {
      // silencioso
    }
  })();

  void sendPushToAdmins({
    title: "Nueva contraoferta",
    body: `Oferta ${offer.id} (${params.serviceTypeWanted})`,
    data: { offerId: offer.id, type: "OFFER_CREATED" },
  });

  return { ok: true as const, offer };
}

export async function listNearbyOffers(params: {
  userId: string;
  center: { lat: number; lng: number };
  radiusM: number;
  serviceType?: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
}) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId: params.userId },
    select: { id: true },
  });
  if (!driver) return { ok: false as const, error: "Driver not found" };

  const radiusKm = params.radiusM / 1000;
  const box = boundingBoxKm({ lat: params.center.lat, lng: params.center.lng }, radiusKm);

  const offers = await prisma.rideOffer.findMany({
    where: {
      status: OfferStatus.OPEN,
      ...(params.serviceType ? { serviceTypeWanted: params.serviceType as ServiceType } : null),
      pickupLat: { gte: box.minLat, lte: box.maxLat },
      pickupLng: { gte: box.minLng, lte: box.maxLng },
    },
    include: {
      passenger: { select: { fullName: true, firstName: true, lastName: true, phone: true, photoUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const items = offers
    .map((o) => {
      const dist = haversineDistanceMeters(
        { lat: params.center.lat, lng: params.center.lng },
        { lat: Number(o.pickupLat), lng: Number(o.pickupLng) }
      );

      return {
        offerId: o.id,
        serviceTypeWanted: o.serviceTypeWanted,
        passenger: {
          fullName: o.passenger?.fullName ?? undefined,
          phone: o.passenger?.phone ?? undefined,
          photoUrl: o.passenger?.photoUrl ?? undefined,
        },
        routePath: (o as any).routePath ?? undefined,
        pickup: {
          lat: Number(o.pickupLat),
          lng: Number(o.pickupLng),
          address: o.pickupAddress ?? undefined,
        },
        dropoff: {
          lat: Number(o.dropoffLat),
          lng: Number(o.dropoffLng),
          address: o.dropoffAddress ?? undefined,
        },
        estimatedPrice: Number(o.estimatedPrice),
        offeredPrice: Number(o.offeredPrice),
        createdAt: o.createdAt,
        distanceMeters: Math.round(dist),
      };
    })
    .filter((x) => x.distanceMeters <= params.radiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 100);

  return { ok: true as const, center: params.center, radiusM: params.radiusM, items };
}

export async function getOfferForDriver(params: { userId: string; offerId: string }) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId: params.userId }, select: { id: true } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  const offer = await prisma.rideOffer.findUnique({
    where: { id: params.offerId },
    include: {
      passenger: {
        select: {
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  if (!offer) return { ok: false as const, status: 404 as const, error: "Offer not found" };

  // Si ya fue comprometida por este driver, permitir verla; si está abierta, también.
  if (offer.status === OfferStatus.OPEN) return { ok: true as const, offer };
  if (offer.committedDriverId && offer.committedDriverId === driver.id) return { ok: true as const, offer };

  return { ok: false as const, status: 403 as const, error: "Forbidden" };
}

export async function commitOffer(params: { userId: string; offerId: string; coords?: { lat: number; lng: number } }) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId: params.userId },
    include: { location: true, user: { select: { isActive: true } } },
  });
  if (!driver) return { ok: false as const, error: "Driver not found" };
  if (!driver.user?.isActive) return { ok: false as const, error: "Driver disabled" };

  const credits = await ensureDriverHasMinCredits({ userId: params.userId });
  if (!credits.ok) return { ok: false as const, status: credits.status, error: credits.error };

  // Si nos pasan coords desde el teléfono, las guardamos y usamos esas.
  if (params.coords) {
    await prisma.$transaction([
      prisma.driverLocation.upsert({
        where: { driverId: driver.id },
        create: { driverId: driver.id, lat: params.coords.lat, lng: params.coords.lng },
        update: { lat: params.coords.lat, lng: params.coords.lng },
      }),
      prisma.driverProfile.update({ where: { id: driver.id }, data: { isAvailable: true } }),
    ]);
  }

  // Si no hay coords, dependemos del estado persistido.
  if (!params.coords && !driver.isAvailable) return { ok: false as const, error: "Driver not available" };

  if (!params.coords && !driver.location) return { ok: false as const, error: "Driver location missing" };

  const driverCoords = params.coords
    ? { lat: params.coords.lat, lng: params.coords.lng }
    : { lat: Number(driver.location!.lat), lng: Number(driver.location!.lng) };

  const offer = await prisma.rideOffer.findUnique({
    where: { id: params.offerId },
    include: { passenger: { select: { id: true, userId: true } } },
  });
  if (!offer) return { ok: false as const, error: "Offer not found" };
  if (offer.status !== OfferStatus.OPEN) return { ok: false as const, error: "Offer is not available" };

  const dist = haversineDistanceMeters(driverCoords, { lat: Number(offer.pickupLat), lng: Number(offer.pickupLng) });
  if (dist > offer.searchRadiusM) return { ok: false as const, error: "Offer out of radius" };

  const pricingType = pricingServiceTypeFor(offer.serviceTypeWanted);
  const pricing = await prisma.pricingConfig.findUnique({ where: { serviceType: pricingType } });
  if (!pricing) return { ok: false as const, error: "Pricing not configured for this service type" };

  const now = new Date();
  const pricingNightBaseFare = Math.max(0, Number((pricing as any).nightBaseFare ?? 0));
  const pricingNightStartHour = Number((pricing as any).nightStartHour ?? 20);
  const pricingNightEndHour = Number((pricing as any).nightEndHour ?? 23);
  const baseFare = effectiveBaseFare({
    dayBaseFare: Number(pricing.baseFare),
    now,
    nightBaseFare: pricingNightBaseFare,
    nightStartHour: pricingNightStartHour,
    nightEndHour: pricingNightEndHour,
  });

  const created = await prisma.$transaction(async (tx) => {
    const fresh = await tx.rideOffer.findUnique({ where: { id: offer.id } });
    if (!fresh || fresh.status !== OfferStatus.OPEN) {
      throw new Error("Offer is not available");
    }

    const ride = await tx.rideRequest.create({
      data: {
        passengerId: offer.passengerId,
        serviceTypeWanted: offer.serviceTypeWanted,
        pickupLat: offer.pickupLat,
        pickupLng: offer.pickupLng,
        pickupAddress: offer.pickupAddress,
        dropoffLat: offer.dropoffLat,
        dropoffLng: offer.dropoffLng,
        dropoffAddress: offer.dropoffAddress,
        distanceMeters: offer.distanceMeters,
        durationSeconds: offer.durationSeconds,
        routePath: (offer as any).routePath,
        wantsAC: false,
        wantsTrunk: false,
        wantsPets: false,
        estimatedPrice: offer.estimatedPrice,
        agreedPrice: offer.offeredPrice,
        pricingBaseFare: baseFare,
        pricingPerKm: pricing.perKm,
        pricingIncludedMeters: Number((pricing as any).includedMeters ?? 0),
        pricingStepMeters: Number((pricing as any).stepMeters ?? 0),
        pricingStepPrice: (pricing as any).stepPrice ?? 0,
        pricingAcSurcharge: pricing.acSurcharge,
        pricingTrunkSurcharge: pricing.trunkSurcharge,
        pricingPetsSurcharge: pricing.petsSurcharge,
        searchRadiusM: offer.searchRadiusM,
        status: "ACCEPTED",
        matchedDriverId: driver.id,
        matchedAt: new Date(),
        acceptedAt: new Date(),
        assignedByAdmin: false,
      },
    });

    const updatedOffer = await tx.rideOffer.update({
      where: { id: offer.id },
      data: {
        status: OfferStatus.COMMITTED,
        committedDriverId: driver.id,
        committedAt: new Date(),
        rideId: ride.id,
      },
    });

    return { ride, offer: updatedOffer };
  });

  void sendPushToUser({
    userId: offer.passenger.userId,
    title: "Contraoferta aceptada",
    body: "Un chofer se comprometió con tu oferta",
    soundName: "aceptar_servicio",
    data: {
      rideId: created.ride.id,
      offerId: offer.id,
      type: "OFFER_COMMITTED",
      eventId: `OFFER_COMMITTED:${offer.id}:${driver.id}`,
    },
  });
  void emitNearbyOfferChange(offer, "OFFER_UNAVAILABLE");
  emitToUser(offer.passenger.userId, "ride:changed", {
    rideId: created.ride.id,
    offerId: offer.id,
    type: "OFFER_COMMITTED",
    eventId: `OFFER_COMMITTED:${offer.id}:${driver.id}`,
  });
  emitToUser(driver.userId, "ride:changed", { rideId: created.ride.id, type: "OFFER_COMMITTED" });

  void sendPushToAdmins({
    title: "Contraoferta aceptada",
    body: `Oferta ${offer.id} -> Driver ${driver.id}`,
    data: { rideId: created.ride.id, offerId: offer.id, driverId: driver.id, type: "OFFER_COMMITTED" },
  });

  return { ok: true as const, ride: created.ride, offer: created.offer };
}
