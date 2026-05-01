import { apiRequest } from "../lib/api";
import type { ServiceType } from "../rides/rides.types";

export type MyProfileResponse = {
  ok: true;
  profile: {
    role: "USER" | "DRIVER" | "ADMIN";
    user: { email: string; username: string | null };
    passenger: null | {
      fullName: string;
      firstName: string;
      lastName: string;
      phone: string;
    };
    driver: null | {
      fullName: string;
      firstName: string;
      lastName: string;
      phone: string;
      mobilePayBank: string | null;
      mobilePayDocument: string | null;
      mobilePayPhone: string | null;
      photoUrl: string;
      serviceType: ServiceType;
      vehicle: null | {
        brand: string;
        model: string;
        plate: string | null;
        year: number;
        color: string;
      };
    };
    password: { masked: true };
  };
};

export function apiGetMyProfile(token: string) {
  return apiRequest<MyProfileResponse>({ method: "GET", path: "/profile/me", token });
}

export function apiUpdateMyProfile(
  token: string,
  body:
    | { firstName?: string; lastName?: string; phone?: string; email?: string }
    | { firstName?: string; lastName?: string; phone?: string; mobilePayBank?: string | null; mobilePayDocument?: string | null; mobilePayPhone?: string | null }
) {
  return apiRequest<{ ok: true } | any>({ method: "PATCH", path: "/profile/me", token, body });
}

export function apiDeleteMyAccount(token: string) {
  return apiRequest<{ ok: true }>({ method: "DELETE", path: "/profile/me", token });
}
