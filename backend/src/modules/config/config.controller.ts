import type { Request, Response } from "express";
import { getAppConfig, normalizeMatchingRadiusM } from "./appConfig.service";
import { prisma } from "../../db/prisma";

export async function getPublicAppConfigController(_req: Request, res: Response) {
  const cfg = await getAppConfig();

  const text = (v: any) => {
    const s = typeof v === "string" ? v : v == null ? "" : String(v);
    return s;
  };

  return res.json({
    ok: true as const,
    appConfig: {
      id: cfg.id,
      fxCopPerUsd: Number((cfg as any).fxCopPerUsd ?? 0),
      fxCopPerVes: Number((cfg as any).fxCopPerVes ?? 0),
      matchingRadiusM: normalizeMatchingRadiusM((cfg as any).matchingRadiusM),

      zoeWhatsappPhone: text((cfg as any).zoeWhatsappPhone),

      paymentBancolombiaHolder: text((cfg as any).paymentBancolombiaHolder),
      paymentBancolombiaDocument: text((cfg as any).paymentBancolombiaDocument),
      paymentBancolombiaAccountType: text((cfg as any).paymentBancolombiaAccountType),
      paymentBancolombiaAccountNumber: text((cfg as any).paymentBancolombiaAccountNumber),

      paymentZelleHolder: text((cfg as any).paymentZelleHolder),
      paymentZelleEmail: text((cfg as any).paymentZelleEmail),
      paymentZellePhone: text((cfg as any).paymentZellePhone),
    },
  });
}

export async function getPublicZonesController(_req: Request, res: Response) {
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: [{ isHub: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isHub: true,
      geojson: true,
    },
  });

  return res.json({ ok: true as const, zones });
}
