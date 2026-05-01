import { UserRole } from "@prisma/client";
import { prisma } from "../../db/prisma";

export async function last10Counterparties(params: { userId: string; role: "USER" | "DRIVER" | "ADMIN" }) {
  if (params.role === UserRole.ADMIN) {
    return { ok: false as const, error: "Admin has no counterpart history" };
  }

  if (params.role === UserRole.USER) {
    const passenger = await prisma.passengerProfile.findUnique({ where: { userId: params.userId }, select: { id: true } });
    if (!passenger) return { ok: false as const, error: "Passenger profile not found" };

    const rides = await prisma.rideRequest.findMany({
      where: { passengerId: passenger.id, matchedDriverId: { not: null } },
      orderBy: { matchedAt: "desc" },
      take: 10,
      include: { matchedDriver: { include: { vehicle: true } } },
    });

    const items = rides
      .filter((r) => r.matchedDriver)
      .map((r) => ({
        rideId: r.id,
        at: r.matchedAt ?? r.createdAt,
        driver: {
          id: r.matchedDriver!.id,
          fullName: r.matchedDriver!.fullName,
          phone: r.matchedDriver!.phone,
          photoUrl: r.matchedDriver!.photoUrl,
          serviceType: r.matchedDriver!.serviceType,
          vehicle: r.matchedDriver!.vehicle,
        },
      }));

    return { ok: true as const, items };
  }

  const driver = await prisma.driverProfile.findUnique({ where: { userId: params.userId }, select: { id: true } });
  if (!driver) return { ok: false as const, error: "Driver profile not found" };

  const rides = await prisma.rideRequest.findMany({
    where: { matchedDriverId: driver.id },
    orderBy: { matchedAt: "desc" },
    take: 10,
    include: { passenger: true },
  });

  const passengerUserIds = rides.map((r) => r.passenger.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: passengerUserIds } },
    include: { passenger: true },
  });

  const map = new Map(users.map((u) => [u.id, u.passenger]));

  const items = rides.map((r) => ({
    rideId: r.id,
    at: r.matchedAt ?? r.createdAt,
    passenger: map.get(r.passenger.userId),
  }));

  return { ok: true as const, items };
}
