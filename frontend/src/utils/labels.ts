import type { UserRole } from "../auth/auth.types";

export function roleLabel(role?: UserRole | null) {
  if (role === "DRIVER") return "Ejecutivo";
  if (role === "USER") return "Cliente";
  if (role === "ADMIN") return "Administrador de sistema";
  return "-";
}

export function userDisplayName(user: any): string {
  const passenger = user?.passenger;
  const driver = user?.driver;

  const fromPassenger =
    (typeof passenger?.fullName === "string" && passenger.fullName.trim()) ||
    `${passenger?.firstName ?? ""} ${passenger?.lastName ?? ""}`.trim();

  if (fromPassenger) return fromPassenger;

  const fromDriver =
    (typeof driver?.fullName === "string" && driver.fullName.trim()) ||
    `${driver?.firstName ?? ""} ${driver?.lastName ?? ""}`.trim();

  if (fromDriver) return fromDriver;

  const fromUsername = typeof user?.username === "string" ? user.username.trim() : "";
  if (fromUsername) return fromUsername;

  const fromEmail = typeof user?.email === "string" ? user.email.trim() : "";
  if (fromEmail) return fromEmail;

  return "-";
}

export function rideStatusLabel(params: {
  status?: string | null;
  role?: UserRole | null;
  canRate?: boolean;
}) {
  const s = String(params.status ?? "");
  const role = params.role;

  if (s === "OPEN") return role === "USER" ? "Buscando ejecutivo" : "Pendiente";
  if (s === "ASSIGNED" || s === "MATCHED") return role === "USER" ? "Ejecutivo asignado" : "Servicio asignado";
  if (s === "ACCEPTED") return role === "USER" ? "Ejecutivo aceptó" : "Servicio aceptado";
  if (s === "IN_PROGRESS") return "En curso";
  if (s === "COMPLETED") return params.canRate ? "Finalizado (pendiente de calificación)" : "Finalizado";
  if (s === "CANCELLED") return "Cancelado";
  if (s === "EXPIRED") return "Expirado";

  return s || "—";
}

export function offerStatusLabel(params: { status?: string | null; role?: UserRole | null }) {
  const s = String(params.status ?? "");
  const role = params.role;

  if (s === "OPEN") return role === "USER" ? "Buscando ejecutivo" : "Disponible";
  if (s === "COMMITTED") return role === "USER" ? "Ejecutivo comprometido" : "Comprometida";
  if (s === "CANCELLED") return "Cancelada";
  if (s === "EXPIRED") return "Expirada";

  return s || "—";
}
