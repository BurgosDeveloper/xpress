import bcrypt from "bcryptjs";
import { DocumentType, DriverStatus, RideStatus, ServiceType, UserRole } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { sendPushToAdmins, sendPushToUser, sendPushToUserBurst } from "../notifications/notifications.service";
import { APP_CONFIG_ID, DEFAULT_APP_CONFIG, getAppConfig, normalizeMatchingRadiusM } from "../config/appConfig.service";
import { ensureDriverHasMinCredits } from "../credits/credits.service";
import { emitToUser } from "../../realtime/realtime";

function generatePassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createDriverByAdmin(input: {
  email: string;
  password?: string;
  fullName: string;
  phone: string;
  mobilePayBank: string;
  mobilePayDocument: string;
  mobilePayPhone: string;
  photoUrl: string;
  serviceType: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  vehicle: {
    brand: string;
    model: string;
    year: number;
    color: string;
    doors?: number;
    hasAC: boolean;
    hasTrunk: boolean;
    allowsPets: boolean;
  };
  documents: {
    vehiclePhotoUrls: string[];
  };
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return { ok: false as const, error: "Email already in use" };

  const plainPassword = input.password ?? generatePassword(12);
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: UserRole.DRIVER,
      driver: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
          mobilePayBank: input.mobilePayBank,
          mobilePayDocument: input.mobilePayDocument,
          mobilePayPhone: input.mobilePayPhone,
          photoUrl: input.photoUrl,
          serviceType:
            input.serviceType === "CARRO"
              ? ServiceType.CARRO
              : input.serviceType === "MOTO"
                ? ServiceType.MOTO
                : input.serviceType === "MOTO_CARGA"
                  ? ServiceType.MOTO_CARGA
                  : ServiceType.CARRO_CARGA,
          status: DriverStatus.APPROVED,
          isAvailable: true,
          vehicle: {
            create: {
              brand: input.vehicle.brand,
              model: input.vehicle.model,
              year: input.vehicle.year,
              color: input.vehicle.color,
              doors: input.vehicle.doors,
              hasAC: input.vehicle.hasAC,
              hasTrunk: input.vehicle.hasTrunk,
              allowsPets: input.vehicle.allowsPets,
            },
          },
          documents: {
            create: [
              ...input.documents.vehiclePhotoUrls.map((url) => ({
                type: DocumentType.VEHICLE_PHOTO,
                url,
              })),
            ],
          },
        },
      },
    },
    include: { driver: { include: { vehicle: true, documents: true } } },
  });

  return {
    ok: true as const,
    driverUser: {
      id: user.id,
      email: user.email,
      role: user.role,
      driver: user.driver,
    },
    credentials: {
      user: user.email,
      password: plainPassword,
    },
  };
}

export async function listDrivers() {
  return prisma.driverProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      fullName: true,
      firstName: true,
      lastName: true,
      phone: true,
      mobilePayBank: true,
      mobilePayDocument: true,
      mobilePayPhone: true,
      photoUrl: true,
      serviceType: true,
      creditChargeFixedCop: true,
      status: true,
      isAvailable: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, email: true, isActive: true, creditAccount: { select: { balanceCop: true } } } },
      vehicle: true,
      documents: true,
      location: true,
    },
  });
}

export async function adminHardDeleteDriver(params: { driverId: string }) {
  const driver = await prisma.driverProfile.findUnique({
    where: { id: params.driverId },
    select: { id: true, userId: true },
  });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  await prisma.$transaction(async (tx) => {
    // Liberar FKs opcionales antes de borrar el driver.
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

    // Borrar el user elimina cascada: driverProfile, location, vehicle, docs, creditAccount, pushTokens, etc.
    await tx.user.delete({ where: { id: driver.userId } });
  });

  return { ok: true as const };
}

export async function listPassengers(params: { skip: number; take: number }) {
  return prisma.passengerProfile.findMany({
    skip: params.skip,
    take: params.take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      fullName: true,
      firstName: true,
      lastName: true,
      phone: true,
      photoUrl: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });
}

