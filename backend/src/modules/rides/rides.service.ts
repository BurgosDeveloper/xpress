import { DriverStatus, OfferStatus, RideCandidateStatus, RideStatus, ServiceType } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { boundingBoxKm, haversineDistanceMeters } from "../../utils/geo";
import { buildWhatsappLink } from "../../utils/whatsapp";
import { emitToUser, emitToUsers } from "../../realtime/realtime";
import { sendPushToAdmins, sendPushToUser, sendPushToUserBurst } from "../notifications/notifications.service";
import { chargeDriverCreditsForCompletedRide, ensureDriverHasMinCredits } from "../credits/credits.service";
import { env } from "../../utils/env";
import { calculateFare } from "../../utils/fare";
import { effectiveBaseFare } from "../config/appConfig.service";
import { getDrivingTableDistancesMeters, normalizeRoutePathInput, resolveDrivingMetrics } from "../../utils/directions";
import { getFixedZonePriceForTrip } from "../zones/zones.service";

const DRIVER_LOCATION_MAX_AGE_MS = 2 * 60 * 1000;

function driverLocationFreshSince() {
  return new Date(Date.now() - DRIVER_LOCATION_MAX_AGE_MS);
}

function pricingServiceTypeFor(serviceTypeWanted: ServiceType): ServiceType {
  return serviceTypeWanted;
}

function routeUnavailableRide() {
  return {
    ok: false as const,
    status: 503 as const,
    error: "No se pudo calcular la ruta real en este momento. Intentá nuevamente.",
    code: "ROUTE_UNAVAILABLE" as const,
  };
}

