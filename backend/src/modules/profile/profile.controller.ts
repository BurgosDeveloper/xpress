import type { Request, Response } from "express";
import { UpdateDriverProfileSchema, UpdatePassengerProfileSchema } from "./profile.schemas";
import { deleteMyAccount, getMyProfile, updateMyDriverProfile, updateMyPassengerProfile } from "./profile.service";

export async function getMyProfileController(req: Request, res: Response) {
  const userId = req.user?.id;
  const role = req.user?.role;
  if (!userId || !role) return res.status(401).json({ message: "Unauthorized" });

  const result = await getMyProfile({ userId, role });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}

export async function updateMyProfileController(req: Request, res: Response) {
  const userId = req.user?.id;
  const role = req.user?.role;
  if (!userId || !role) return res.status(401).json({ message: "Unauthorized" });

  if (role === "USER") {
    const input = UpdatePassengerProfileSchema.parse(req.body);
    const result = await updateMyPassengerProfile({ userId, input });
    if (!result.ok) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result);
  }

  if (role === "DRIVER") {
    const input = UpdateDriverProfileSchema.parse(req.body);
    const result = await updateMyDriverProfile({ userId, input });
    if (!result.ok) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result);
  }

  return res.status(403).json({ message: "Admin profile not supported" });
}

export async function deleteMyAccountController(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const result = await deleteMyAccount({ userId });
  if (!result.ok) return res.status(result.status).json({ message: result.error });
  return res.status(200).json(result);
}
