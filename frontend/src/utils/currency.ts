export type FxConfig = {
  fxCopPerUsd?: number | null;
  fxCopPerVes?: number | null;
};

function safeNumber(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : NaN;
}

function formatNumber(value: number, opts: { min: number; max: number; locale?: string }) {
  const v = safeNumber(value);
  if (!Number.isFinite(v)) return "-";

  try {
    const nf = new Intl.NumberFormat(opts.locale ?? undefined, {
      minimumFractionDigits: opts.min,
      maximumFractionDigits: opts.max,
    });
    return nf.format(v);
  } catch {
    // Fallback simple si Intl no está disponible.
    return v.toFixed(opts.max);
  }
}

export function formatCop(value: number) {
  const rounded = Math.round(safeNumber(value) * 100) / 100;
  return `₱${formatNumber(rounded, { min: 0, max: 2, locale: "es-CO" })}`;
}

export function formatUsd(value: number) {
  const rounded = Math.round(safeNumber(value) * 100) / 100;
  return `$${formatNumber(rounded, { min: 2, max: 2, locale: "en-US" })}`;
}

export function formatVes(value: number) {
  const rounded = Math.round(safeNumber(value) * 100) / 100;
  return `Bs. ${formatNumber(rounded, { min: 2, max: 2, locale: "es-VE" })}`;
}

export function formatSecondaryFromCop(cop: number, fx: FxConfig) {
  const copPerUsd = safeNumber(fx.fxCopPerUsd);
  const copPerVes = safeNumber(fx.fxCopPerVes);

  const parts: string[] = [];

  if (Number.isFinite(copPerUsd) && copPerUsd > 0) {
    parts.push(formatUsd(cop / copPerUsd));
  }

  if (Number.isFinite(copPerVes) && copPerVes > 0) {
    parts.push(formatVes(cop / copPerVes));
  }

  return parts.length ? parts.join(" • ") : null;
}
