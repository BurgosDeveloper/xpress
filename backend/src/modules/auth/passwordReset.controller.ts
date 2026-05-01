import type { Request, Response } from "express";
import {
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  PasswordResetVerifySchema,
} from "./passwordReset.schemas";
import { confirmPasswordReset, requestPasswordReset, verifyPasswordReset } from "./passwordReset.service";

export async function passwordResetRequestController(req: Request, res: Response) {
  const input = PasswordResetRequestSchema.parse(req.body);
  const result = await requestPasswordReset({ user: input.user });
  if (!result.ok) return res.status(400).json({ message: result.error });
  return res.status(200).json(result);
}

export async function passwordResetVerifyController(req: Request, res: Response) {
  const input = PasswordResetVerifySchema.parse(req.body);
  const result = await verifyPasswordReset({ resetRequestId: input.resetRequestId, code: input.code });
  if (!result.ok) return res.status(400).json({ message: result.error });
  return res.status(200).json(result);
}

export async function passwordResetConfirmController(req: Request, res: Response) {
  const input = PasswordResetConfirmSchema.parse(req.body);
  const result = await confirmPasswordReset({ resetToken: input.resetToken, newPassword: input.newPassword });
  if (!result.ok) return res.status(400).json({ message: result.error });
  return res.status(200).json(result);
}