export async function adminSetPassengerActive(params: { passengerId: string; isActive: boolean }) {
  const passenger = await prisma.passengerProfile.findUnique({
    where: { id: params.passengerId },
    select: { id: true, userId: true },
  });
  if (!passenger) return { ok: false as const, status: 404 as const, error: "Passenger not found" };

  const user = await prisma.user.update({
    where: { id: passenger.userId },
    data: { isActive: params.isActive },
    select: { id: true, email: true, isActive: true },
  });

  return { ok: true as const, user };
}

export async function adminUpdatePassenger(params: {
  passengerId: string;
  email?: string;
  fullName?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string;
  photoUrl?: string | null;
}) {
  const existing = await prisma.passengerProfile.findUnique({
    where: { id: params.passengerId },
    select: { id: true, userId: true },
  });
  if (!existing) return { ok: false as const, status: 404 as const, error: "Passenger not found" };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (params.email) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { email: params.email },
        });
      }

      await tx.passengerProfile.update({
        where: { id: existing.id },
        data: {
          ...(params.fullName ? { fullName: params.fullName } : null),
          ...(params.firstName !== undefined ? { firstName: params.firstName } : null),
          ...(params.lastName !== undefined ? { lastName: params.lastName } : null),
          ...(params.phone ? { phone: params.phone } : null),
          ...(params.photoUrl !== undefined ? { photoUrl: params.photoUrl } : null),
        },
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, isActive: true } },
        },
      });

      return tx.passengerProfile.findUnique({
        where: { id: existing.id },
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, isActive: true } },
        },
      });
    });

    return { ok: true as const, passenger: updated };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo actualizar el pasajero";
    return { ok: false as const, status: 400 as const, error: message };
  }
}

export async function adminDeletePassenger(params: { passengerId: string }) {
  const passenger = await prisma.passengerProfile.findUnique({
    where: { id: params.passengerId },
    select: { id: true, userId: true },
  });
  if (!passenger) return { ok: false as const, status: 404 as const, error: "Passenger not found" };

  // Cascadas:
  // - User -> PassengerProfile (Cascade)
  // - PassengerProfile -> RideRequest/RideOffer (Cascade)
  await prisma.user.delete({ where: { id: passenger.userId } });

  return { ok: true as const };
}

export async function listRides(params: {
  skip: number;
  take: number;
  status?: string;
  serviceType?: string;
  driverId?: string;
  passengerUserId?: string;
  assignedByAdmin?: boolean;
  dateField?: string;
  from?: Date;
  to?: Date;
}) {
  const where: any = {};
  if (params.status) where.status = params.status;
  if (params.serviceType) where.serviceTypeWanted = params.serviceType;
  if (params.driverId) where.matchedDriverId = params.driverId;
  if (typeof params.assignedByAdmin === "boolean") where.assignedByAdmin = params.assignedByAdmin;
  if (params.passengerUserId) where.passenger = { is: { userId: params.passengerUserId } };

  const allowedDateFields = new Set(["createdAt", "matchedAt", "acceptedAt", "startedAt", "completedAt"]);
  const dateField = allowedDateFields.has(params.dateField ?? "") ? (params.dateField as string) : "createdAt";

  if (params.from || params.to) {
    where[dateField] = {};
    if (params.from) where[dateField].gte = params.from;
    if (params.to) where[dateField].lte = params.to;
  }

  return prisma.rideRequest.findMany({
    skip: params.skip,
    take: params.take,
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      serviceTypeWanted: true,
      wantsAC: true,
      wantsTrunk: true,
      wantsPets: true,
      passengerId: true,
      matchedDriverId: true,
      assignedByAdmin: true,
      pickupLat: true,
      pickupLng: true,
      pickupAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      dropoffAddress: true,
      searchRadiusM: true,
      distanceMeters: true,
      durationSeconds: true,
      estimatedPrice: true,
      agreedPrice: true,
      createdAt: true,
      updatedAt: true,
      matchedAt: true,
      acceptedAt: true,
      startedAt: true,
      completedAt: true,
      passenger: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          user: { select: { id: true, email: true } },
        },
      },
      matchedDriver: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          serviceType: true,
          status: true,
          isAvailable: true,
          location: true,
          vehicle: true,
          user: { select: { id: true, email: true } },
        },
      },
      addons: { include: { addon: true } },
      ratings: true,
    },
  });
}

