import type { Request, Response } from "express";
import { LoginSchema, RegisterPassengerSchema } from "./auth.schemas";
import { getMe, loginUser, registerPassenger } from "./auth.service";

export async function registerPassengerController(req: Request, res: Response) {
  const input = RegisterPassengerSchema.parse(req.body);
  const result = await registerPassenger(input);

  if (!result.ok) {
    return res.status(409).json({ message: result.error });
  }

  return res.status(201).json(result);
}

export async function loginController(req: Request, res: Response) {
  const input = LoginSchema.parse(req.body);
  const result = await loginUser(input);

  if (!result.ok) {
    return res.status(401).json({ message: result.error });
  }

  return res.status(200).json(result);
}

export async function meController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const me = await getMe(userId);
  if (!me) return res.status(404).json({ message: "User not found" });

  return res.status(200).json({ ok: true, user: me });
}