function positiveIntOrNull(value: unknown) {
  const raw = Math.floor(Number(value));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export async function getActiveRideForRequester(params: { requester: { id: string; role: "ADMIN" | "USER" | "DRIVER" } }) {
  // Admin: no aplica (evitamos ambigüedad)
  if (params.requester.role === "ADMIN") {
    return { ok: true as const, ride: null };
  }

  if (params.requester.role === "USER") {
    const passenger = await prisma.passengerProfile.findUnique({
      where: { userId: params.requester.id },
      select: { id: true },
    });
    if (!passenger) return { ok: false as const, status: 404 as const, error: "Passenger not found" };

    const ride = await prisma.rideRequest.findFirst({
      where: {
        passengerId: passenger.id,
        status: { notIn: ["CANCELLED", "EXPIRED"] },
        OR: [
          { status: { in: ["OPEN", "ASSIGNED", "ACCEPTED", "MATCHED", "IN_PROGRESS"] } },
          { status: "COMPLETED", ratings: { none: { direction: "PASSENGER_TO_DRIVER" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        passenger: { select: { fullName: true, firstName: true, lastName: true, phone: true, userId: true } },
        matchedDriver: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            phone: true,
            userId: true,
            serviceType: true,
            vehicle: true,
            mobilePayBank: true,
            mobilePayDocument: true,
            mobilePayPhone: true,
          },
        },
        offer: { select: { id: true, offeredPrice: true } },
        ratings: true,
      },
    });

    return { ok: true as const, ride };
  }

  // DRIVER
  const driver = await prisma.driverProfile.findUnique({
    where: { userId: params.requester.id },
    select: { id: true },
  });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  const ride = await prisma.rideRequest.findFirst({
    where: {
      matchedDriverId: driver.id,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
      OR: [
        { status: { in: ["ASSIGNED", "ACCEPTED", "MATCHED", "IN_PROGRESS"] } },
        { status: "COMPLETED", ratings: { none: { direction: "DRIVER_TO_PASSENGER" } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
        passenger: { select: { fullName: true, firstName: true, lastName: true, phone: true, userId: true } },
        matchedDriver: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            phone: true,
            userId: true,
            serviceType: true,
            vehicle: true,
            mobilePayBank: true,
            mobilePayDocument: true,
            mobilePayPhone: true,
          },
        },
      offer: { select: { id: true, offeredPrice: true } },
      ratings: true,
    },
  });

  return { ok: true as const, ride };
}

export async function listNearbyDrivers(params: {
  userId: string;
  center: { lat: number; lng: number };
  radiusM: number;
  serviceType?: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
}) {
  const radiusKm = params.radiusM / 1000;
  const box = boundingBoxKm({ lat: params.center.lat, lng: params.center.lng }, radiusKm);

  const freshSince = driverLocationFreshSince();

  const drivers = await prisma.driverProfile.findMany({
    where: {
      isAvailable: true,
      user: { is: { isActive: true } },
      ...(params.serviceType ? { serviceType: params.serviceType as ServiceType } : null),
      location: {
        is: {
          updatedAt: { gte: freshSince },
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
        },
      },
    },
    include: {
      location: true,
      vehicle: true,
    },
    take: 200,
  });

  const prelim = drivers
    .map((d) => {
      const location = d.location
        ? {
            lat: Number(d.location.lat),
            lng: Number(d.location.lng),
            updatedAt: d.location.updatedAt,
          }
        : null;

      const dist = location
        ? haversineDistanceMeters(
            { lat: params.center.lat, lng: params.center.lng },
            { lat: location.lat, lng: location.lng }
          )
        : Number.NaN;

      return {
        driverId: d.id,
        fullName: d.fullName,
        photoUrl: d.photoUrl,
        serviceType: d.serviceType,
        vehicle: d.vehicle,
        location,
        // Fallback: distancia recta. Intentamos reemplazarla por distancia por ruta con OSRM.
        distanceMeters: Math.round(dist),
      };
    })
    .filter((x) => x.location && Number.isFinite(x.distanceMeters) && x.distanceMeters <= params.radiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 100);

  const tableDistances = await getDrivingTableDistancesMeters({
    from: params.center,
    toMany: prelim.map((x) => ({ lat: x.location!.lat, lng: x.location!.lng })),
  });

  const items = prelim
    .map((item, idx) => {
      const d = tableDistances?.[idx];
      return {
        ...item,
        distanceMeters: typeof d === "number" ? d : item.distanceMeters,
      };
    })
    .filter((x) => x.distanceMeters <= params.radiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return { ok: true as const, center: params.center, radiusM: params.radiusM, items };
}

export async function getDriverTechSheetForUser(params: { driverId: string }) {
  const driver = await prisma.driverProfile.findUnique({
    where: { id: params.driverId },
    include: {
      vehicle: true,
      documents: { where: { type: "VEHICLE_PHOTO" } },
      user: { select: { isActive: true } },
    },
  });

  // Solo filtramos choferes desactivados.
  if (!driver || !driver.user?.isActive) {
    return { ok: false as const, status: 404 as const, error: "Driver not found" };
  }

  return {
    ok: true as const,
    driver: {
      id: driver.id,
      fullName: driver.fullName,
      phone: driver.phone,
      photoUrl: driver.photoUrl,
      serviceType: driver.serviceType,
      vehicle: driver.vehicle,
      documents: driver.documents,
    },
  };
}

export async function createRide(params: {
  userId: string;
  serviceTypeWanted: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  pickup: { lat: number; lng: number; address?: string };
  dropoff: { lat: number; lng: number; address?: string };
  distanceMeters?: number;
  durationSeconds?: number;
  routePath?: Array<{ lat: number; lng: number }>;
  wantsAC: boolean;
  wantsTrunk: boolean;
  wantsPets: boolean;
  addonIds?: string[];
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
      error: "Ya tenés un servicio activo. Cancelalo antes de solicitar otro.",
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
      error: "Ya tenés una contraoferta activa. Cancelala antes de solicitar un traslado.",
    };
  }

  // Zonas con precio fijo:
  // - Dentro de SC (hub) => tarifa normal.
  // - SC <-> zona => precio fijo.
  // - Zona <-> zona, o SC <-> fuera sin tarifa => negociar por WhatsApp.
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

  const route = fixed.ok
    ? null
    : await resolveDrivingMetrics({
        from: { lat: params.pickup.lat, lng: params.pickup.lng },
        to: { lat: params.dropoff.lat, lng: params.dropoff.lng },
        distanceMeters: params.distanceMeters,
        durationSeconds: params.durationSeconds,
        routePath: params.routePath,
      });
  if (!fixed.ok && !route) return routeUnavailableRide();

  const dist = fixed.ok ? positiveIntOrNull(params.distanceMeters) ?? 1 : route!.distanceMeters;
  const durationSeconds = fixed.ok
    ? positiveIntOrNull(params.durationSeconds) ?? undefined
    : route!.durationSeconds && route!.durationSeconds > 0
      ? route!.durationSeconds
      : undefined;
  const routePath = fixed.ok ? normalizeRoutePathInput(params.routePath ?? null) : route!.path;

  const surcharge =
    (params.wantsAC ? Number(pricing.acSurcharge) : 0) +
    (params.wantsTrunk ? Number(pricing.trunkSurcharge) : 0) +
    (params.wantsPets ? Number(pricing.petsSurcharge) : 0);

  const requestedAddonIds = Array.from(new Set(params.addonIds ?? []));
  let addonsTotal = 0;
  if (requestedAddonIds.length) {
    const addons = await prisma.pricingAddon.findMany({
      where: {
        id: { in: requestedAddonIds },
        serviceType: pricingType,
        isActive: true,
      },
      select: { id: true, amount: true },
    });

    if (addons.length !== requestedAddonIds.length) {
      return { ok: false as const, error: "Invalid addonIds for this service type" };
    }

    addonsTotal = addons.reduce((sum, a) => sum + Number(a.amount), 0);
  }

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
    addonsTotal,
  });

  const ride = await prisma.rideRequest.create({
    data: {
      passengerId: passenger.id,
      serviceTypeWanted: params.serviceTypeWanted as ServiceType,
      pickupLat: params.pickup.lat,
      pickupLng: params.pickup.lng,
      pickupAddress: params.pickup.address,
      dropoffLat: params.dropoff.lat,
      dropoffLng: params.dropoff.lng,
      dropoffAddress: params.dropoff.address,
      distanceMeters: dist,
      durationSeconds,
      routePath: routePath as any,
      wantsAC: params.wantsAC,
      wantsTrunk: params.wantsTrunk,
      wantsPets: params.wantsPets,
        estimatedPrice: fixed.ok ? fixed.amountCop : estimated,
        isFixedPrice: fixed.ok,
        fixedPriceCop: fixed.ok ? fixed.amountCop : null,
        fixedHubZoneId: fixed.ok ? fixed.hubZoneId : null,
        fixedTargetZoneId: fixed.ok ? fixed.targetZoneId : null,
      pricingBaseFare: baseFare,
      pricingPerKm: pricing.perKm,
      pricingIncludedMeters: Number((pricing as any).includedMeters ?? 0),
      pricingStepMeters: Number((pricing as any).stepMeters ?? 0),
      pricingStepPrice: (pricing as any).stepPrice ?? 0,
      pricingAcSurcharge: pricing.acSurcharge,
      pricingTrunkSurcharge: pricing.trunkSurcharge,
      pricingPetsSurcharge: pricing.petsSurcharge,
      searchRadiusM: params.searchRadiusM,
      status: "OPEN",
      addons: requestedAddonIds.length
        ? {
            createMany: {
              data: requestedAddonIds.map((addonId) => ({ addonId })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
  });

  emitToUser(params.userId, "ride:created", { rideId: ride.id });

  // Push a choferes disponibles dentro del radio.
  // Fire-and-forget: no bloquea la creación.
  void (async () => {
    try {
      const pickup = { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) };
      const radiusM = Math.max(250, Math.min(50_000, Number(ride.searchRadiusM ?? params.searchRadiusM ?? 2000)));
      const radiusKm = radiusM / 1000;
      const box = boundingBoxKm(pickup, radiusKm);
      const freshSince = driverLocationFreshSince();

      const drivers = await prisma.driverProfile.findMany({
        where: {
          status: DriverStatus.APPROVED,
          isAvailable: true,
          user: { is: { isActive: true } },
          serviceType: ride.serviceTypeWanted,
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

      const targets = drivers
        .map((d) => {
          const loc = d.location ? { lat: Number(d.location.lat), lng: Number(d.location.lng) } : null;
          const dist = loc ? haversineDistanceMeters(pickup, loc) : Number.NaN;
          return { userId: d.userId, distanceMeters: Math.round(dist) };
        })
        .filter((x) => Number.isFinite(x.distanceMeters) && x.distanceMeters <= radiusM)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, 50);

      emitToUsers(
        targets.map((t) => t.userId),
        "driver:nearby:changed",
        { type: "RIDE_AVAILABLE", rideId: ride.id, eventId: `RIDE_AVAILABLE:${ride.id}` }
      );

      await Promise.all(
        targets.map((t) =>
          sendPushToUser({
            userId: t.userId,
            title: "Solicitud cerca",
            body: "Nuevo cliente solicitó un servicio.",
            soundName: "disponibles",
            data: { rideId: ride.id, type: "RIDE_AVAILABLE", eventId: `RIDE_AVAILABLE:${ride.id}` },
          }).catch(() => null)
        )
      );
    } catch {
      // silencioso
    }
  })();

  // Admin ve todas las solicitudes
  void sendPushToAdmins({
    title: "Nueva solicitud",
    body: `Ride ${ride.id} (${params.serviceTypeWanted})`,
    data: { rideId: ride.id, type: "RIDE_CREATED" },
  });

  return { ok: true as const, ride };
}

export async function getRideById(rideId: string) {
  return prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: {
      passenger: { include: { user: { select: { id: true, email: true } } } },
      matchedDriver: {
        include: { user: { select: { id: true, email: true } }, vehicle: true, location: true },
      },
      addons: { include: { addon: true } },
      ratings: true,
    },
  });
}

export async function getRideByIdForRequester(params: {
  rideId: string;
  requester: { id: string; role: "ADMIN" | "USER" | "DRIVER" };
}) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: {
      passenger: { include: { user: { select: { id: true, email: true } } } },
      matchedDriver: {
        include: { user: { select: { id: true, email: true } }, vehicle: true, location: true },
      },
      addons: { include: { addon: true } },
      ratings: true,
    },
  });

  if (!ride) return { ok: false as const, status: 404 as const, error: "Ride not found" };

  if (params.requester.role === "ADMIN") return { ok: true as const, ride };
  if (params.requester.role === "USER" && ride.passenger.user.id === params.requester.id)
    return { ok: true as const, ride };
  if (params.requester.role === "DRIVER" && ride.matchedDriver?.user.id === params.requester.id)
    return { ok: true as const, ride };

  return { ok: false as const, status: 403 as const, error: "Forbidden" };
}

export async function listRideCandidates(params: { userId: string; rideId: string }) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return { ok: false as const, error: "Ride not found" };
  if (ride.passenger.userId !== params.userId) return { ok: false as const, error: "Forbidden" };

  const radiusKm = ride.searchRadiusM / 1000;
  const box = boundingBoxKm({ lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) }, radiusKm);

  const freshSince = driverLocationFreshSince();

  const drivers = await prisma.driverProfile.findMany({
    where: {
      isAvailable: true,
      user: { is: { isActive: true } },
      serviceType: ride.serviceTypeWanted,
      location: {
        is: {
          updatedAt: { gte: freshSince },
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
        },
      },
    },
    include: {
      location: true,
      vehicle: true,
      user: { select: { id: true, email: true } },
    },
    take: 200,
  });

  const pickup = { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) };

  const prelim = drivers
    .map((d) => {
      const location = d.location
        ? {
            lat: Number(d.location.lat),
            lng: Number(d.location.lng),
          }
        : null;

      const dist = location ? haversineDistanceMeters(pickup, location) : Number.NaN;

      return {
        driverId: d.id,
        fullName: d.fullName,
        photoUrl: d.photoUrl,
        serviceType: d.serviceType,
        vehicle: d.vehicle,
        location,
        distanceMeters: Math.round(dist),
        whatsappLink: buildWhatsappLink({
          phoneRaw: d.phone,
          text: `Hola ${d.fullName}, soy tu pasajero de Xpress Traslados.`,
        }),
      };
    })
    .filter((c) => c.location && Number.isFinite(c.distanceMeters) && c.distanceMeters <= ride.searchRadiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 50);

  const tableDistances = await getDrivingTableDistancesMeters({
    from: pickup,
    toMany: prelim.map((c) => ({ lat: c.location!.lat, lng: c.location!.lng })),
  });

  const candidates = prelim
    .map((c, idx) => {
      const d = tableDistances?.[idx];
      const distanceMeters = typeof d === "number" ? d : c.distanceMeters;
      // no exponemos location, sólo la usamos internamente
      const { location, ...rest } = c;
      return { ...rest, distanceMeters };
    })
    .filter((c) => c.distanceMeters <= ride.searchRadiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return { ok: true as const, ride, candidates };
}