export async function adminGetRidesStats() {
  const allStatuses: RideStatus[] = [
    "OPEN",
    "ASSIGNED",
    "ACCEPTED",
    "MATCHED",
    "IN_PROGRESS",
    "CANCELLED",
    "EXPIRED",
    "COMPLETED",
  ];

  const grouped = await prisma.rideRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const byStatus: Record<RideStatus, number> = Object.fromEntries(allStatuses.map((s) => [s, 0])) as any;
  for (const row of grouped) {
    byStatus[row.status] = row._count._all;
  }

  const total = allStatuses.reduce((acc, s) => acc + (byStatus[s] ?? 0), 0);

  return {
    total,
    byStatus,
  };
}

export async function adminDeleteAllRides() {
  const deletedCount = await prisma.$transaction(async (tx) => {
    // Evita conflictos por FK opcional RideOffer -> RideRequest.
    await tx.rideOffer.updateMany({
      where: { rideId: { not: null } },
      data: { rideId: null },
    });

    const deleted = await tx.rideRequest.deleteMany({});
    return deleted.count;
  });

  return { ok: true as const, deletedCount };
}

export async function assignRideDriverByAdmin(params: { rideId: string; driverId: string }) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return { ok: false as const, error: "Ride not found" };

  if (["IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"].includes(ride.status)) {
    return { ok: false as const, error: "Ride cannot be assigned" };
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { id: params.driverId },
    select: { id: true, serviceType: true, userId: true, fullName: true, user: { select: { isActive: true } } },
  });
  if (!driver) return { ok: false as const, error: "Driver not found" };
  if (!driver.user?.isActive) return { ok: false as const, error: "Driver disabled" };
  if (driver.serviceType !== ride.serviceTypeWanted)
    return { ok: false as const, error: "Driver serviceType mismatch" };

  const credits = await ensureDriverHasMinCredits({ userId: driver.userId, audience: "ADMIN" });
  if (!credits.ok) return { ok: false as const, status: credits.status, error: credits.error };

  const updated = await prisma.rideRequest.update({
    where: { id: ride.id },
    data: {
      matchedDriverId: driver.id,
      matchedAt: new Date(),
      status: "ASSIGNED",
      assignedByAdmin: true,
      acceptedAt: null,
    },
    select: {
      id: true,
      status: true,
      serviceTypeWanted: true,
      wantsAC: true,
      wantsTrunk: true,
      wantsPets: true,
      passengerId: true,
      matchedDriverId: true,
      assignedByAdmin: true,
      pickupLat: true,
      pickupLng: true,
      pickupAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      dropoffAddress: true,
      searchRadiusM: true,
      distanceMeters: true,
      durationSeconds: true,
      estimatedPrice: true,
      agreedPrice: true,
      createdAt: true,
      updatedAt: true,
      matchedAt: true,
      acceptedAt: true,
      startedAt: true,
      completedAt: true,
      passenger: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          user: { select: { id: true, email: true } },
        },
      },
      matchedDriver: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          serviceType: true,
          status: true,
          isAvailable: true,
          location: true,
          vehicle: true,
          user: { select: { id: true, email: true } },
        },
      },
      addons: { include: { addon: true } },
      ratings: true,
    },
  });

  emitToUser(ride.passenger.userId, "ride:changed", { rideId: updated.id, type: "RIDE_ASSIGNED" });
  emitToUser(driver.userId, "ride:changed", { rideId: updated.id, type: "RIDE_ASSIGNED" });

  void sendPushToUser({
    userId: ride.passenger.userId,
    title: "Chofer asignado",
    body: "El admin asignó un chofer a tu servicio",
    soundName: "aceptar_servicio",
    data: { rideId: updated.id, type: "RIDE_ASSIGNED" },
  });

  sendPushToUserBurst({
    userId: driver.userId,
    title: "Nuevo servicio",
    body: "Tienes un servicio para aceptar",
    soundName: "tienes_servicio",
    times: 2,
    intervalMs: 1200,
    data: { rideId: updated.id, type: "RIDE_ASSIGNED" },
  });

  void sendPushToAdmins({
    title: "Servicio asignado (admin)",
    body: `Ride ${updated.id} -> Driver ${driver.id}`,
    data: { rideId: updated.id, driverId: driver.id, type: "RIDE_ASSIGNED" },
  });

  return { ok: true as const, ride: updated };
}

