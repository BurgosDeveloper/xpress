import { ServiceType } from "@prisma/client";
import { prisma } from "../../db/prisma";

type PricingLike = {
  baseFare: any;
  nightBaseFare: any;
  nightStartHour: number;
  nightEndHour?: number;
  perKm: any;
  includedMeters: number;
  stepMeters: number;
  stepPrice: any;
  acSurcharge: any;
  trunkSurcharge: any;
  petsSurcharge: any;
};

function pickTemplate(params: { primary?: PricingLike | null; fallback?: PricingLike | null }) {
  return (params.primary ?? params.fallback) || null;
}

export async function ensurePricingConfigsForAllServiceTypes() {
  const required: ServiceType[] = [ServiceType.CARRO, ServiceType.MOTO, ServiceType.MOTO_CARGA, ServiceType.CARRO_CARGA];

  const existing = await prisma.pricingConfig.findMany({
    where: { serviceType: { in: required } },
  });

  const byType = new Map<ServiceType, PricingLike>();
  for (const row of existing as any[]) {
    byType.set(row.serviceType as ServiceType, row as PricingLike);
  }

  const any = (await prisma.pricingConfig.findFirst({ orderBy: { serviceType: "asc" } })) as any as PricingLike | null;

  const templateCarro = pickTemplate({ primary: byType.get(ServiceType.CARRO) ?? null, fallback: any });
  const templateMoto = pickTemplate({ primary: byType.get(ServiceType.MOTO) ?? null, fallback: any });

  const toCreate: Array<{ serviceType: ServiceType; tpl: PricingLike }> = [];

  if (!byType.has(ServiceType.CARRO_CARGA) && templateCarro) {
    toCreate.push({ serviceType: ServiceType.CARRO_CARGA, tpl: templateCarro });
  }
  if (!byType.has(ServiceType.MOTO_CARGA) && templateMoto) {
    toCreate.push({ serviceType: ServiceType.MOTO_CARGA, tpl: templateMoto });
  }

  if (toCreate.length === 0) return { ok: true as const, created: 0 };

  for (const item of toCreate) {
    const tpl: any = item.tpl as any;
    await prisma.pricingConfig.upsert({
      where: { serviceType: item.serviceType },
      update: {},
      create: {
        serviceType: item.serviceType,
        baseFare: tpl.baseFare,
        nightBaseFare: tpl.nightBaseFare ?? 0,
        nightStartHour: typeof tpl.nightStartHour === "number" ? tpl.nightStartHour : 20,
        nightEndHour: typeof (tpl as any).nightEndHour === "number" ? (tpl as any).nightEndHour : 23,
        perKm: tpl.perKm,
        includedMeters: Number(tpl.includedMeters ?? 0),
        stepMeters: Number(tpl.stepMeters ?? 0),
        stepPrice: tpl.stepPrice ?? 0,
        acSurcharge: tpl.acSurcharge ?? 0,
        trunkSurcharge: tpl.trunkSurcharge ?? 0,
        petsSurcharge: tpl.petsSurcharge ?? 0,
      },
    });
  }

  return { ok: true as const, created: toCreate.length };
}
