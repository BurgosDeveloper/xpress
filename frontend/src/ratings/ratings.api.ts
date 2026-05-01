import { apiRequest } from "../lib/api";

export function apiCreateRating(token: string, body: { rideId: string; stars: number; comment?: string }) {
  return apiRequest<{ ok: true; rating: any }>({
    method: "POST",
    path: "/ratings",
    token,
    body,
  });
}