export async function adminGetDriverCredits(params: { driverId: string }) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: params.driverId }, select: { userId: true } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  const account = await prisma.creditAccount.findUnique({ where: { userId: driver.userId } });
  return { ok: true as const, balanceCop: account?.balanceCop ?? 0 };
}

export async function adminAdjustDriverCredits(params: { driverId: string; deltaCop: number }) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: params.driverId }, select: { userId: true } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  const account = await prisma.creditAccount.upsert({
    where: { userId: driver.userId },
    create: { userId: driver.userId, balanceCop: params.deltaCop },
    update: { balanceCop: { increment: params.deltaCop } },
  });

  return { ok: true as const, balanceCop: account.balanceCop };
}

export async function adminSetDriverActive(params: { driverId: string; isActive: boolean }) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: params.driverId }, select: { userId: true } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  const user = await prisma.user.update({
    where: { id: driver.userId },
    data: { isActive: params.isActive },
    select: { id: true, email: true, role: true, isActive: true },
  });

  return { ok: true as const, user };
}

export async function adminUpdateDriver(params: {
  driverId: string;
  email?: string;
  fullName?: string;
  phone?: string;
  mobilePayBank?: string | null;
  mobilePayDocument?: string | null;
  mobilePayPhone?: string | null;
  photoUrl?: string;
  serviceType?: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  creditChargeFixedCop?: number | null;
  vehicle?: {
    brand?: string;
    model?: string;
    plate?: string | null;
    year?: number;
    color?: string;
    doors?: number | null;
    hasAC?: boolean;
    hasTrunk?: boolean;
    allowsPets?: boolean;
  };
  documents?: {
    vehiclePhotoUrls?: string[];
  };
}) {
  const existingDriver = await prisma.driverProfile.findUnique({
    where: { id: params.driverId },
    include: { user: { select: { id: true, email: true } }, vehicle: true, documents: true },
  });
  if (!existingDriver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  // Email (User)
  if (params.email && params.email !== existingDriver.user.email) {
    const already = await prisma.user.findUnique({ where: { email: params.email } });
    if (already) return { ok: false as const, status: 409 as const, error: "Email already in use" };
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (params.email) {
      await tx.user.update({ where: { id: existingDriver.userId }, data: { email: params.email } });
    }

    const driverRow = await tx.driverProfile.update({
      where: { id: existingDriver.id },
      data: {
        ...(params.fullName ? { fullName: params.fullName } : null),
        ...(params.phone ? { phone: params.phone } : null),
        ...(params.mobilePayBank !== undefined ? { mobilePayBank: params.mobilePayBank } : null),
        ...(params.mobilePayDocument !== undefined ? { mobilePayDocument: params.mobilePayDocument } : null),
        ...(params.mobilePayPhone !== undefined ? { mobilePayPhone: params.mobilePayPhone } : null),
        ...(params.photoUrl ? { photoUrl: params.photoUrl } : null),
        ...(params.serviceType ? { serviceType: params.serviceType as any } : null),
        ...(params.creditChargeFixedCop !== undefined ? { creditChargeFixedCop: params.creditChargeFixedCop } : null),
      },
      include: { user: { select: { id: true, email: true, isActive: true, creditAccount: { select: { balanceCop: true } } } }, vehicle: true, documents: true, location: true },
    });

    if (params.vehicle && driverRow.vehicle) {
      await tx.vehicle.update({
        where: { driverId: driverRow.id },
        data: {
          ...(params.vehicle.brand != null ? { brand: params.vehicle.brand } : null),
          ...(params.vehicle.model != null ? { model: params.vehicle.model } : null),
          ...(params.vehicle.plate !== undefined ? { plate: params.vehicle.plate } : null),
          ...(params.vehicle.year != null ? { year: params.vehicle.year } : null),
          ...(params.vehicle.color != null ? { color: params.vehicle.color } : null),
          ...(params.vehicle.doors !== undefined ? { doors: params.vehicle.doors } : null),
          ...(params.vehicle.hasAC != null ? { hasAC: params.vehicle.hasAC } : null),
          ...(params.vehicle.hasTrunk != null ? { hasTrunk: params.vehicle.hasTrunk } : null),
          ...(params.vehicle.allowsPets != null ? { allowsPets: params.vehicle.allowsPets } : null),
        },
      });
    }

    if (params.documents?.vehiclePhotoUrls) {
      const urls = params.documents.vehiclePhotoUrls;

      await tx.driverDocument.deleteMany({ where: { driverId: driverRow.id, type: DocumentType.VEHICLE_PHOTO } });
      if (urls.length) {
        await tx.driverDocument.createMany({
          data: urls.map((url) => ({ driverId: driverRow.id, type: DocumentType.VEHICLE_PHOTO, url })),
        });
      }
    }

    return tx.driverProfile.findUnique({
      where: { id: driverRow.id },
      include: { user: { select: { id: true, email: true, isActive: true, creditAccount: { select: { balanceCop: true } } } }, vehicle: true, documents: true, location: true },
    });
  });

  return { ok: true as const, driver: updated };
}

