import { prisma } from "../db/prisma";
import { getAppConfig } from "../modules/config/appConfig.service";

async function main() {
  const appConfig = await getAppConfig();

  const [pricingCount, users, drivers, pushTokens] = await Promise.all([
    prisma.pricingConfig.count(),
    prisma.user.count(),
    prisma.driverProfile.count(),
    prisma.pushToken.count(),
  ]);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        appConfig: {
          id: appConfig.id,
          driverCreditChargeMode: appConfig.driverCreditChargeMode,
        },
        counts: { pricingCount, users, drivers, pushTokens },
      },
      null,
      2
    )
  );
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