export async function listNearbyRideRequestsForDriver(params: { userId: string; radiusM: number; take: number }) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId: params.userId },
    include: { location: true, user: { select: { isActive: true } } },
  });

  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };
  if (!driver.user?.isActive) return { ok: false as const, status: 403 as const, error: "Driver disabled" };
  if (!driver.location) return { ok: false as const, status: 400 as const, error: "Driver location missing" };

  const center = { lat: Number(driver.location.lat), lng: Number(driver.location.lng) };
  const radiusKm = params.radiusM / 1000;
  const box = boundingBoxKm(center, radiusKm);

  const raw = await prisma.rideRequest.findMany({
    where: {
      status: "OPEN",
      matchedDriverId: null,
      serviceTypeWanted: driver.serviceType,
      pickupLat: { gte: box.minLat, lte: box.maxLat },
      pickupLng: { gte: box.minLng, lte: box.maxLng },
      passenger: { is: { user: { is: { isActive: true } } } },
    },
    include: {
      passenger: {
        select: {
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          user: { select: { id: true } },
        },
      },
      candidates: {
        where: { driverId: driver.id },
        select: { status: true, createdAt: true, updatedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(params.take, 1) * 5),
  });

  const prelim = raw
    .map((r) => {
      const pickup = { lat: Number(r.pickupLat), lng: Number(r.pickupLng) };
      const dist = haversineDistanceMeters(center, pickup);
      const mine = r.candidates[0];

      return {
        rideId: r.id,
        pickup: {
          ...pickup,
          address: r.pickupAddress ?? undefined,
        },
        dropoff: {
          lat: Number(r.dropoffLat),
          lng: Number(r.dropoffLng),
          address: r.dropoffAddress ?? undefined,
        },
        estimatedPrice: Number(r.estimatedPrice),
        isFixedPrice: Boolean((r as any).isFixedPrice),
        fixedPriceCop:
          (r as any).fixedPriceCop != null && Number.isFinite(Number((r as any).fixedPriceCop))
            ? Number((r as any).fixedPriceCop)
            : null,
        createdAt: r.createdAt,
        passenger: {
          fullName: r.passenger.fullName,
          firstName: r.passenger.firstName,
          lastName: r.passenger.lastName,
          phone: r.passenger.phone,
          photoUrl: r.passenger.photoUrl,
        },
        myOffer: mine
          ? {
              status: mine.status,
              createdAt: mine.createdAt,
              updatedAt: mine.updatedAt,
            }
          : null,
        distanceMeters: Math.round(dist),
      };
    })
    .filter((x) => Number.isFinite(x.distanceMeters) && x.distanceMeters <= params.radiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, Math.min(100, Math.max(params.take, 1)));

  const tableDistances = await getDrivingTableDistancesMeters({
    from: center,
    toMany: prelim.map((x) => ({ lat: x.pickup.lat, lng: x.pickup.lng })),
  });

  const items = prelim
    .map((x, idx) => {
      const d = tableDistances?.[idx];
      return {
        ...x,
        distanceMeters: typeof d === "number" ? d : x.distanceMeters,
      };
    })
    .filter((x) => x.distanceMeters <= params.radiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return { ok: true as const, center, radiusM: params.radiusM, items };
}

export async function offerRideForDriver(params: { userId: string; rideId: string }) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId: params.userId },
    include: { location: true, user: { select: { isActive: true } } },
  });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };
  if (!driver.user?.isActive) return { ok: false as const, status: 403 as const, error: "Driver disabled" };

  const credits = await ensureDriverHasMinCredits({ userId: params.userId });
  if (!credits.ok) return { ok: false as const, status: credits.status, error: credits.error };

  if (!driver.isAvailable) return { ok: false as const, status: 400 as const, error: "Driver not available" };
  if (!driver.location) return { ok: false as const, status: 400 as const, error: "Driver location missing" };
  if (driver.location.updatedAt < driverLocationFreshSince()) {
    return { ok: false as const, status: 400 as const, error: "Driver offline" };
  }

  // Evitar que un chofer con servicio activo siga ofreciendo.
  const activeRide = await prisma.rideRequest.findFirst({
    where: {
      matchedDriverId: driver.id,
      status: {
        in: [RideStatus.ASSIGNED, RideStatus.ACCEPTED, RideStatus.MATCHED, RideStatus.IN_PROGRESS],
      },
    },
    select: { id: true, status: true },
  });

  if (activeRide) {
    return { ok: false as const, status: 409 as const, error: "Driver has an active ride" };
  }

  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: { passenger: { select: { userId: true, user: { select: { isActive: true } } } } },
  });
  if (!ride) return { ok: false as const, status: 404 as const, error: "Ride not found" };
  if (!ride.passenger.user.isActive) return { ok: false as const, status: 403 as const, error: "Passenger disabled" };

  if (ride.status !== "OPEN" || ride.matchedDriverId) {
    return { ok: false as const, status: 400 as const, error: "Ride is not offerable" };
  }

  if (ride.serviceTypeWanted !== driver.serviceType) {
    return { ok: false as const, status: 400 as const, error: "Ride service type mismatch" };
  }

  const dist = haversineDistanceMeters(
    { lat: Number(driver.location.lat), lng: Number(driver.location.lng) },
    { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) }
  );
  if (dist > ride.searchRadiusM) {
    return { ok: false as const, status: 400 as const, error: "Ride out of radius" };
  }

  const existing = await prisma.rideCandidate.findFirst({
    where: { rideId: ride.id, driverId: driver.id },
  });

  if (existing?.status === RideCandidateStatus.REJECTED) {
    return { ok: false as const, status: 409 as const, error: "Passenger rejected this offer" };
  }
  if (existing?.status === RideCandidateStatus.SELECTED) {
    return { ok: false as const, status: 409 as const, error: "Already selected" };
  }

  // Evita spam por taps repetidos.
  if (existing?.status === RideCandidateStatus.OFFERED) {
    return { ok: true as const, candidate: existing };
  }

  const candidate = existing
    ? await prisma.rideCandidate.update({
        where: { id: existing.id },
        data: { status: RideCandidateStatus.OFFERED },
      })
    : await prisma.rideCandidate.create({
        data: { rideId: ride.id, driverId: driver.id, status: RideCandidateStatus.OFFERED },
      });

  emitToUser(ride.passenger.userId, "ride:offers:changed", { rideId: ride.id });
  emitToUser(ride.passenger.userId, "ride:changed", {
    rideId: ride.id,
    driverId: driver.id,
    type: "RIDE_OFFERED",
    eventId: `RIDE_OFFERED:${ride.id}:${driver.id}`,
  });

  // Push al cliente por cada ejecutivo que se ofrece.
  void sendPushToUser({
    userId: ride.passenger.userId,
    title: "Nueva oferta",
    body: `${driver.fullName} se ofreció.`,
    soundName: "aceptar_servicio",
    data: {
      rideId: ride.id,
      driverId: driver.id,
      type: "RIDE_OFFERED",
      eventId: `RIDE_OFFERED:${ride.id}:${driver.id}`,
    },
  });

  return { ok: true as const, candidate };
}

