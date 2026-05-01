import type { PublicAppConfig } from "./config.api";

const DEFAULT_MATCHING_RADIUS_M = 2000;
const MIN_MATCHING_RADIUS_M = 250;
const MAX_MATCHING_RADIUS_M = 20000;

export function getMatchingRadiusM(appConfig: PublicAppConfig | null | undefined) {
  const raw = Math.floor(Number(appConfig?.matchingRadiusM ?? DEFAULT_MATCHING_RADIUS_M));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MATCHING_RADIUS_M;
  return Math.max(MIN_MATCHING_RADIUS_M, Math.min(MAX_MATCHING_RADIUS_M, raw));
}