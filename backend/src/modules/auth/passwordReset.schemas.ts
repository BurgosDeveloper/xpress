import { z } from "zod";

export const PasswordResetRequestSchema = z.object({
  user: z.string().min(1),
});

export const PasswordResetVerifySchema = z.object({
  resetRequestId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export const PasswordResetConfirmSchema = z.object({
  resetToken: z.string().min(1),
  newPassword: z.string().min(8),
});
