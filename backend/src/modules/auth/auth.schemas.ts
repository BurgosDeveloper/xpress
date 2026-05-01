import { z } from "zod";

export const RegisterPassengerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().min(6),
  photoUrl: z.string().url().optional(),
});

export const LoginSchema = z.object({
  user: z.string().min(1),
  password: z.string().min(1),
});
