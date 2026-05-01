import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_CLEAR_DATA !== "YES") {
    // Seguridad: evita borrados accidentales.
    // Ejecutar con: CONFIRM_CLEAR_DATA=YES
    // En PowerShell: $env:CONFIRM_CLEAR_DATA='YES'
    throw new Error("Set CONFIRM_CLEAR_DATA=YES to run this script");
  }

  // Orden pensado para evitar FK/restricciones.
  const rating = await prisma.rating.deleteMany({});
  const rideAddon = await prisma.rideAddon.deleteMany({});
  const rideCandidate = await prisma.rideCandidate.deleteMany({});
  const rideOffer = await prisma.rideOffer.deleteMany({});
  const rideRequest = await prisma.rideRequest.deleteMany({});

  // eslint-disable-next-line no-console
  console.log({
    ok: true,
    deleted: {
      rating: rating.count,
      rideAddon: rideAddon.count,
      rideCandidate: rideCandidate.count,
      rideOffer: rideOffer.count,
      rideRequest: rideRequest.count,
    },
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
