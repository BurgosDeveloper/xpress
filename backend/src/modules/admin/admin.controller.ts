import type { Request, Response } from "express";
import {
  CreateDriverSchema,
  UpdateDriverStatusSchema,
  UpdateAppConfigSchema,
  UpsertPricingSchema,
  AssignRideDriverSchema,
  CreatePricingAddonSchema,
  UpdatePricingAddonSchema,
  AdjustDriverCreditsSchema,
  SetDriverActiveSchema,
  SetPassengerActiveSchema,
  UpdateDriverSchema,
  UpdatePassengerSchema,
} from "./admin.schemas";
import {
  approveDriver,
  assignRideDriverByAdmin,
  adminDeleteAllRides,
  adminGetAppConfig,
  adminGetRidesStats,
  adminUpdateAppConfig,
  adminAdjustDriverCredits,
  adminGetDriverCredits,
  adminSetDriverActive,
  adminHardDeleteDriver,
  adminSetPassengerActive,
  adminUpdatePassenger,
  adminDeletePassenger,
  adminUpdateDriver,
  createDriverByAdmin,
  createPricingAddon,
  deactivatePricingAddon,
  getMetrics,
  getPricing,
  listDrivers,
  listPassengers,
  listPricingAddons,
  listRatings,
  listRides,
  updatePricingAddon,
  upsertPricing,
} from "./admin.service";

export async function adminGetAppConfigController(_req: Request, res: Response) {
  const result = await adminGetAppConfig();
  return res.status(200).json(result);
}

export async function adminUpdateAppConfigController(req: Request, res: Response) {
  const input = UpdateAppConfigSchema.parse(req.body);
  const result = await adminUpdateAppConfig(input);
  return res.status(200).json(result);
}