export async function listRideOffersForPassenger(params: { userId: string; rideId: string }) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return { ok: false as const, status: 404 as const, error: "Ride not found" };
  if (ride.passenger.userId !== params.userId) return { ok: false as const, status: 403 as const, error: "Forbidden" };

  if (ride.status !== "OPEN" || ride.matchedDriverId) {
    return { ok: true as const, ride, items: [] as any[] };
  }

  const freshSince = driverLocationFreshSince();

  const offered = await prisma.rideCandidate.findMany({
    where: { rideId: ride.id, status: RideCandidateStatus.OFFERED },
    include: {
      driver: {
        include: { location: true, vehicle: true, user: { select: { isActive: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const items = offered
    .map((c) => {
      const d = c.driver;
      if (!d.user?.isActive) return null;
      if (!d.location) return null;
      if (d.location.updatedAt < freshSince) return null;

      const dist = haversineDistanceMeters(
        { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) },
        { lat: Number(d.location.lat), lng: Number(d.location.lng) }
      );

      return {
        driverId: d.id,
        fullName: d.fullName,
        photoUrl: d.photoUrl,
        serviceType: d.serviceType,
        vehicle: d.vehicle,
        driverLocation: {
          lat: Number(d.location.lat),
          lng: Number(d.location.lng),
          updatedAt: d.location.updatedAt,
        },
        distanceMeters: Math.round(dist),
        offeredAt: c.createdAt,
        whatsappLink: buildWhatsappLink({
          phoneRaw: d.phone,
          text: `Hola ${d.fullName}, soy tu pasajero de Xpress Traslados.`,
        }),
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    // Refiltramos por radio vigente para que la lista se mantenga consistente
    .filter((x) => x.distanceMeters <= ride.searchRadiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 50);

  return { ok: true as const, ride, items };
}

export async function rejectRideOfferForPassenger(params: { userId: string; rideId: string; driverId: string }) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return { ok: false as const, status: 404 as const, error: "Ride not found" };
  if (ride.passenger.userId !== params.userId) return { ok: false as const, status: 403 as const, error: "Forbidden" };

  if (ride.status !== "OPEN" || ride.matchedDriverId) {
    return { ok: false as const, status: 400 as const, error: "Ride is not editable" };
  }

  const existing = await prisma.rideCandidate.findFirst({
    where: { rideId: ride.id, driverId: params.driverId },
  });

  if (!existing) return { ok: false as const, status: 404 as const, error: "Offer not found" };
  if (existing.status === RideCandidateStatus.REJECTED) return { ok: true as const, candidate: existing };
  if (existing.status === RideCandidateStatus.SELECTED) {
    return { ok: false as const, status: 409 as const, error: "Offer already selected" };
  }

  const updated = await prisma.rideCandidate.update({
    where: { id: existing.id },
    data: { status: RideCandidateStatus.REJECTED },
  });

  emitToUser(params.userId, "ride:offers:changed", { rideId: ride.id });

  return { ok: true as const, candidate: updated };
}

export async function selectDriver(params: { userId: string; rideId: string; driverId: string }) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return { ok: false as const, error: "Ride not found" };
  if (ride.passenger.userId !== params.userId) return { ok: false as const, error: "Forbidden" };

  if (ride.status !== "OPEN") {
    return { ok: false as const, error: "Ride is not selectable" };
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { id: params.driverId },
    include: { location: true, vehicle: true, user: { select: { isActive: true } } },
  });

  if (!driver) return { ok: false as const, error: "Driver not found" };
  if (!driver.user?.isActive) return { ok: false as const, error: "Driver disabled" };

  const credits = await ensureDriverHasMinCredits({ userId: driver.userId, audience: "USER" });
  if (!credits.ok) return { ok: false as const, status: credits.status, error: credits.error };

  if (!driver.isAvailable) return { ok: false as const, error: "Driver not available" };
  if (!driver.location) return { ok: false as const, error: "Driver location missing" };
  if (driver.location.updatedAt < driverLocationFreshSince()) return { ok: false as const, error: "Driver offline" };

  // Si el chofer ya tiene un servicio activo, no puede ser seleccionado en otro.
  const driverActiveRide = await prisma.rideRequest.findFirst({
    where: {
      matchedDriverId: driver.id,
      id: { not: ride.id },
      status: {
        in: [RideStatus.ASSIGNED, RideStatus.ACCEPTED, RideStatus.MATCHED, RideStatus.IN_PROGRESS],
      },
    },
    select: { id: true, status: true },
  });

  if (driverActiveRide) {
    return { ok: false as const, error: "Driver has an active ride" };
  }

  const dist = haversineDistanceMeters(
    { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) },
    { lat: Number(driver.location.lat), lng: Number(driver.location.lng) }
  );

  if (dist > ride.searchRadiusM) {
    return { ok: false as const, error: "Driver out of radius" };
  }

  const offer = await prisma.rideCandidate.findFirst({
    where: { rideId: ride.id, driverId: driver.id, status: RideCandidateStatus.OFFERED },
  });
  if (!offer) {
    return { ok: false as const, error: "Driver has not offered this ride" };
  }

  const now = new Date();

  let updated;
  let withdrawnOffers: Array<{ rideId: string; passengerUserId: string }> = [];
  let rejectedDrivers: string[] = [];
  try {
    const txResult = await prisma.$transaction(async (tx) => {
      const fresh = await tx.rideRequest.findUnique({ where: { id: ride.id } });
      if (!fresh || fresh.status !== "OPEN" || fresh.matchedDriverId) {
        throw new Error("Ride is not selectable");
      }

      const sameRideRejected = await tx.rideCandidate.findMany({
        where: { rideId: ride.id, driverId: { not: driver.id }, status: RideCandidateStatus.OFFERED },
        select: { driver: { select: { userId: true } } },
      });

      await tx.rideCandidate.update({
        where: { id: offer.id },
        data: { status: RideCandidateStatus.SELECTED },
      });

      await tx.rideCandidate.updateMany({
        where: { rideId: ride.id, driverId: { not: driver.id }, status: RideCandidateStatus.OFFERED },
        data: { status: RideCandidateStatus.REJECTED },
      });

      // Al seleccionar un chofer, retiramos sus otras ofertas pendientes en rides abiertos.
      const otherOffered = await tx.rideCandidate.findMany({
        where: {
          driverId: driver.id,
          rideId: { not: ride.id },
          status: RideCandidateStatus.OFFERED,
          ride: { status: "OPEN", matchedDriverId: null },
        },
        select: {
          rideId: true,
          ride: { select: { passenger: { select: { userId: true } } } },
        },
      });

      await tx.rideCandidate.updateMany({
        where: {
          driverId: driver.id,
          rideId: { not: ride.id },
          status: RideCandidateStatus.OFFERED,
          ride: { status: "OPEN", matchedDriverId: null },
        },
        data: { status: RideCandidateStatus.WITHDRAWN },
      });

      const updatedRide = await tx.rideRequest.update({
        where: { id: ride.id },
        data: {
          matchedDriverId: driver.id,
          matchedAt: now,
          status: "ACCEPTED",
          acceptedAt: now,
          assignedByAdmin: false,
        },
        include: {
          matchedDriver: { include: { vehicle: true, location: true } },
          passenger: true,
        },
      });

      return {
        ride: updatedRide,
        rejectedDrivers: sameRideRejected.map((item) => item.driver.userId).filter(Boolean),
        withdrawnOffers: otherOffered
          .map((x) => ({ rideId: x.rideId, passengerUserId: x.ride.passenger.userId }))
          .filter((x) => Boolean(x.passengerUserId)),
      };
    });

    updated = txResult.ride;
    rejectedDrivers = txResult.rejectedDrivers;
    withdrawnOffers = txResult.withdrawnOffers;
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Ride is not selectable" };
  }

  emitToUser(params.userId, "ride:matched", { rideId: updated.id, driverId: driver.id });
  emitToUser(driver.userId, "ride:matched", { rideId: updated.id });
  emitToUser(params.userId, "ride:offers:changed", { rideId: updated.id });
  emitToUser(params.userId, "ride:changed", { rideId: updated.id, type: "RIDE_MATCHED" });
  emitToUser(driver.userId, "ride:changed", { rideId: updated.id, type: "RIDE_MATCHED" });
  emitToUsers(rejectedDrivers, "ride:changed", { rideId: updated.id, type: "RIDE_NOT_SELECTED" });
  emitToUsers(rejectedDrivers, "driver:nearby:changed", { rideId: updated.id, type: "RIDE_SELECTION_CHANGED" });

  for (const item of withdrawnOffers) {
    emitToUser(item.passengerUserId, "ride:offers:changed", { rideId: item.rideId });
  }

  sendPushToUserBurst({
    userId: driver.userId,
    title: "Nuevo servicio",
    body: "Fuiste seleccionado para un servicio",
    soundName: "tienes_servicio",
    times: 2,
    intervalMs: 1200,
    data: { rideId: updated.id, type: "RIDE_ACCEPTED" },
  });

  void sendPushToAdmins({
    title: "Servicio aceptado (auto)",
    body: `Ride ${updated.id} -> Driver ${driver.id}`,
    data: { rideId: updated.id, driverId: driver.id, type: "RIDE_ACCEPTED" },
  });

  return { ok: true as const, ride: updated };
}

export async function confirmRideComplete(params: {
  rideId: string;
  requester: { id: string; role: "ADMIN" | "USER" | "DRIVER" };
}) {
  if (params.requester.role === "USER") {
    return { ok: false as const, status: 403 as const, error: "Passenger confirmation is not supported" };
  }

  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: {
      passenger: { select: { userId: true } },
      matchedDriver: { select: { userId: true } },
    },
  });

  if (!ride) return { ok: false as const, status: 404 as const, error: "Ride not found" };
  if (ride.status === "CANCELLED" || ride.status === "EXPIRED") {
    return { ok: false as const, status: 400 as const, error: "Ride is not completable" };
  }

  const isDriver = params.requester.role === "DRIVER" && ride.matchedDriver?.userId === params.requester.id;

  if (!isDriver && params.requester.role !== "ADMIN") {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const now = new Date();

  const closed = await prisma.rideRequest.update({
    where: { id: ride.id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      ...(isDriver ? { driverCompletedConfirmedAt: now } : null),
    },
    include: {
      passenger: { include: { user: { select: { id: true, email: true } } } },
      matchedDriver: { include: { user: { select: { id: true, email: true } }, vehicle: true, location: true } },
      addons: { include: { addon: true } },
      ratings: true,
    },
  });

  // Descontar créditos al chofer (idempotente). (Se deja para lo último: flag)
  void chargeDriverCreditsForCompletedRide({ rideId: closed.id, now });

  return { ok: true as const, ride: closed };
}
