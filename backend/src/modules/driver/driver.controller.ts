import type { Request, Response } from "express";
import { ServiceType } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { SetAvailabilitySchema, UpdateMeterSchema, UpsertLocationSchema } from "./driver.schemas";
import { sendPushToAdmins, sendPushToUser } from "../notifications/notifications.service";
import { chargeDriverCreditsForCompletedRide } from "../credits/credits.service";
import { env } from "../../utils/env";
import { calculateFare } from "../../utils/fare";
import { effectiveBaseFare } from "../config/appConfig.service";
import { emitToUser } from "../../realtime/realtime";

function pricingServiceTypeFor(serviceTypeWanted: ServiceType): ServiceType {
  return serviceTypeWanted;
}

export async function driverGetMeController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    include: { driver: { include: { vehicle: true, documents: true, location: true } } },
  });

  return res.status(200).json({ ok: true, user: me && { id: me.id, email: me.email, role: me.role, driver: me.driver } });
}

export async function driverSetAvailabilityController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = SetAvailabilitySchema.parse(req.body);

  const updated = await prisma.driverProfile.update({
    where: { userId },
    data: { isAvailable: input.isAvailable },
  });

  return res.status(200).json({ ok: true, driver: updated });
}

export async function driverUpsertLocationController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = UpsertLocationSchema.parse(req.body);

  const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  const [location] = await prisma.$transaction([
    prisma.driverLocation.upsert({
      where: { driverId: driver.id },
      update: { lat: input.lat, lng: input.lng },
      create: { driverId: driver.id, lat: input.lat, lng: input.lng },
    }),
    prisma.driverProfile.update({
      where: { userId },
      data: { isAvailable: true },
    }),
  ]);

  return res.status(200).json({ ok: true, location });
}

export async function driverListMyRidesController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const take = req.query.take ? Math.min(50, Math.max(1, Number(req.query.take))) : 10;

  const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  const rides = await prisma.rideRequest.findMany({
    where: { matchedDriverId: driver.id },
    orderBy: { createdAt: "desc" },
    take,
  });

  return res.status(200).json({ ok: true, rides });
}

export async function driverAcceptRideController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { rideId } = req.params;
  const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  if (ride.matchedDriverId !== driver.id) return res.status(403).json({ message: "Forbidden" });
  if (ride.status !== "ASSIGNED" && ride.status !== "MATCHED") {
    return res.status(400).json({ message: "Ride not in ASSIGNED" });
  }

  const updated = await prisma.rideRequest.update({
    where: { id: ride.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  emitToUser(ride.passenger.userId, "ride:changed", { rideId: updated.id, type: "RIDE_ACCEPTED" });
  emitToUser(userId, "ride:changed", { rideId: updated.id, type: "RIDE_ACCEPTED" });

  void sendPushToUser({
    userId: ride.passenger.userId,
    title: "Servicio aceptado",
    body: "Tu chofer aceptó tu servicio",
    soundName: "aceptar_servicio",
    data: { rideId: updated.id, type: "RIDE_ACCEPTED" },
  });

  void sendPushToAdmins({
    title: "Servicio aceptado",
    body: `Ride ${updated.id}`,
    data: { rideId: updated.id, type: "RIDE_ACCEPTED" },
  });

  return res.status(200).json({ ok: true, ride: updated });
}

export async function driverStartRideController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { rideId } = req.params;
  const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  if (ride.matchedDriverId !== driver.id) return res.status(403).json({ message: "Forbidden" });
  if (ride.status !== "ACCEPTED") return res.status(400).json({ message: "Ride not in ACCEPTED" });

  const updated = await prisma.rideRequest.update({
    where: { id: ride.id },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });

  emitToUser(ride.passenger.userId, "ride:changed", { rideId: updated.id, type: "RIDE_STARTED" });
  emitToUser(userId, "ride:changed", { rideId: updated.id, type: "RIDE_STARTED" });

  void sendPushToUser({
    userId: ride.passenger.userId,
    title: "Servicio iniciado",
    body: "Tu chofer inició tu servicio",
    data: { rideId: updated.id, type: "RIDE_STARTED" },
  });

  void sendPushToAdmins({
    title: "Servicio iniciado",
    body: `Ride ${updated.id}`,
    data: { rideId: updated.id, type: "RIDE_STARTED" },
  });

  return res.status(200).json({ ok: true, ride: updated });
}

export async function driverUpdateMeterController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { rideId } = req.params;
  const input = UpdateMeterSchema.parse(req.body);

  const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: { addons: { include: { addon: true } } },
  });
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  if (ride.matchedDriverId !== driver.id) return res.status(403).json({ message: "Forbidden" });
  if (ride.status !== "IN_PROGRESS") return res.status(400).json({ message: "Ride not in progress" });

  const pricingType = pricingServiceTypeFor(ride.serviceTypeWanted as ServiceType);
  const pricing = await prisma.pricingConfig.findUnique({ where: { serviceType: pricingType } });
  if (!pricing) return res.status(500).json({ message: "Pricing not configured for this service type" });

  // Si la ride tiene precio acordado (contraoferta), no depende del taxímetro.
  const agreed = Number(ride.agreedPrice ?? 0);
  const isAgreed = Number.isFinite(agreed) && agreed > 0;

  let baseFare = Number(ride.pricingBaseFare ?? 0);
  if (!(Number.isFinite(baseFare) && baseFare > 0)) {
    const now = new Date();
    const pricingNightBaseFare = Math.max(0, Number((pricing as any).nightBaseFare ?? 0));
    const pricingNightStartHour = Number((pricing as any).nightStartHour ?? 20);
    const pricingNightEndHour = Number((pricing as any).nightEndHour ?? 23);
    baseFare = effectiveBaseFare({
      dayBaseFare: Number(pricing.baseFare),
      now,
      nightBaseFare: pricingNightBaseFare,
      nightStartHour: pricingNightStartHour,
      nightEndHour: pricingNightEndHour,
    });
  }

  const perKm = Number(ride.pricingPerKm ?? pricing.perKm);

  const ac = Number(ride.pricingAcSurcharge ?? pricing.acSurcharge);
  const trunk = Number(ride.pricingTrunkSurcharge ?? pricing.trunkSurcharge);
  const pets = Number(ride.pricingPetsSurcharge ?? pricing.petsSurcharge);

  const surcharge = (ride.wantsAC ? ac : 0) + (ride.wantsTrunk ? trunk : 0) + (ride.wantsPets ? pets : 0);
  const addonsTotal = (ride.addons ?? []).reduce((sum, a) => sum + Number(a.addon.amount), 0);

  // Si la ride es de precio fijo por zona, el taxímetro no recalcula.
  const fixedPrice = Number((ride as any).fixedPriceCop ?? 0);
  const isFixed = !!(ride as any).isFixedPrice && Number.isFinite(fixedPrice) && fixedPrice > 0;

  const meterPrice = isAgreed
    ? Math.max(0, Math.round(agreed * 100) / 100)
    : isFixed
      ? Math.max(0, Math.round(fixedPrice * 100) / 100)
      : calculateFare({
          distanceMeters: input.meterDistanceMeters,
          baseFare,
          perKm,
          includedKm: env.METER_INCLUDED_KM,
          includedMeters: Number(ride.pricingIncludedMeters ?? (pricing as any).includedMeters ?? 0),
          stepMeters: Number(ride.pricingStepMeters ?? (pricing as any).stepMeters ?? 0),
          stepPrice: Number(ride.pricingStepPrice ?? (pricing as any).stepPrice ?? 0),
          surcharge,
          addonsTotal,
        });

  const updated = await prisma.rideRequest.update({
    where: { id: ride.id },
    data: {
      meterDistanceMeters: input.meterDistanceMeters,
      meterPrice,
    },
  });

  return res.status(200).json({ ok: true, ride: updated });
}

