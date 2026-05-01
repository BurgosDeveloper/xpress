import { UserRole } from "@prisma/client";
import { prisma } from "../../db/prisma";

function splitName(fullName: string) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || "";
  return { firstName, lastName };
}

export async function getMyProfile(params: { userId: string; role: "USER" | "DRIVER" | "ADMIN" }) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) return { ok: false as const, status: 404 as const, error: "User not found" };

  if (user.role === UserRole.ADMIN) {
    return {
      ok: true as const,
      profile: {
        role: user.role,
        user: { email: user.email, username: user.username ?? null },
        passenger: null,
        driver: null,
        password: { masked: true },
      },
    };
  }

  if (user.role === UserRole.USER) {
    const passenger = await prisma.passengerProfile.findUnique({ where: { userId: user.id } });
    if (!passenger) return { ok: false as const, status: 404 as const, error: "Passenger profile not found" };

    const fallback = splitName(passenger.fullName);

    return {
      ok: true as const,
      profile: {
        role: user.role,
        user: { email: user.email, username: user.username ?? null },
        passenger: {
          fullName: passenger.fullName,
          firstName: passenger.firstName ?? fallback.firstName,
          lastName: passenger.lastName ?? fallback.lastName,
          phone: passenger.phone,
        },
        driver: null,
        password: { masked: true },
      },
    };
  }

  // DRIVER
  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id }, include: { vehicle: true } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver profile not found" };

  const fallback = splitName(driver.fullName);

  return {
    ok: true as const,
    profile: {
      role: user.role,
      user: { email: user.email, username: user.username ?? null },
      passenger: null,
      driver: {
        fullName: driver.fullName,
        firstName: driver.firstName ?? fallback.firstName,
        lastName: driver.lastName ?? fallback.lastName,
        phone: driver.phone,
        mobilePayBank: driver.mobilePayBank ?? null,
        mobilePayDocument: driver.mobilePayDocument ?? null,
        mobilePayPhone: driver.mobilePayPhone ?? null,
        photoUrl: driver.photoUrl,
        serviceType: driver.serviceType,
        vehicle: driver.vehicle
          ? {
              brand: driver.vehicle.brand,
              model: driver.vehicle.model,
              plate: driver.vehicle.plate ?? null,
              year: driver.vehicle.year,
              color: driver.vehicle.color,
            }
          : null,
      },
      password: { masked: true },
    },
  };
}

export async function updateMyPassengerProfile(params: {
  userId: string;
  input: { firstName?: string; lastName?: string; phone?: string; email?: string };
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) return { ok: false as const, status: 404 as const, error: "User not found" };
  if (user.role !== UserRole.USER) return { ok: false as const, status: 403 as const, error: "Forbidden" };

  const passenger = await prisma.passengerProfile.findUnique({ where: { userId: user.id } });
  if (!passenger) return { ok: false as const, status: 404 as const, error: "Passenger profile not found" };

  const nextFirst = params.input.firstName ?? passenger.firstName ?? splitName(passenger.fullName).firstName;
  const nextLast = params.input.lastName ?? passenger.lastName ?? splitName(passenger.fullName).lastName;
  const nextFullName = `${nextFirst} ${nextLast}`.trim();

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = params.input.email
        ? await tx.user.update({ where: { id: user.id }, data: { email: params.input.email } })
        : user;

      const updatedPassenger = await tx.passengerProfile.update({
        where: { id: passenger.id },
        data: {
          fullName: nextFullName.length ? nextFullName : passenger.fullName,
          firstName: params.input.firstName ?? undefined,
          lastName: params.input.lastName ?? undefined,
          phone: params.input.phone ?? undefined,
        },
      });

      return { updatedUser, updatedPassenger };
    });

    return { ok: true as const, user: { email: updated.updatedUser.email }, passenger: updated.updatedPassenger };
  } catch {
    return { ok: false as const, status: 400 as const, error: "Could not update profile" };
  }
}

export async function updateMyDriverProfile(params: {
  userId: string;
  input: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    mobilePayBank?: string | null;
    mobilePayDocument?: string | null;
    mobilePayPhone?: string | null;
  };
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) return { ok: false as const, status: 404 as const, error: "User not found" };
  if (user.role !== UserRole.DRIVER) return { ok: false as const, status: 403 as const, error: "Forbidden" };

  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver profile not found" };

  const nextFirst = params.input.firstName ?? driver.firstName ?? splitName(driver.fullName).firstName;
  const nextLast = params.input.lastName ?? driver.lastName ?? splitName(driver.fullName).lastName;
  const nextFullName = `${nextFirst} ${nextLast}`.trim();

  const updated = await prisma.driverProfile.update({
    where: { id: driver.id },
    data: {
      fullName: nextFullName.length ? nextFullName : driver.fullName,
      firstName: params.input.firstName ?? undefined,
      lastName: params.input.lastName ?? undefined,
      phone: params.input.phone ?? undefined,
      ...(params.input.mobilePayBank !== undefined ? { mobilePayBank: params.input.mobilePayBank } : null),
      ...(params.input.mobilePayDocument !== undefined ? { mobilePayDocument: params.input.mobilePayDocument } : null),
      ...(params.input.mobilePayPhone !== undefined ? { mobilePayPhone: params.input.mobilePayPhone } : null),
    },
  });

  return { ok: true as const, driver: updated };
}

export async function deleteMyAccount(params: { userId: string }) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) return { ok: false as const, status: 404 as const, error: "User not found" };
  if (user.role === UserRole.ADMIN) {
    return { ok: false as const, status: 403 as const, error: "Admin account deletion is not supported" };
  }

  if (user.role === UserRole.USER) {
    await prisma.user.delete({ where: { id: user.id } });
    return { ok: true as const };
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, userId: true },
  });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver profile not found" };

  await prisma.$transaction(async (tx) => {
    await tx.rideRequest.updateMany({
      where: {
        matchedDriverId: driver.id,
        status: { in: ["OPEN", "ASSIGNED", "ACCEPTED", "MATCHED", "IN_PROGRESS"] },
      },
      data: {
        status: "CANCELLED",
        matchedDriverId: null,
        matchedAt: null,
        acceptedAt: null,
        startedAt: null,
      },
    });

    await tx.rideRequest.updateMany({
      where: {
        matchedDriverId: driver.id,
        status: { in: ["CANCELLED", "EXPIRED", "COMPLETED"] },
      },
      data: { matchedDriverId: null },
    });

    await tx.rideOffer.updateMany({
      where: { committedDriverId: driver.id, status: "COMMITTED" },
      data: { status: "OPEN", committedDriverId: null, committedAt: null },
    });

    await tx.rideOffer.updateMany({
      where: { committedDriverId: driver.id, status: { in: ["OPEN", "CANCELLED", "EXPIRED"] } },
      data: { committedDriverId: null, committedAt: null },
    });

    await tx.user.delete({ where: { id: driver.userId } });
  });

  return { ok: true as const };
}