export async function adminGetAppConfig() {
  const [appConfig, pricingCarro, anyPricing] = await Promise.all([
    getAppConfig(),
    prisma.pricingConfig.findUnique({ where: { serviceType: ServiceType.CARRO } }),
    prisma.pricingConfig.findFirst({ orderBy: { serviceType: "asc" } }),
  ]);

  const pricing = pricingCarro ?? anyPricing;

  const text = (v: any) => {
    const s = typeof v === "string" ? v : v == null ? "" : String(v);
    return s;
  };

  return {
    ok: true as const,
    appConfig: {
      id: appConfig.id,
      driverCreditChargeMode: appConfig.driverCreditChargeMode,
      driverCreditChargePercent: Number((appConfig as any).driverCreditChargePercent ?? 0),
      fxCopPerUsd: Number((appConfig as any).fxCopPerUsd ?? 0),
      fxCopPerVes: Number((appConfig as any).fxCopPerVes ?? 0),
      matchingRadiusM: normalizeMatchingRadiusM((appConfig as any).matchingRadiusM),

      zoeWhatsappPhone: text((appConfig as any).zoeWhatsappPhone),

      paymentBancolombiaHolder: text((appConfig as any).paymentBancolombiaHolder),
      paymentBancolombiaDocument: text((appConfig as any).paymentBancolombiaDocument),
      paymentBancolombiaAccountType: text((appConfig as any).paymentBancolombiaAccountType),
      paymentBancolombiaAccountNumber: text((appConfig as any).paymentBancolombiaAccountNumber),

      paymentZelleHolder: text((appConfig as any).paymentZelleHolder),
      paymentZelleEmail: text((appConfig as any).paymentZelleEmail),
      paymentZellePhone: text((appConfig as any).paymentZellePhone),
    },
    pricing: {
      baseFare: Number(pricing?.baseFare ?? 0),
      perKm: Number(pricing?.perKm ?? 0),
      includedMeters: Number((pricing as any)?.includedMeters ?? 0),
      stepMeters: Number((pricing as any)?.stepMeters ?? 0),
      stepPrice: Number((pricing as any)?.stepPrice ?? 0),
    },
  };
}