export async function driverNotifyArrivedController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { rideId } = req.params;

  const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  if (ride.matchedDriverId !== driver.id) return res.status(403).json({ message: "Forbidden" });

  // Notificar llegada es previo a iniciar.
  if (ride.status !== "ACCEPTED") {
    return res.status(400).json({ message: "Ride not in ACCEPTED" });
  }

  const now = new Date();
  await prisma.rideRequest.update({
    where: { id: ride.id },
    data: { driverArrivedNotifiedAt: now },
  });

  const eventId = `DRIVER_ARRIVED:${ride.id}:${now.getTime()}`;

  emitToUser(ride.passenger.userId, "ride:changed", { rideId: ride.id, type: "DRIVER_ARRIVED", eventId });

  const first = await sendPushToUser({
    userId: ride.passenger.userId,
    title: "Tu ejecutivo está en el lugar",
    body: "Tu ejecutivo ya llegó al punto de recogida.",
    soundName: "uber_llego",
    data: { rideId: ride.id, type: "DRIVER_ARRIVED", eventId },
  });

  // Si no hay FCM en producción, mejor avisar explícitamente.
  if (!first.ok && first.reason === "FCM_NOT_CONFIGURED") {
    return res.status(503).json({
      ok: false,
      message: "Notificaciones no configuradas en el servidor (FCM).",
    });
  }

  // Si el pasajero no tiene tokens registrados, no se puede notificar.
  if (first.ok && first.sent === 0) {
    return res.status(409).json({
      ok: false,
      message: "El cliente no tiene notificaciones activas (sin token registrado).",
    });
  }

  return res.status(200).json({ ok: true, push: first });
}

export async function driverCompleteRideController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { rideId } = req.params;
  const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) return res.status(404).json({ message: "Driver not found" });

  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return res.status(404).json({ message: "Ride not found" });
  if (ride.matchedDriverId !== driver.id) return res.status(403).json({ message: "Forbidden" });
  if (ride.status !== "IN_PROGRESS") return res.status(400).json({ message: "Ride not in progress" });

  const now = new Date();

  // Cierre por parte del chofer (sin confirmación del pasajero)
  const closed = await prisma.rideRequest.update({
    where: { id: ride.id },
    data: { status: "COMPLETED", completedAt: now, driverCompletedConfirmedAt: now },
  });

  emitToUser(ride.passenger.userId, "ride:changed", { rideId: closed.id, type: "RIDE_COMPLETED" });
  emitToUser(userId, "ride:changed", { rideId: closed.id, type: "RIDE_COMPLETED" });

  // Descontar créditos al chofer (idempotente). (Se deja para lo último: flag)
  void chargeDriverCreditsForCompletedRide({ rideId: closed.id, now });

  void sendPushToUser({
    userId: ride.passenger.userId,
    title: "Servicio finalizado",
    body: "Tu servicio fue finalizado.",
    data: { rideId: closed.id, type: "RIDE_COMPLETED" },
  });

  void sendPushToAdmins({
    title: "Servicio finalizado",
    body: `Ride ${closed.id}`,
    data: { rideId: closed.id, type: "RIDE_COMPLETED" },
  });

  return res.status(200).json({ ok: true, ride: closed });
}
