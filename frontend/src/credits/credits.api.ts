import { apiRequest } from "../lib/api";

export function apiGetMyCredits(token: string) {
  return apiRequest<{ ok: true; balanceCop: number }>({
    method: "GET",
    path: "/credits/me",
    token,
  });
}