export async function adminUpdateAppConfig(input: {
  pricingBaseFare?: number;
  pricingPerKm?: number;
  pricingIncludedMeters?: number;
  pricingStepMeters?: number;
  pricingStepPrice?: number;
  driverCreditChargePercent?: number;
  driverCreditChargeMode: "SERVICE_VALUE" | "FIXED_AMOUNT";
  fxCopPerUsd?: number;
  fxCopPerVes?: number;
  matchingRadiusM?: number;

  zoeWhatsappPhone?: string | null;

  paymentBancolombiaHolder?: string | null;
  paymentBancolombiaDocument?: string | null;
  paymentBancolombiaAccountType?: string | null;
  paymentBancolombiaAccountNumber?: string | null;

  paymentZelleHolder?: string | null;
  paymentZelleEmail?: string | null;
  paymentZellePhone?: string | null;
}) {
  const serviceTypes: ServiceType[] = [
    ServiceType.CARRO,
    ServiceType.MOTO,
    ServiceType.MOTO_CARGA,
    ServiceType.CARRO_CARGA,
  ];

  const shouldUpdatePricing =
    input.pricingBaseFare !== undefined ||
    input.pricingPerKm !== undefined ||
    input.pricingIncludedMeters !== undefined ||
    input.pricingStepMeters !== undefined ||
    input.pricingStepPrice !== undefined;

  const includedMeters = Math.max(0, Math.floor(Number(input.pricingIncludedMeters ?? 0)));
  const stepMeters = Math.max(0, Math.floor(Number(input.pricingStepMeters ?? 0)));
  const stepPrice = Math.max(0, Number(input.pricingStepPrice ?? 0));
  const driverCreditChargePercent = Math.max(0, Math.min(100, Number(input.driverCreditChargePercent ?? 0)));
  const fxCopPerUsd = input.fxCopPerUsd !== undefined ? Math.max(0, Number(input.fxCopPerUsd)) : undefined;
  const fxCopPerVes = input.fxCopPerVes !== undefined ? Math.max(0, Number(input.fxCopPerVes)) : undefined;
  const matchingRadiusM = input.matchingRadiusM !== undefined ? normalizeMatchingRadiusM(input.matchingRadiusM) : undefined;

  const sanitizeText = (v: any) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  };

  const zoeWhatsappPhone = sanitizeText(input.zoeWhatsappPhone);

  const paymentBancolombiaHolder = sanitizeText(input.paymentBancolombiaHolder);
  const paymentBancolombiaDocument = sanitizeText(input.paymentBancolombiaDocument);
  const paymentBancolombiaAccountType = sanitizeText(input.paymentBancolombiaAccountType);
  const paymentBancolombiaAccountNumber = sanitizeText(input.paymentBancolombiaAccountNumber);

  const paymentZelleHolder = sanitizeText(input.paymentZelleHolder);
  const paymentZelleEmail = sanitizeText(input.paymentZelleEmail);
  const paymentZellePhone = sanitizeText(input.paymentZellePhone);

  const extraCreate: any = {
    ...(zoeWhatsappPhone !== undefined ? { zoeWhatsappPhone } : null),

    ...(paymentBancolombiaHolder !== undefined ? { paymentBancolombiaHolder } : null),
    ...(paymentBancolombiaDocument !== undefined ? { paymentBancolombiaDocument } : null),
    ...(paymentBancolombiaAccountType !== undefined ? { paymentBancolombiaAccountType } : null),
    ...(paymentBancolombiaAccountNumber !== undefined ? { paymentBancolombiaAccountNumber } : null),

    ...(paymentZelleHolder !== undefined ? { paymentZelleHolder } : null),
    ...(paymentZelleEmail !== undefined ? { paymentZelleEmail } : null),
    ...(paymentZellePhone !== undefined ? { paymentZellePhone } : null),
  };

  const extraUpdate: any = extraCreate;

  const updated = await prisma.$transaction(async (tx) => {
    const cfg = await tx.appConfig.upsert({
      where: { id: APP_CONFIG_ID },
      create: {
        ...DEFAULT_APP_CONFIG,
        id: APP_CONFIG_ID,
        driverCreditChargeMode: input.driverCreditChargeMode as any,
        driverCreditChargePercent,
        ...(fxCopPerUsd !== undefined ? { fxCopPerUsd } : null),
        ...(fxCopPerVes !== undefined ? { fxCopPerVes } : null),
        ...(matchingRadiusM !== undefined ? { matchingRadiusM } : null),
        ...extraCreate,
      },
      update: {
        driverCreditChargeMode: input.driverCreditChargeMode as any,
        driverCreditChargePercent,
        ...(fxCopPerUsd !== undefined ? { fxCopPerUsd } : null),
        ...(fxCopPerVes !== undefined ? { fxCopPerVes } : null),
        ...(matchingRadiusM !== undefined ? { matchingRadiusM } : null),
        ...extraUpdate,
      },
    });

    if (shouldUpdatePricing) {
      const baseFare = Math.max(0, Number(input.pricingBaseFare ?? 0));
      const perKm = Math.max(0, Number(input.pricingPerKm ?? 0));

      for (const st of serviceTypes) {
        await tx.pricingConfig.upsert({
          where: { serviceType: st },
          update: {
            baseFare,
            perKm,
            includedMeters,
            stepMeters,
            stepPrice,
          },
          create: {
            serviceType: st,
            baseFare,
            perKm,
            includedMeters,
            stepMeters,
            stepPrice,
            acSurcharge: 0,
            trunkSurcharge: 0,
            petsSurcharge: 0,
          },
        });
      }
    }

    return cfg;
  });

  const text = (v: any) => {
    const s = typeof v === "string" ? v : v == null ? "" : String(v);
    return s;
  };

  return {
    ok: true as const,
    appConfig: {
      id: updated.id,
      driverCreditChargeMode: updated.driverCreditChargeMode,
      driverCreditChargePercent: Number((updated as any).driverCreditChargePercent ?? 0),
      fxCopPerUsd: Number((updated as any).fxCopPerUsd ?? 0),
      fxCopPerVes: Number((updated as any).fxCopPerVes ?? 0),
      matchingRadiusM: normalizeMatchingRadiusM((updated as any).matchingRadiusM),

      zoeWhatsappPhone: text((updated as any).zoeWhatsappPhone),

      paymentBancolombiaHolder: text((updated as any).paymentBancolombiaHolder),
      paymentBancolombiaDocument: text((updated as any).paymentBancolombiaDocument),
      paymentBancolombiaAccountType: text((updated as any).paymentBancolombiaAccountType),
      paymentBancolombiaAccountNumber: text((updated as any).paymentBancolombiaAccountNumber),

      paymentZelleHolder: text((updated as any).paymentZelleHolder),
      paymentZelleEmail: text((updated as any).paymentZelleEmail),
      paymentZellePhone: text((updated as any).paymentZellePhone),
    },
    pricing: {
      baseFare: Number(input.pricingBaseFare ?? 0),
      perKm: Number(input.pricingPerKm ?? 0),
      includedMeters,
      stepMeters,
      stepPrice,
    },
  };
}

