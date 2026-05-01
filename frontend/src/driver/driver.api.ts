import { apiRequest } from "../lib/api";

export function apiDriverUpsertLocation(token: string, coords: { lat: number; lng: number }) {
  return apiRequest<{ ok: true; location: any }>({
    method: "PUT",
    path: "/driver/me/location",
    token,
    body: coords,
  });
}

export function apiDriverAcceptRide(token: string, rideId: string) {
  return apiRequest<{ ok: true; ride: any }>({
    method: "POST",
    path: `/driver/rides/${rideId}/accept`,
    token,
  });
}

export function apiDriverStartRide(token: string, rideId: string) {
  return apiRequest<{ ok: true; ride: any }>({
    method: "POST",
    path: `/driver/rides/${rideId}/start`,
    token,
  });
}

export function apiDriverCompleteRide(token: string, rideId: string) {
  return apiRequest<{ ok: true; ride: any }>({
    method: "POST",
    path: `/driver/rides/${rideId}/complete`,
    token,
  });
}

export function apiDriverUpdateMeter(token: string, rideId: string, input: { meterDistanceMeters: number }) {
  return apiRequest<{ ok: true; ride: any }>({
    method: "PUT",
    path: `/driver/rides/${rideId}/meter`,
    token,
    body: input,
  });
}

export function apiDriverNotifyArrived(token: string, rideId: string) {
  return apiRequest<{ ok: true } | { ok: false; message: string }>({
    method: "POST",
    path: `/driver/rides/${rideId}/notify-arrived`,
    token,
  });
}
