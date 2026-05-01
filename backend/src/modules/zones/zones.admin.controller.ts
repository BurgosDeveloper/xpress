import type { Request, Response } from "express";
import {
  AdminCreateZoneSchema,
  AdminUpdateZoneSchema,
  AdminUpsertZoneFixedPriceSchema,
} from "./zones.schemas";
import {
  adminCreateZone,
  adminDeleteZone,
  adminDeleteZoneFixedPrice,
  adminListZoneFixedPrices,
  adminListZones,
  adminUpdateZone,
  adminUpsertZoneFixedPrice,
} from "./zones.service";

export async function adminListZonesController(_req: Request, res: Response) {
  const result = await adminListZones();
  return res.status(200).json(result);
}

export async function adminCreateZoneController(req: Request, res: Response) {
  const input = AdminCreateZoneSchema.parse(req.body);

  try {
    const result = await adminCreateZone(input);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ ok: false, message: err?.message ?? "Invalid zone" });
  }
}

export async function adminUpdateZoneController(req: Request, res: Response) {
  const { zoneId } = req.params;
  const input = AdminUpdateZoneSchema.parse(req.body);

  try {
    const result = await adminUpdateZone({ zoneId, ...input });
    if (!result.ok) return res.status(result.status).json({ ok: false, message: result.error });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ ok: false, message: err?.message ?? "Invalid zone update" });
  }
}

export async function adminDeleteZoneController(req: Request, res: Response) {
  const { zoneId } = req.params;
  const result = await adminDeleteZone({ zoneId });
  if (!result.ok) return res.status(result.status).json({ ok: false, message: result.error });
  return res.status(200).json(result);
}

export async function adminListZoneFixedPricesController(_req: Request, res: Response) {
  const result = await adminListZoneFixedPrices();
  return res.status(200).json(result);
}

export async function adminUpsertZoneFixedPriceController(req: Request, res: Response) {
  const input = AdminUpsertZoneFixedPriceSchema.parse(req.body);
  const result = await adminUpsertZoneFixedPrice(input);
  if (!result.ok) return res.status(result.status).json({ ok: false, message: result.error });
  return res.status(200).json(result);
}

export async function adminDeleteZoneFixedPriceController(req: Request, res: Response) {
  const { id } = req.params;
  const result = await adminDeleteZoneFixedPrice({ id });
  if (!result.ok) return res.status(result.status).json({ ok: false, message: result.error });
  return res.status(200).json(result);
}
