import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { signAccessToken } from "../../utils/jwt";
import { prisma } from "../../db/prisma";

export async function registerPassenger(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  photoUrl?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return { ok: false as const, error: "Email already in use" };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: UserRole.USER,
      passenger: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
          photoUrl: input.photoUrl,
        },
      },
    },
    include: { passenger: true },
  });

  const token = signAccessToken({ sub: user.id, role: user.role });
  return {
    ok: true as const,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      passenger: user.passenger,
    },
    token,
  };
}
export async function loginUser(input: { user: string; password: string }) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.user }, { username: input.user }],
    },
    include: { passenger: true, driver: { include: { vehicle: true, documents: true } } },
  });
  if (!user) {
    return { ok: false as const, error: "Invalid credentials" };
  }

  if (!user.isActive) {
    return { ok: false as const, error: "User disabled" };
  }

  if (user.role === UserRole.DRIVER) {
    if (!user.driver) {
      return { ok: false as const, error: "Driver profile missing" };
    }
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    return { ok: false as const, error: "Invalid credentials" };
  }

  const token = signAccessToken({ sub: user.id, role: user.role });
  return {
    ok: true as const,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      passenger: user.passenger,
      driver: user.driver,
    },
    token,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { passenger: true, driver: { include: { vehicle: true, documents: true } } },
  });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    passenger: user.passenger,
    driver: user.driver,
  };
}
