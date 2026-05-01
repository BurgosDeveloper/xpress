import type { ServiceType } from "../rides/rides.types";

export type LatLng = { lat: number; lng: number; address?: string };

export type RoutePathPoint = { lat: number; lng: number };

export type OfferEstimate = {
  ok: true;
  distanceMeters: number;
  durationSeconds?: number;
  routePath?: RoutePathPoint[] | null;
  estimatedPrice: number;
  isFixedPrice: boolean;
  fixedPriceCop?: number | null;
  pricing: {
    baseFare: number;
    perKm: number;
    includedMeters?: number;
    stepMeters?: number;
    stepPrice?: number;
    acSurcharge: number;
    trunkSurcharge: number;
    petsSurcharge: number;
  };
};

export type Offer = {
  id: string;
  passengerId: string;
  committedDriverId: string | null;
  rideId: string | null;
  serviceTypeWanted: ServiceType;
  pickupLat: any;
  pickupLng: any;
  pickupAddress: string | null;
  dropoffLat: any;
  dropoffLng: any;
  dropoffAddress: string | null;
  distanceMeters: number;
  durationSeconds?: number | null;
  routePath?: RoutePathPoint[] | null;
  estimatedPrice: any;
  offeredPrice: any;
  searchRadiusM: number;
  status: "OPEN" | "COMMITTED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
};

export type OfferCreateResult = {
  ok: true;
  offer: Offer;
};

export type NearbyOfferItem = {
  offerId: string;
  serviceTypeWanted: ServiceType;
  passenger?: {
    fullName?: string;
    phone?: string;
    photoUrl?: string | null;
  };
  routePath?: RoutePathPoint[] | null;
  pickup: LatLng;
  dropoff: LatLng;
  estimatedPrice: number;
  offeredPrice: number;
  createdAt: string;
  distanceMeters: number;
};

export type NearbyOffersResult = {
  ok: true;
  center: { lat: number; lng: number };
  radiusM: number;
  items: NearbyOfferItem[];
};

export type OfferForDriverResult = {
  ok: true;
  offer: any;
};

export type CommitOfferResult = {
  ok: true;
  ride: any;
  offer: any;
};