export async function listPricingAddons(params: { serviceType?: string; isActive?: boolean }) {
  const where: any = {};
  if (params.serviceType) where.serviceType = params.serviceType;
  if (typeof params.isActive === "boolean") where.isActive = params.isActive;

  return prisma.pricingAddon.findMany({
    where,
    orderBy: [{ serviceType: "asc" }, { name: "asc" }],
  });
}

export async function createPricingAddon(input: {
  serviceType: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  name: string;
  amount: number;
  isActive: boolean;
}) {
  const pricing = await prisma.pricingConfig.findUnique({
    where: { serviceType: input.serviceType as ServiceType },
    select: { serviceType: true },
  });
  if (!pricing) return { ok: false as const, error: "Pricing not configured for this service type" };

  const existing = await prisma.pricingAddon.findFirst({
    where: { serviceType: input.serviceType as ServiceType, name: input.name },
    select: { id: true },
  });
  if (existing) return { ok: false as const, error: "Addon name already exists for this service type" };

  const addon = await prisma.pricingAddon.create({
    data: {
      serviceType: input.serviceType as ServiceType,
      name: input.name,
      amount: input.amount,
      isActive: input.isActive,
    },
  });

  return { ok: true as const, addon };
}

export async function updatePricingAddon(params: {
  addonId: string;
  name?: string;
  amount?: number;
  isActive?: boolean;
}) {
  if (params.name) {
    const current = await prisma.pricingAddon.findUnique({
      where: { id: params.addonId },
      select: { id: true, serviceType: true },
    });

    if (current) {
      const existing = await prisma.pricingAddon.findFirst({
        where: {
          serviceType: current.serviceType,
          name: params.name,
          id: { not: current.id },
        },
        select: { id: true },
      });

      if (existing) {
        return { ok: false as const, error: "Addon name already exists for this service type" };
      }
    }
  }

  const addon = await prisma.pricingAddon.update({
    where: { id: params.addonId },
    data: {
      name: params.name,
      amount: params.amount,
      isActive: params.isActive,
    },
  });

  return { ok: true as const, addon };
}

