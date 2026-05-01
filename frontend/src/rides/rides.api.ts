import { apiRequest } from "../lib/api";
import type { CreateRideResponse, DriverTechSheetResponse, NearbyDriversResponse, SelectDriverResponse, ServiceType } from "./rides.types";

export function apiGetActiveRide(token: string) {
  return apiRequest<{ ok: true; ride: any | null }>({
    method: "GET",
    path: "/rides/active",
    token,
  });
}

export function apiConfirmRideComplete(token: string, rideId: string) {
  return apiRequest<{ ok: true; ride: any }>({
    method: "POST",
    path: `/rides/${rideId}/confirm-complete`,
    token,
  });
}

export function apiCancelRide(token: string, input: { rideId: string }) {
  return apiRequest<{ ok: true; ride: any }>({
    method: "POST",
    path: `/rides/${input.rideId}/cancel`,
    token,
  });
}

export function apiNearbyDrivers(
  token: string,
  input: { lat: number; lng: number; radiusM?: number; serviceType?: ServiceType }
) {
  const params = new URLSearchParams({
    lat: String(input.lat),
    lng: String(input.lng),
  });

  if (input.radiusM) params.set("radiusM", String(input.radiusM));
  if (input.serviceType) params.set("serviceType", input.serviceType);

  return apiRequest<NearbyDriversResponse>({
    method: "GET",
    path: `/rides/nearby-drivers?${params.toString()}`,
    token,
  });
}

export function apiCreateRide(
  token: string,
  input: {
    serviceTypeWanted: ServiceType;
    pickup: { lat: number; lng: number; address?: string };
    dropoff: { lat: number; lng: number; address?: string };
    distanceMeters?: number;
    durationSeconds?: number;
    routePath?: Array<{ lat: number; lng: number }>;
    searchRadiusM?: number;
  }
) {
  return apiRequest<CreateRideResponse>({
    method: "POST",
    path: "/rides",
    token,
    body: {
      serviceTypeWanted: input.serviceTypeWanted,
      pickup: input.pickup,
      dropoff: input.dropoff,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      routePath: input.routePath,
      wantsAC: false,
      wantsTrunk: false,
      wantsPets: false,
      searchRadiusM: input.searchRadiusM ?? 2000,
    },
  });
}

export function apiSelectRideDriver(token: string, input: { rideId: string; driverId: string }) {
  return apiRequest<SelectDriverResponse>({
    method: "POST",
    path: `/rides/${input.rideId}/select-driver`,
    token,
    body: { driverId: input.driverId },
  });
}

export function apiGetRideOffers(token: string, input: { rideId: string }) {
  return apiRequest<{ ok: true; ride: any; items: any[] }>({
    method: "GET",
    path: `/rides/${input.rideId}/offers`,
    token,
  });
}

export function apiRejectRideOffer(token: string, input: { rideId: string; driverId: string }) {
  return apiRequest<{ ok: true; candidate: any }>({
    method: "POST",
    path: `/rides/${input.rideId}/offers/${input.driverId}/reject`,
    token,
  });
}

export function apiGetDriverTechSheet(token: string, input: { driverId: string }) {
  return apiRequest<DriverTechSheetResponse>({
    method: "GET",
    path: `/rides/drivers/${input.driverId}`,
    token,
  });
}

export function apiPassengerRideHistory(token: string, input?: { take?: number }) {
  const params = new URLSearchParams();
  if (input?.take) params.set("take", String(input.take));
  const qs = params.toString();

  return apiRequest<{ ok: true; rides: any[] }>({
    method: "GET",
    path: `/rides/mine${qs ? `?${qs}` : ""}`,
    token,
  });
}

export function apiDriverRideHistory(token: string, input?: { take?: number }) {
  const params = new URLSearchParams();
  if (input?.take) params.set("take", String(input.take));
  const qs = params.toString();

  return apiRequest<{ ok: true; rides: any[] }>({
    method: "GET",
    path: `/rides/driver/mine${qs ? `?${qs}` : ""}`,
    token,
  });
}

export function apiGetRideById(token: string, input: { rideId: string }) {
  return apiRequest<{ ok: true; ride: any }>({
    method: "GET",
    path: `/rides/${input.rideId}`,
    token,
  });
}

export function apiDriverNearbyRideRequests(token: string, input?: { radiusM?: number; take?: number }) {
  const params = new URLSearchParams();
  if (input?.radiusM) params.set("radiusM", String(input.radiusM));
  if (input?.take) params.set("take", String(input.take));
  const qs = params.toString();

  return apiRequest<{ ok: true; center: { lat: number; lng: number }; radiusM: number; items: any[] }>({
    method: "GET",
    path: `/rides/driver/nearby-requests${qs ? `?${qs}` : ""}`,
    token,
  });
}

export function apiDriverOfferRide(token: string, input: { rideId: string }) {
  return apiRequest<{ ok: true; candidate: any }>({
    method: "POST",
    path: `/rides/${input.rideId}/offer`,
    token,
  });
}
