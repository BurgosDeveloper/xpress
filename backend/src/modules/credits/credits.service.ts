import { prisma } from "../../db/prisma";
import { getAppConfig } from "../config/appConfig.service";
import { sendPushToUser } from "../notifications/notifications.service";

export const MIN_DRIVER_CREDITS_COP_TO_OPERATE = 15000;

const LOW_CREDITS_PUSH_COOLDOWN_MINUTES = 60;

type LowCreditsAudience = "DRIVER" | "ADMIN" | "USER";

function lowCreditsMessage(params: { audience: LowCreditsAudience; balanceCop: number; minCop: number }) {
  const base =
    "Tu saldo no cuenta con el mínimo para seguir prestando el servicio. Comunicate con la operadora o acercate a la oficina para recargar.";

  if (params.audience === "DRIVER") {
    return `Saldo insuficiente. ${base} (Saldo: ${params.balanceCop} COP, mínimo: ${params.minCop} COP).`;
  }

  // No filtrar balance del chofer a terceros.
  return "El chofer no cuenta con el saldo mínimo para seguir prestando el servicio. Seleccioná otro chofer o solicitá que recargue.";
}

export async function getOrCreateCreditAccount(params: { userId: string }) {
  return prisma.creditAccount.upsert({
    where: { userId: params.userId },
    update: {},
    create: { userId: params.userId, balanceCop: 0 },
  });
}

export async function getMyCredits(params: { userId: string }) {
  const account = await getOrCreateCreditAccount({ userId: params.userId });
  return { ok: true as const, balanceCop: account.balanceCop };
}

export async function ensureDriverHasMinCredits(params: {
  userId: string;
  minCop?: number;
  audience?: LowCreditsAudience;
  notify?: boolean;
  notifyCooldownMinutes?: number;
}) {
  const minCop = Math.max(0, Math.round(Number(params.minCop ?? MIN_DRIVER_CREDITS_COP_TO_OPERATE)));
  const audience: LowCreditsAudience = params.audience ?? "DRIVER";
  const notify = params.notify !== false;
  const notifyCooldownMinutes = Math.min(
    24 * 60,
    Math.max(1, Math.floor(params.notifyCooldownMinutes ?? LOW_CREDITS_PUSH_COOLDOWN_MINUTES))
  );
  const account = await getOrCreateCreditAccount({ userId: params.userId });

  if (account.balanceCop < minCop) {
    if (notify) {
      const now = new Date();
      const cutoff = new Date(now.getTime() - notifyCooldownMinutes * 60_000);

      // Throttle persistido (multi-instancia safe): sólo 1 request por ventana envía push.
      const mark = await prisma.creditAccount.updateMany({
        where: {
          userId: params.userId,
          OR: [{ lowCreditsPushSentAt: null }, { lowCreditsPushSentAt: { lt: cutoff } }],
        },
        data: { lowCreditsPushSentAt: now },
      });

      if (mark.count === 1) {
        void sendPushToUser({
          userId: params.userId,
          title: "Saldo insuficiente",
          body: "Tu saldo no cuenta con el mínimo para seguir prestando el servicio. Comunicate con la operadora o ve a la oficina para recargar.",
          data: {
            type: "LOW_CREDITS",
            balanceCop: String(account.balanceCop),
            minCop: String(minCop),
          },
        });
      }
    }

    return {
      ok: false as const,
      status: 402 as const,
      error: lowCreditsMessage({ audience, balanceCop: account.balanceCop, minCop }),
      balanceCop: account.balanceCop,
      minCop,
    };
  }

  return { ok: true as const, balanceCop: account.balanceCop, minCop };
}

function rideFinalAmountCop(ride: {
  isFixedPrice?: any;
  fixedPriceCop?: any;
  meterPrice: any;
  agreedPrice: any;
  estimatedPrice: any;
}) {
  const isFixed = Boolean(ride.isFixedPrice);
  if (isFixed) {
    const fixed = Number(ride.fixedPriceCop ?? 0);
    const estimated = Number(ride.estimatedPrice ?? 0);
    const value = fixed > 0 ? fixed : estimated;
    return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  }

  const meter = Number(ride.meterPrice ?? 0);
  const agreed = Number(ride.agreedPrice ?? 0);
  const estimated = Number(ride.estimatedPrice ?? 0);

  const value = meter > 0 ? meter : agreed > 0 ? agreed : estimated;
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

export async function chargeDriverCreditsForCompletedRide(params: { rideId: string; now?: Date }) {
  const now = params.now ?? new Date();

  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    select: {
      id: true,
      status: true,
      isFixedPrice: true,
      fixedPriceCop: true,
      meterPrice: true,
      agreedPrice: true,
      estimatedPrice: true,
      driverCreditChargedAt: true,
      matchedDriver: { select: { userId: true, creditChargeFixedCop: true } },
    },
  });

  if (!ride) return { ok: false as const, status: 404 as const, error: "Ride not found" };
  if (ride.status !== "COMPLETED") return { ok: true as const, charged: false as const, reason: "not_completed" };
  if (!ride.matchedDriver?.userId) return { ok: true as const, charged: false as const, reason: "no_driver" };
  if (ride.driverCreditChargedAt) return { ok: true as const, charged: false as const, reason: "already_charged" };

  const appConfig = await getAppConfig();

  let amountCop = 0;

  const pct = Number((appConfig as any).driverCreditChargePercent ?? 0);
  if (Number.isFinite(pct) && pct > 0) {
    const base = rideFinalAmountCop(ride);
    amountCop = Math.max(0, Math.round((base * pct) / 100));
  } else if (appConfig.driverCreditChargeMode === "SERVICE_VALUE") {
    amountCop = rideFinalAmountCop(ride);
  } else {
    const fixed = ride.matchedDriver?.creditChargeFixedCop ?? 0;
    amountCop = Math.max(0, Math.round(Number.isFinite(Number(fixed)) ? Number(fixed) : 0));
  }

  if (amountCop <= 0) {
    // Marcamos como cobrado para evitar reintentos innecesarios si el monto final es 0.
    const mark = await prisma.rideRequest.updateMany({
      where: { id: ride.id, status: "COMPLETED", driverCreditChargedAt: null },
      data: { driverCreditChargedAt: now, driverCreditChargedCop: 0 },
    });
    return { ok: true as const, charged: mark.count === 1, amountCop: 0 };
  }

  const result = await prisma.$transaction(async (tx) => {
    const marked = await tx.rideRequest.updateMany({
      where: { id: ride.id, status: "COMPLETED", driverCreditChargedAt: null },
      data: { driverCreditChargedAt: now, driverCreditChargedCop: amountCop },
    });

    if (marked.count !== 1) {
      return { charged: false as const };
    }

    const account = await tx.creditAccount.upsert({
      where: { userId: ride.matchedDriver!.userId },
      create: { userId: ride.matchedDriver!.userId, balanceCop: -amountCop },
      update: { balanceCop: { decrement: amountCop } },
    });

    return { charged: true as const, account };
  });

  return {
    ok: true as const,
    charged: result.charged,
    amountCop,
    balanceCop: result.charged ? result.account.balanceCop : undefined,
  };
}
