export type UserRole = "ADMIN" | "DRIVER" | "USER";

export type MeUser = {
  id: string;
  username?: string | null;
  email?: string | null;
  role: UserRole;
};

export type LoginResponse = {
  ok: true;
  token: string;
  user: MeUser & {
    passenger?: unknown;
    driver?: unknown;
  };
};

export type RegisterPassengerResponse = {
  ok: true;
  token: string;
  user: MeUser & {
    passenger?: unknown;
  };
};

export type MeResponse = {
  ok: true;
  user: MeUser & {
    passenger?: unknown;
    driver?: unknown;
  };
};

export type PasswordResetRequestResponse = {
  ok: true;
  resetRequestId: string;
  phoneLast3: string;
};

export type PasswordResetVerifyResponse = {
  ok: true;
  resetToken: string;
};

export type PasswordResetConfirmResponse = {
  ok: true;
};
