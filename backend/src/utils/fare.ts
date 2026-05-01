import { env } from "./env";

export function extraWholeKmBeyondIncluded(params: { distanceMeters: number; includedKm?: number }) {
  const includedKm = params.includedKm ?? env.METER_INCLUDED_KM;
  const kmWhole = Math.floor(Math.max(0, params.distanceMeters) / 1000);
  return Math.max(0, kmWhole - includedKm);
}

export function calculateFare(params: {
  distanceMeters: number;
  baseFare: number;
  perKm: number;
  includedKm?: number;
  includedMeters?: number;
  stepMeters?: number;
  stepPrice?: number;
  surcharge?: number;
  addonsTotal?: number;
}) {
  const surcharge = params.surcharge ?? 0;
  const addonsTotal = params.addonsTotal ?? 0;

  const stepMeters = Math.floor(Number(params.stepMeters ?? 0));
  const stepPrice = Number(params.stepPrice ?? 0);
  const useSteps = Number.isFinite(stepMeters) && stepMeters > 0 && Number.isFinite(stepPrice) && stepPrice > 0;

  let distanceCharge = 0;
  if (useSteps) {
    const includedMeters = Math.max(0, Math.floor(Number(params.includedMeters ?? 0)));
    const extraMeters = Math.max(0, Math.floor(Math.max(0, params.distanceMeters) - includedMeters));
    const steps = extraMeters > 0 ? Math.ceil(extraMeters / stepMeters) : 0;
    distanceCharge = steps * stepPrice;
  } else {
    const extraKm = extraWholeKmBeyondIncluded({ distanceMeters: params.distanceMeters, includedKm: params.includedKm });
    distanceCharge = Number(params.perKm) * extraKm;
  }

  const total = Number(params.baseFare) + distanceCharge + Number(surcharge) + Number(addonsTotal);

  // Guardamos con 2 decimales como el resto de precios (Decimal(10,2))
  return Math.max(0, Math.round(total * 100) / 100);
}
