import type { Request, Response } from "express";
import { RegisterPushTokenSchema } from "./notifications.schemas";
import { registerPushToken } from "./notifications.service";

export async function registerPushTokenController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const input = RegisterPushTokenSchema.parse(req.body);
  const row = await registerPushToken({ userId, token: input.token, platform: input.platform });
  return res.status(200).json({ ok: true, pushToken: row });
}
