import type { Request, Response } from "express";
import {
  CreateRideSchema,
  DriverNearbyRequestsSchema,
  DriverTechSheetParamsSchema,
  NearbyDriversSchema,
  RideOfferParamsSchema,
  SelectDriverSchema,
} from "./rides.schemas";
import {
  confirmRideComplete,
  createRide,
  getDriverTechSheetForUser,
  getRideByIdForRequester,
  getActiveRideForRequester,
  listNearbyRideRequestsForDriver,
  listNearbyDrivers,
  listRideOffersForPassenger,
  listRideCandidates,
  offerRideForDriver,
  rejectRideOfferForPassenger,
  selectDriver,
} from "./rides.service";
import { prisma } from "../../db/prisma";

export async function getActiveRideController(req: Request, res: Response) {
  const requesterId = req.user?.id;
  const requesterRole = req.user?.role;
  if (!requesterId || !requesterRole) return res.status(401).json({ message: "Unauthorized" });

  const result = await getActiveRideForRequester({ requester: { id: requesterId, role: requesterRole } });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json({ ok: true, ride: result.ride });
}

export async function createRideController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = CreateRideSchema.parse(req.body);
  const result = await createRide({
    userId,
    serviceTypeWanted: input.serviceTypeWanted,
    pickup: input.pickup,
    dropoff: input.dropoff,
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
    routePath: input.routePath,
    wantsAC: input.wantsAC,
    wantsTrunk: input.wantsTrunk,
    wantsPets: input.wantsPets,
    addonIds: input.addonIds,
    searchRadiusM: input.searchRadiusM,
  });

  if (!result.ok) {
    const status = (result as any).status ?? 400;
    return res.status(status).json({
      ok: false,
      message: result.error,
      code: (result as any).code,
      details: (result as any).details,
    });
  }
  return res.status(201).json(result);
}

export async function getRideController(req: Request, res: Response) {
  const requesterId = req.user?.id;
  const requesterRole = req.user?.role;
  if (!requesterId || !requesterRole) return res.status(401).json({ message: "Unauthorized" });

  const rideId = req.params.rideId;
  const result = await getRideByIdForRequester({
    rideId,
    requester: { id: requesterId, role: requesterRole },
  });

  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json({ ok: true, ride: result.ride });
}

export async function listMyRidesController(req: Request, res: Response) {
  const userId = req.user?.id;
  const role = req.user?.role;
  if (!userId || !role) return res.status(401).json({ message: "Unauthorized" });

  const take = req.query.take ? Math.min(50, Math.max(1, Number(req.query.take))) : 10;

  if (role === "USER") {
    const passenger = await prisma.passengerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!passenger) return res.status(404).json({ message: "Passenger not found" });

    const rides = await prisma.rideRequest.findMany({
      where: { passengerId: passenger.id },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        matchedDriver: { select: { id: true, fullName: true, phone: true, photoUrl: true, serviceType: true, vehicle: true } },
        passenger: { select: { id: true, fullName: true, phone: true, photoUrl: true, user: { select: { email: true } } } },
      },
    });

    return res.status(200).json({ ok: true, rides });
  }

  if (role === "DRIVER") {
    const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const rides = await prisma.rideRequest.findMany({
      where: { matchedDriverId: driver.id },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        passenger: { select: { id: true, fullName: true, phone: true, photoUrl: true, user: { select: { email: true } } } },
        matchedDriver: { select: { id: true, fullName: true, phone: true, photoUrl: true, serviceType: true, vehicle: true } },
      },
    });

    return res.status(200).json({ ok: true, rides });
  }

  return res.status(403).json({ message: "Forbidden" });
}

export async function getRideCandidatesController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const rideId = req.params.rideId;
  const result = await listRideCandidates({ userId, rideId });
  if (!result.ok) return res.status(403).json({ message: result.error });

  return res.status(200).json({ ok: true, ride: result.ride, candidates: result.candidates });
}

export async function nearbyDriversController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = NearbyDriversSchema.parse(req.query);

  const result = await listNearbyDrivers({
    userId,
    center: { lat: input.lat, lng: input.lng },
    radiusM: input.radiusM,
    serviceType: input.serviceType,
  });
  return res.status(200).json(result);
}

export async function getDriverTechSheetController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = DriverTechSheetParamsSchema.parse(req.params);
  const result = await getDriverTechSheetForUser({ driverId: input.driverId });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function selectRideDriverController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const rideId = req.params.rideId;
  const input = SelectDriverSchema.parse(req.body);

  const result = await selectDriver({ userId, rideId, driverId: input.driverId });
  if (!result.ok) {
    const status = (result as any).status;
    return res.status(typeof status === "number" ? status : 400).json({ message: result.error });
  }

  return res.status(200).json(result);
}

export async function driverNearbyRequestsController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = DriverNearbyRequestsSchema.parse(req.query);

  const result = await listNearbyRideRequestsForDriver({ userId, radiusM: input.radiusM, take: input.take });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function driverOfferRideController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const rideId = req.params.rideId;
  const parsed = RideOfferParamsSchema.parse({ rideId });

  const result = await offerRideForDriver({ userId, rideId: parsed.rideId });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function getRideOffersController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const rideId = req.params.rideId;
  const parsed = RideOfferParamsSchema.parse({ rideId });

  const result = await listRideOffersForPassenger({ userId, rideId: parsed.rideId });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function rejectRideOfferController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { rideId, driverId } = req.params;
  const parsed = RideOfferParamsSchema.parse({ rideId, driverId });
  if (!parsed.driverId) return res.status(400).json({ message: "driverId required" });

  const result = await rejectRideOfferForPassenger({ userId, rideId: parsed.rideId, driverId: parsed.driverId });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function confirmRideCompleteController(req: Request, res: Response) {
  const requesterId = req.user?.id;
  const requesterRole = req.user?.role;
  if (!requesterId || !requesterRole) return res.status(401).json({ message: "Unauthorized" });

  const rideId = req.params.rideId;
  const result = await confirmRideComplete({
    rideId,
    requester: { id: requesterId, role: requesterRole },
  });

  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json({ ok: true, ride: result.ride });
}

export async function cancelRideController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const rideId = req.params.rideId;
  const ride = await prisma.rideRequest.findUnique({
    where: { id: rideId },
    include: { passenger: { select: { userId: true } } },
  });

  if (!ride) return res.status(404).json({ message: "Ride not found" });
  if (ride.passenger.userId !== userId) return res.status(403).json({ message: "Forbidden" });
  if (ride.status === "IN_PROGRESS" || ride.status === "COMPLETED") {
    return res.status(400).json({ message: "Ride cannot be cancelled" });
  }

  const updated = await prisma.rideRequest.update({
    where: { id: ride.id },
    data: { status: "CANCELLED" },
  });

  return res.status(200).json({ ok: true, ride: updated });
}
