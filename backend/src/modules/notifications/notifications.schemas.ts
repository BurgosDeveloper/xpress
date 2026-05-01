import { z } from "zod";

export const RegisterPushTokenSchema = z.object({
  token: z.string().min(20),
  platform: z.enum(["ANDROID", "IOS"]),
});
