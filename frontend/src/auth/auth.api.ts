import { apiRequest } from "../lib/api";
import type {
  LoginResponse,
  MeResponse,
  PasswordResetConfirmResponse,
  PasswordResetRequestResponse,
  PasswordResetVerifyResponse,
  RegisterPassengerResponse,
} from "./auth.types";

export function apiLogin(input: { user: string; password: string }) {
  return apiRequest<LoginResponse>({ method: "POST", path: "/auth/login", body: input });
}

export function apiRegisterPassenger(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}) {
  return apiRequest<RegisterPassengerResponse>({
    method: "POST",
    path: "/auth/register/passenger",
    body: input,
  });
}

export function apiMe(token: string) {
  return apiRequest<MeResponse>({ method: "GET", path: "/auth/me", token });
}

export function apiPasswordResetRequest(input: { user: string }) {
  return apiRequest<PasswordResetRequestResponse>({
    method: "POST",
    path: "/auth/password-reset/request",
    body: input,
  });
}

export function apiPasswordResetVerify(input: { resetRequestId: string; code: string }) {
  return apiRequest<PasswordResetVerifyResponse>({
    method: "POST",
    path: "/auth/password-reset/verify",
    body: input,
  });
}

export function apiPasswordResetConfirm(input: { resetToken: string; newPassword: string }) {
  return apiRequest<PasswordResetConfirmResponse>({
    method: "POST",
    path: "/auth/password-reset/confirm",
    body: input,
  });
}
