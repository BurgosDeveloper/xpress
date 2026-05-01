import { env } from "../utils/env";

export function isCloudinaryEnabled() {
  return !!(
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET
  );
}

export function getCloudinaryConfig() {
  if (!isCloudinaryEnabled()) return null;

  return {
    cloud_name: env.CLOUDINARY_CLOUD_NAME!,
    api_key: env.CLOUDINARY_API_KEY!,
    api_secret: env.CLOUDINARY_API_SECRET!,
    folder: env.CLOUDINARY_FOLDER ?? "xpress",
  };
}