export async function deactivatePricingAddon(params: { addonId: string }) {
  return prisma.pricingAddon.update({
    where: { id: params.addonId },
    data: { isActive: false },
  });
}

export async function listRatings(params: { skip: number; take: number }) {
  return prisma.rating.findMany({
    skip: params.skip,
    take: params.take,
    orderBy: { createdAt: "desc" },
  });
}

export async function approveDriver(params: { driverId: string; status: "OBSERVATION" | "APPROVED" | "REJECTED" }) {
  return prisma.driverProfile.update({
    where: { id: params.driverId },
    data: { status: params.status as DriverStatus },
    include: { user: { select: { id: true, email: true } }, vehicle: true, documents: true },
  });
}

export async function upsertPricing(params: {
  serviceType: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  baseFare: number;
  nightBaseFare?: number;
  nightStartHour?: number;
  nightEndHour?: number;
  perKm: number;
  includedMeters?: number;
  stepMeters?: number;
  stepPrice?: number;
  acSurcharge: number;
  trunkSurcharge: number;
  petsSurcharge: number;
}) {
  const includedMeters = Math.max(0, Math.floor(Number(params.includedMeters ?? 0)));
  const stepMeters = Math.max(0, Math.floor(Number(params.stepMeters ?? 0)));
  const stepPrice = Math.max(0, Number(params.stepPrice ?? 0));
  const nightBaseFare = Math.max(0, Number(params.nightBaseFare ?? 0));
  const nightStartHour = Math.max(0, Math.min(23, Math.floor(Number(params.nightStartHour ?? 20))));
  const nightEndHour = Math.max(0, Math.min(23, Math.floor(Number(params.nightEndHour ?? 23))));

  return prisma.pricingConfig.upsert({
    where: { serviceType: params.serviceType as ServiceType },
    update: {
      baseFare: params.baseFare,
      nightBaseFare,
      nightStartHour,
      nightEndHour,
      perKm: params.perKm,
      includedMeters,
      stepMeters,
      stepPrice,
      acSurcharge: params.acSurcharge,
      trunkSurcharge: params.trunkSurcharge,
      petsSurcharge: params.petsSurcharge,
    },
    create: {
      serviceType: params.serviceType as ServiceType,
      baseFare: params.baseFare,
      nightBaseFare,
      nightStartHour,
      nightEndHour,
      perKm: params.perKm,
      includedMeters,
      stepMeters,
      stepPrice,
      acSurcharge: params.acSurcharge,
      trunkSurcharge: params.trunkSurcharge,
      petsSurcharge: params.petsSurcharge,
    },
  });
}

export async function getPricing() {
  return prisma.pricingConfig.findMany({ orderBy: { serviceType: "asc" } });
}

export async function getMetrics(params: { from?: Date; to?: Date }) {
  const where: any = {};
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = params.from;
    if (params.to) where.createdAt.lte = params.to;
  }

  const [total, completed, cancelled, inProgress, open, assigned, accepted] = await Promise.all([
    prisma.rideRequest.count({ where }),
    prisma.rideRequest.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.rideRequest.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.rideRequest.count({ where: { ...where, status: "IN_PROGRESS" } }),
    prisma.rideRequest.count({ where: { ...where, status: "OPEN" } }),
    prisma.rideRequest.count({ where: { ...where, status: "ASSIGNED" } }),
    prisma.rideRequest.count({ where: { ...where, status: "ACCEPTED" } }),
  ]);

  const revenueAgg = await prisma.rideRequest.aggregate({
    where: { ...where, status: "COMPLETED" },
    _sum: { meterPrice: true },
  });

  const topDrivers = await prisma.rideRequest.groupBy({
    by: ["matchedDriverId"],
    where: { ...where, status: "COMPLETED", matchedDriverId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  return {
    totalRides: total,
    openRides: open,
    assignedRides: assigned,
    acceptedRides: accepted,
    completedRides: completed,
    cancelledRides: cancelled,
    inProgressRides: inProgress,
    revenueCompleted: revenueAgg._sum.meterPrice ?? 0,
    topDrivers,
  };
}
