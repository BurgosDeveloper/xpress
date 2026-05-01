import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import { ServiceType } from "@prisma/client";
import { getAppConfig } from "../modules/config/appConfig.service";

async function ensurePricing() {
  const rows: Array<{
    serviceType: ServiceType;
    baseFare: number;
    perKm: number;
    acSurcharge: number;
    trunkSurcharge: number;
    petsSurcharge: number;
  }> = [
    // "CARRO" equivale al servicio base (tipo taxi/carro)
    { serviceType: ServiceType.CARRO, baseFare: 1200, perKm: 450, acSurcharge: 250, trunkSurcharge: 200, petsSurcharge: 200 },
    // Moto
    { serviceType: ServiceType.MOTO, baseFare: 800, perKm: 300, acSurcharge: 0, trunkSurcharge: 0, petsSurcharge: 0 },
    // Carga (defaults razonables para no bloquear el flujo)
    { serviceType: ServiceType.MOTO_CARGA, baseFare: 900, perKm: 320, acSurcharge: 0, trunkSurcharge: 150, petsSurcharge: 0 },
    { serviceType: ServiceType.CARRO_CARGA, baseFare: 1400, perKm: 480, acSurcharge: 250, trunkSurcharge: 250, petsSurcharge: 200 },
  ];

  for (const row of rows) {
    await prisma.pricingConfig.upsert({
      where: { serviceType: row.serviceType },
      create: {
        serviceType: row.serviceType,
        baseFare: row.baseFare,
        perKm: row.perKm,
        acSurcharge: row.acSurcharge,
        trunkSurcharge: row.trunkSurcharge,
        petsSurcharge: row.petsSurcharge,
      },
      update: {
        baseFare: row.baseFare,
        perKm: row.perKm,
        acSurcharge: row.acSurcharge,
        trunkSurcharge: row.trunkSurcharge,
        petsSurcharge: row.petsSurcharge,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("[seed] ensured PricingConfig", { count: rows.length });
}

async function main() {
  // Asegura que exista AppConfig global (se usa para tarifa nocturna, etc.)
  await getAppConfig();
  await ensurePricing();

  const username = "admin";
  const email = "admin@xpress.local";
  const password = "xpress_admin";

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true, username: true, email: true, role: true },
  });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log("[seed] admin already exists", existing);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: "ADMIN",
      },
      select: { id: true, username: true, email: true, role: true },
    });

    // eslint-disable-next-line no-console
    console.log("[seed] created admin", created);
  }

  // Usuario de prueba (cliente)
  const passengerEmail = "cliente@xpress.local";
  const passengerPassword = "xpress_test";
  const passengerHash = await bcrypt.hash(passengerPassword, 10);
  const passengerExisting = await prisma.user.findUnique({ where: { email: passengerEmail }, select: { id: true } });
  if (!passengerExisting) {
    const u = await prisma.user.create({
      data: {
        email: passengerEmail,
        passwordHash: passengerHash,
        role: "USER",
        passenger: {
          create: {
            fullName: "daniel burgos",
            firstName: "daniel",
            lastName: "burgos",
            phone: "04245600261",
            photoUrl: null,
          },
        },
      },
      select: { id: true, email: true, role: true },
    });
    // eslint-disable-next-line no-console
    console.log("[seed] created passenger test", { ...u, password: passengerPassword });
  } else {
    await prisma.user.update({ where: { email: passengerEmail }, data: { passwordHash: passengerHash } });
    await prisma.passengerProfile.update({
      where: { userId: passengerExisting.id },
      data: {
        fullName: "daniel burgos",
        firstName: "daniel",
        lastName: "burgos",
        phone: "04245600261",
      },
    });
    // eslint-disable-next-line no-console
    console.log("[seed] updated passenger test", { email: passengerEmail });
  }

  // Usuario de prueba (chofer)
  const driverEmail = "chofer@xpress.local";
  const driverUsername = "chofer";
  const driverPassword = "xpress_test";
  const driverExisting = await prisma.user.findFirst({ where: { OR: [{ email: driverEmail }, { username: driverUsername }] }, select: { id: true } });
  const driverHash = await bcrypt.hash(driverPassword, 10);
  if (!driverExisting) {
    const u = await prisma.user.create({
      data: {
        email: driverEmail,
        username: driverUsername,
        passwordHash: driverHash,
        role: "DRIVER",
        driver: {
          create: {
            fullName: "yojhan villamizar",
            firstName: "yojhan",
            lastName: "villamizar",
            phone: "04247405708",
            photoUrl: "",
            serviceType: "MOTO",
            status: "APPROVED",
            isAvailable: true,
            location: {
              create: {
                // San Fernando (aprox)
                lat: -34.4477,
                lng: -58.5584,
              },
            },
            vehicle: {
              create: {
                brand: "empire",
                model: "tx keeway",
                plate: "aae182",
                year: 2021,
                color: "morado con negro",
                hasAC: false,
              },
            },
          },
        },
      },
      select: { id: true, email: true, username: true, role: true },
    });
    // eslint-disable-next-line no-console
    console.log("[seed] created driver test", { ...u, password: driverPassword });
  } else {
    await prisma.user.update({ where: { id: driverExisting.id }, data: { passwordHash: driverHash } });
    await prisma.driverProfile.update({
      where: { userId: driverExisting.id },
      data: {
        fullName: "yojhan villamizar",
        firstName: "yojhan",
        lastName: "villamizar",
        phone: "04247405708",
        serviceType: "MOTO",
        status: "APPROVED",
        isAvailable: true,
      },
    });

    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: driverExisting.id }, select: { id: true } });
    if (driverProfile) {
      await prisma.driverLocation.upsert({
        where: { driverId: driverProfile.id },
        create: { driverId: driverProfile.id, lat: -34.4477, lng: -58.5584 },
        update: { lat: -34.4477, lng: -58.5584 },
      });

      await prisma.vehicle.upsert({
        where: { driverId: driverProfile.id },
        create: {
          driverId: driverProfile.id,
          brand: "empire",
          model: "tx keeway",
          plate: "aae182",
          year: 2021,
          color: "morado con negro",
          hasAC: false,
        },
        update: {
          brand: "empire",
          model: "tx keeway",
          plate: "aae182",
          year: 2021,
          color: "morado con negro",
          hasAC: false,
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log("[seed] updated driver test", { email: driverEmail });
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
