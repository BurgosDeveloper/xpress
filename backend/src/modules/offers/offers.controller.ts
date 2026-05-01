import type { Request, Response } from "express";
import { CommitOfferSchema, CreateOfferSchema, EstimateOfferSchema, NearbyOffersQuerySchema } from "./offers.schemas";
import { cancelOffer, commitOffer, createOffer, estimateOffer, getOfferForDriver, listMyOffers, listNearbyOffers } from "./offers.service";

export async function estimateOfferController(req: Request, res: Response) {
  const input = EstimateOfferSchema.parse(req.body);
  const result = await estimateOffer({
    serviceTypeWanted: input.serviceTypeWanted,
    pickup: input.pickup,
    dropoff: input.dropoff,
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
    routePath: input.routePath,
    wantsAC: input.wantsAC,
    wantsTrunk: input.wantsTrunk,
    wantsPets: input.wantsPets,
  });

  if (!result.ok) {
    const status = (result as any).status ?? 400;
    return res.status(status).json({
      ok: false,
      message: result.error,
      code: (result as any).code,
      details: (result as any).details,
    });
  }
  return res.status(200).json(result);
}

export async function createOfferController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = CreateOfferSchema.parse(req.body);
  const result = await createOffer({
    userId,
    serviceTypeWanted: input.serviceTypeWanted,
    pickup: input.pickup,
    dropoff: input.dropoff,
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
    routePath: input.routePath,
    offeredPrice: input.offeredPrice,
    searchRadiusM: input.searchRadiusM,
  });

  if (!result.ok) return res.status((result as any).status ?? 400).json({ message: result.error });
  return res.status(201).json(result);
}

export async function nearbyOffersController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = NearbyOffersQuerySchema.parse(req.query);
  const result = await listNearbyOffers({
    userId,
    center: { lat: input.lat, lng: input.lng },
    radiusM: input.radiusM,
    serviceType: input.serviceType,
  });

  if (!result.ok) return res.status(400).json({ message: result.error });
  return res.status(200).json(result);
}

export async function getOfferController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const offerId = req.params.offerId;
  const result = await getOfferForDriver({ userId, offerId });

  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json({ ok: true, offer: result.offer });
}

export async function commitOfferController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const offerId = req.params.offerId;
  const input = CommitOfferSchema.parse(req.body ?? {});
  const result = await commitOffer({ userId, offerId, coords: input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : undefined });

  if (!result.ok) return res.status((result as any).status ?? 400).json({ message: result.error });
  return res.status(200).json(result);
}

export async function myOffersController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const result = await listMyOffers({ userId });
  if (!result.ok) return res.status(400).json({ message: result.error });
  return res.status(200).json(result);
}

export async function cancelOfferController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const offerId = req.params.offerId;
  const result = await cancelOffer({ userId, offerId });
  if (!result.ok) return res.status(400).json({ message: result.error });
  return res.status(200).json(result);
}