export async function adminGetDriverCreditsController(req: Request, res: Response) {
  const { driverId } = req.params;
  const result = await adminGetDriverCredits({ driverId });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function adminAdjustDriverCreditsController(req: Request, res: Response) {
  const { driverId } = req.params;
  const input = AdjustDriverCreditsSchema.parse(req.body);
  const result = await adminAdjustDriverCredits({ driverId, deltaCop: input.deltaCop });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function adminSetDriverActiveController(req: Request, res: Response) {
  const { driverId } = req.params;
  const input = SetDriverActiveSchema.parse(req.body);
  const result = await adminSetDriverActive({ driverId, isActive: input.isActive });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function adminUpdateDriverController(req: Request, res: Response) {
  const { driverId } = req.params;
  const input = UpdateDriverSchema.parse(req.body);

  const result = await adminUpdateDriver({ driverId, ...input });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function adminCreateDriverController(req: Request, res: Response) {
  const input = CreateDriverSchema.parse(req.body);
  const result = await createDriverByAdmin(input);

  if (!result.ok) return res.status(409).json({ message: result.error });
  return res.status(201).json(result);
}

export async function adminListDriversController(req: Request, res: Response) {
  const rows = await listDrivers();
  return res.status(200).json({ ok: true, drivers: rows });
}

export async function adminApproveDriverController(req: Request, res: Response) {
  const { driverId } = req.params;
  const input = UpdateDriverStatusSchema.parse(req.body);
  const updated = await approveDriver({ driverId, status: input.status });
  return res.status(200).json({ ok: true, driver: updated });
}

export async function adminHardDeleteDriverController(req: Request, res: Response) {
  const { driverId } = req.params;
  const result = await adminHardDeleteDriver({ driverId });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function adminUpsertPricingController(req: Request, res: Response) {
  const serviceType = String(req.params.serviceType);
  const allowed = ["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"] as const;
  if (!allowed.includes(serviceType as any)) {
    return res.status(400).json({ message: "Invalid serviceType" });
  }

  const input = UpsertPricingSchema.parse(req.body);
  const row = await upsertPricing({ serviceType: serviceType as (typeof allowed)[number], ...input });
  return res.status(200).json({ ok: true, pricing: row });
}

export async function adminGetPricingController(_req: Request, res: Response) {
  const rows = await getPricing();
  return res.status(200).json({ ok: true, pricing: rows });
}

export async function adminGetMetricsController(req: Request, res: Response) {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;

  const metrics = await getMetrics({ from, to });
  return res.status(200).json({ ok: true, metrics });
}

export async function adminListPassengersController(req: Request, res: Response) {
  const take = req.query.take ? Math.min(100, Math.max(1, Number(req.query.take))) : 50;
  const skip = req.query.skip ? Math.max(0, Number(req.query.skip)) : 0;
  const rows = await listPassengers({ skip, take });
  return res.status(200).json({ ok: true, passengers: rows });
}

export async function adminSetPassengerActiveController(req: Request, res: Response) {
  const { passengerId } = req.params;
  const input = SetPassengerActiveSchema.parse(req.body);
  const result = await adminSetPassengerActive({ passengerId, isActive: input.isActive });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function adminUpdatePassengerController(req: Request, res: Response) {
  const { passengerId } = req.params;
  const input = UpdatePassengerSchema.parse(req.body);
  const result = await adminUpdatePassenger({ passengerId, ...input });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function adminDeletePassengerController(req: Request, res: Response) {
  const { passengerId } = req.params;
  const result = await adminDeletePassenger({ passengerId });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function adminListRidesController(req: Request, res: Response) {
  const take = req.query.take ? Math.min(100, Math.max(1, Number(req.query.take))) : 50;
  const skip = req.query.skip ? Math.max(0, Number(req.query.skip)) : 0;
  const status = req.query.status ? String(req.query.status) : undefined;

  const serviceType = req.query.serviceType ? String(req.query.serviceType) : undefined;
  const driverId = req.query.driverId ? String(req.query.driverId) : undefined;
  const passengerUserId = req.query.passengerUserId ? String(req.query.passengerUserId) : undefined;
  const assignedByAdmin =
    typeof req.query.assignedByAdmin === "string" ? String(req.query.assignedByAdmin) === "true" : undefined;

  const dateField = req.query.dateField ? String(req.query.dateField) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if (from && Number.isNaN(from.getTime())) return res.status(400).json({ message: "Invalid from" });
  if (to && Number.isNaN(to.getTime())) return res.status(400).json({ message: "Invalid to" });

  const rows = await listRides({
    skip,
    take,
    status,
    serviceType,
    driverId,
    passengerUserId,
    assignedByAdmin,
    dateField,
    from,
    to,
  });
  return res.status(200).json({ ok: true, rides: rows });
}

export async function adminGetRidesStatsController(_req: Request, res: Response) {
  const stats = await adminGetRidesStats();
  return res.status(200).json({ ok: true, stats });
}

export async function adminDeleteAllRidesController(_req: Request, res: Response) {
  const result = await adminDeleteAllRides();
  return res.status(200).json(result);
}

export async function adminListRatingsController(req: Request, res: Response) {
  const take = req.query.take ? Math.min(100, Math.max(1, Number(req.query.take))) : 50;
  const skip = req.query.skip ? Math.max(0, Number(req.query.skip)) : 0;
  const rows = await listRatings({ skip, take });
  return res.status(200).json({ ok: true, ratings: rows });
}

export async function adminAssignRideDriverController(req: Request, res: Response) {
  const { rideId } = req.params;
  const input = AssignRideDriverSchema.parse(req.body);

  const result = await assignRideDriverByAdmin({ rideId, driverId: input.driverId });
  if (!result.ok) {
    const status = (result as any).status;
    return res.status(typeof status === "number" ? status : 400).json({ message: result.error });
  }

  return res.status(200).json({ ok: true, ride: result.ride });
}

export async function adminListAddonsController(req: Request, res: Response) {
  const serviceType = req.query.serviceType ? String(req.query.serviceType) : undefined;
  const isActive = typeof req.query.isActive === "string" ? String(req.query.isActive) === "true" : undefined;
  const rows = await listPricingAddons({ serviceType, isActive });
  return res.status(200).json({ ok: true, addons: rows });
}

export async function adminCreateAddonController(req: Request, res: Response) {
  const input = CreatePricingAddonSchema.parse(req.body);
  const result = await createPricingAddon(input);
  if (!result.ok) return res.status(409).json({ message: result.error });
  return res.status(201).json({ ok: true, addon: result.addon });
}

export async function adminUpdateAddonController(req: Request, res: Response) {
  const { addonId } = req.params;
  const input = UpdatePricingAddonSchema.parse(req.body);
  const result = await updatePricingAddon({ addonId, ...input });
  if (!result.ok) return res.status(409).json({ message: result.error });
  return res.status(200).json({ ok: true, addon: result.addon });
}

export async function adminDeleteAddonController(req: Request, res: Response) {
  const { addonId } = req.params;
  const addon = await deactivatePricingAddon({ addonId });
  return res.status(200).json({ ok: true, addon });
}
