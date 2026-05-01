import { apiRequest } from "../lib/api";
import type { CommitOfferResult, NearbyOffersResult, OfferCreateResult, OfferEstimate, OfferForDriverResult } from "./offers.types";
import type { ServiceType } from "../rides/rides.types";
import { ApiError } from "../lib/api";

export async function apiEstimateOffer(
  token: string,
  body: {
    serviceTypeWanted: ServiceType;
    pickup: { lat: number; lng: number; address?: string };
    dropoff: { lat: number; lng: number; address?: string };
    distanceMeters?: number;
    durationSeconds?: number;
    routePath?: Array<{ lat: number; lng: number }>;
    wantsAC?: boolean;
    wantsTrunk?: boolean;
    wantsPets?: boolean;
  }
) {
  try {
    return await apiRequest<OfferEstimate>({ method: "POST", path: "/offers/estimate", body, token, timeoutMs: 25000 });
  } catch (e) {
    // Retry best-effort: OSRM/latencia de red pueden tener picos.
    if (e instanceof ApiError && e.status === 408) {
      return apiRequest<OfferEstimate>({ method: "POST", path: "/offers/estimate", body, token, timeoutMs: 35000 });
    }
    throw e;
  }
}

export async function apiCreateOffer(
  token: string,
  body: {
    serviceTypeWanted: ServiceType;
    pickup: { lat: number; lng: number; address?: string };
    dropoff: { lat: number; lng: number; address?: string };
    distanceMeters?: number;
    durationSeconds?: number;
    routePath?: Array<{ lat: number; lng: number }>;
    offeredPrice: number;
    searchRadiusM?: number;
  }
) {
  return apiRequest<OfferCreateResult>({ method: "POST", path: "/offers", body, token });
}

export async function apiMyOffers(token: string) {
  return apiRequest<{ ok: true; offers: any[] }>({ method: "GET", path: "/offers/mine", token });
}

export async function apiCancelOffer(token: string, offerId: string) {
  return apiRequest<{ ok: true; offer: any }>({ method: "POST", path: `/offers/${offerId}/cancel`, token });
}

export async function apiNearbyOffers(
  token: string,
  query: { lat: number; lng: number; radiusM?: number; serviceType?: ServiceType }
) {
  const q = new URLSearchParams();
  q.set("lat", String(query.lat));
  q.set("lng", String(query.lng));
  if (query.radiusM != null) q.set("radiusM", String(query.radiusM));
  if (query.serviceType) q.set("serviceType", query.serviceType);

  return apiRequest<NearbyOffersResult>({ method: "GET", path: `/offers/nearby?${q.toString()}`, token });
}

export async function apiGetOfferForDriver(token: string, offerId: string) {
  return apiRequest<OfferForDriverResult>({ method: "GET", path: `/offers/${offerId}`, token });
}

export async function apiCommitOffer(token: string, offerId: string, body: { lat: number; lng: number }) {
  return apiRequest<CommitOfferResult>({ method: "POST", path: `/offers/${offerId}/commit`, body, token });
}
