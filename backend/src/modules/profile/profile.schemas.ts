import { z } from "zod";

export const UpdatePassengerProfileSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  phone: z.string().min(3).max(40).optional(),
  email: z.string().email().optional(),
});

export const UpdateDriverProfileSchema = z.object({
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  phone: z.string().min(3).max(40).optional(),
  mobilePayBank: z.string().min(1).max(120).optional().nullable(),
  mobilePayDocument: z.string().min(1).max(80).optional().nullable(),
  mobilePayPhone: z.string().min(1).max(40).optional().nullable(),
});
