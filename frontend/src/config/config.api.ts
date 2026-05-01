import { apiRequest } from "../lib/api";

export type PublicAppConfig = {
  id: string;
  fxCopPerUsd: number;
  fxCopPerVes: number;
  matchingRadiusM: number;

  zoeWhatsappPhone: string;

  paymentBancolombiaHolder: string;
  paymentBancolombiaDocument: string;
  paymentBancolombiaAccountType: string;
  paymentBancolombiaAccountNumber: string;

  paymentZelleHolder: string;
  paymentZelleEmail: string;
  paymentZellePhone: string;
};

export type PublicZone = {
  id: string;
  name: string;
  isHub: boolean;
  geojson: unknown;
};

export function apiGetPublicAppConfig() {
  return apiRequest<{ ok: true; appConfig: PublicAppConfig }>({
    method: "GET",
    path: "/config/app",
  });
}

export function apiGetPublicZones() {
  return apiRequest<{ ok: true; zones: PublicZone[] }>({
    method: "GET",
    path: "/config/zones",
  });
}
