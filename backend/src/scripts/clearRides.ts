import { prisma } from "../db/prisma";

function hasYesFlag() {
  return process.argv.includes("--yes") || process.env.CONFIRM_CLEAR_RIDES === "yes";
}

async function main() {
  if (!hasYesFlag()) {
    console.log("Refusing to clear rides without confirmation.");
    console.log("Run: npm run db:clear-rides -- --yes");
    console.log('Or set env: CONFIRM_CLEAR_RIDES="yes"');
    process.exit(1);
  }

  const [offersBefore, ridesBefore] = await Promise.all([
    prisma.rideOffer.count(),
    prisma.rideRequest.count(),
  ]);

  const ridesByStatusBefore = await prisma.rideRequest.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  console.log("Before:");
  console.log({ offers: offersBefore, rides: ridesBefore, ridesByStatus: ridesByStatusBefore });

  // Nota:
  // - Borramos ofertas primero (no dependen de RideRequest, pero evita residuos y deja el sistema desde cero).
  // - Luego borramos rides. RideRequest tiene ON DELETE CASCADE a RideCandidate/RideAddon/Rating.
  const result = await prisma.$transaction(async (tx) => {
    const offersDeleted = await tx.rideOffer.deleteMany({});
    const ridesDeleted = await tx.rideRequest.deleteMany({});

    return { offersDeleted: offersDeleted.count, ridesDeleted: ridesDeleted.count };
  });

  const [offersAfter, ridesAfter] = await Promise.all([
    prisma.rideOffer.count(),
    prisma.rideRequest.count(),
  ]);

  console.log("Deleted:");
  console.log(result);

  console.log("After:");
  console.log({ offers: offersAfter, rides: ridesAfter });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
