import { DriverCreditChargeMode } from "@prisma/client";
import { prisma } from "../../db/prisma";

export const APP_CONFIG_ID = "global";
export const DEFAULT_MATCHING_RADIUS_M = 2000;
const MIN_MATCHING_RADIUS_M = 250;
const MAX_MATCHING_RADIUS_M = 20000;

export const DEFAULT_APP_CONFIG = {
  id: APP_CONFIG_ID,
  driverCreditChargeMode: DriverCreditChargeMode.SERVICE_VALUE,
  driverCreditChargePercent: 0,
  fxCopPerUsd: 0,
  fxCopPerVes: 0,
  matchingRadiusM: DEFAULT_MATCHING_RADIUS_M,
} as const;

export async function getAppConfig() {
  // Nota: el TS Server de VS Code puede quedar con tipos viejos de Prisma hasta regenerar/reiniciar.
  // Acceso dinámico para evitar falsos positivos en el editor.
  const prismaAny = prisma as any;
  return prismaAny.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    create: DEFAULT_APP_CONFIG,
    update: {},
  });
}

export function normalizeMatchingRadiusM(value: unknown) {
  const raw = Math.floor(Number(value));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MATCHING_RADIUS_M;
  return Math.max(MIN_MATCHING_RADIUS_M, Math.min(MAX_MATCHING_RADIUS_M, raw));
}

export function isNightNow(params: { now: Date; startHour: number; endHour: number }) {
  const hour = Math.max(0, Math.min(23, Math.floor(params.now.getHours())));
  const start = Math.max(0, Math.min(23, Math.floor(params.startHour)));
  const end = Math.max(0, Math.min(23, Math.floor(params.endHour)));

  // Rango inclusivo por horas (0-23). Soporta rangos que cruzan medianoche.
  // Ej: 20 -> 6 significa: 20,21,22,23,0,1,2,3,4,5,6
  if (start <= end) return hour >= start && hour <= end;
  return hour >= start || hour <= end;
}

export function effectiveBaseFare(params: {
  dayBaseFare: number;
  now: Date;
  nightBaseFare: number;
  nightStartHour: number;
  nightEndHour: number;
}) {
  const nightFare = Number(params.nightBaseFare ?? 0);
  if (nightFare <= 0) return params.dayBaseFare;

  const night = isNightNow({ now: params.now, startHour: params.nightStartHour, endHour: params.nightEndHour });
  return night ? nightFare : params.dayBaseFare;
}
