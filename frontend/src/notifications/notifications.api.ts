import { apiRequest } from "../lib/api";

export function apiRegisterPushToken(token: string, input: { token: string; platform: "ANDROID" | "IOS" }) {
  return apiRequest<{ ok: true; pushToken: any }>({
    method: "POST",
    path: "/notifications/register-token",
    token,
    body: input,
  });
}
