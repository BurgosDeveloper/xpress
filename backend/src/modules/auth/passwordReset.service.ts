import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { env } from "../../utils/env";
import { sendPushToAdmins } from "../notifications/notifications.service";

const PASSWORD_RESET_TOKEN_TTL_SECONDS = 15 * 60;

type PasswordResetTokenPayload = {
  sub: string;
  purpose: "PASSWORD_RESET";
  prr: string; // password reset request id
};

function signPasswordResetToken(payload: { userId: string; resetRequestId: string }) {
  const p: PasswordResetTokenPayload = {
    sub: payload.userId,
    purpose: "PASSWORD_RESET",
    prr: payload.resetRequestId,
  };

  return jwt.sign(p, env.JWT_SECRET, {
    expiresIn: PASSWORD_RESET_TOKEN_TTL_SECONDS,
  });
}

function verifyPasswordResetToken(token: string): { ok: true; payload: PasswordResetTokenPayload } | { ok: false; error: string } {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as PasswordResetTokenPayload;
    if (!decoded?.sub || decoded.purpose !== "PASSWORD_RESET" || !decoded.prr) {
      return { ok: false, error: "Invalid token" };
    }
    return { ok: true, payload: decoded };
  } catch {
    return { ok: false, error: "Invalid or expired token" };
  }
}

function generate6DigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function last3(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-3).padStart(3, "*");
}

async function findUserByIdentifier(identifier: string) {
  return prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
    include: {
      passenger: { select: { phone: true } },
      driver: { select: { phone: true } },
    },
  });
}

export async function requestPasswordReset(params: { user: string }) {
  const identifier = params.user.trim();
  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false as const, error: "User not found" };

  // Solo chofer y pasajero (como pediste)
  if (user.role !== UserRole.USER && user.role !== UserRole.DRIVER) {
    return { ok: false as const, error: "Password reset not available for this role" };
  }

  if (user.role === UserRole.DRIVER && !user.driver) {
    return { ok: false as const, error: "Driver profile missing" };
  }

  const phoneRaw = user.role === UserRole.USER ? user.passenger?.phone : user.driver?.phone;
  if (!phoneRaw) return { ok: false as const, error: "Phone not found" };

  const code = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const row = await prisma.passwordResetRequest.create({
    data: {
      userId: user.id,
      role: user.role,
      phoneRaw,
      phoneLast3: last3(phoneRaw),
      code,
      expiresAt,
    },
    select: { id: true, phoneLast3: true },
  });

  // Notifica a admins (si FCM está configurado)
  void sendPushToAdmins({
    title: "Recuperación de contraseña",
    body: `Solicitud: ${row.id}. Código: ${code}. Tel ***${row.phoneLast3}`,
    data: { type: "PASSWORD_RESET", resetRequestId: row.id, code },
  });

  return {
    ok: true as const,
    resetRequestId: row.id,
    phoneLast3: row.phoneLast3,
  };
}

export async function verifyPasswordReset(params: { resetRequestId: string; code: string }) {
  const row = await prisma.passwordResetRequest.findUnique({
    where: { id: params.resetRequestId },
  });
  if (!row) return { ok: false as const, error: "Request not found" };
  if (row.consumedAt) return { ok: false as const, error: "Request already used" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, error: "Code expired" };

  if (row.code !== params.code) return { ok: false as const, error: "Invalid code" };

  await prisma.passwordResetRequest.update({
    where: { id: row.id },
    data: { verifiedAt: new Date() },
  });

  const resetToken = signPasswordResetToken({ userId: row.userId, resetRequestId: row.id });
  return { ok: true as const, resetToken };
}

export async function confirmPasswordReset(params: { resetToken: string; newPassword: string }) {
  const verified = verifyPasswordResetToken(params.resetToken);
  if (!verified.ok) return { ok: false as const, error: verified.error };

  const row = await prisma.passwordResetRequest.findUnique({ where: { id: verified.payload.prr } });
  if (!row) return { ok: false as const, error: "Request not found" };
  if (row.consumedAt) return { ok: false as const, error: "Request already used" };
  if (!row.verifiedAt) return { ok: false as const, error: "Request not verified" };
  if (row.userId !== verified.payload.sub) return { ok: false as const, error: "Forbidden" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, error: "Code expired" };

  const passwordHash = await bcrypt.hash(params.newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetRequest.update({ where: { id: row.id }, data: { consumedAt: new Date() } }),
  ]);

  return { ok: true as const };
}
