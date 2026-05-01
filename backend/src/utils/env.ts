import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (val: unknown) => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const booleanStringToOptional = (val: unknown) => {
  if (val == null) return undefined;
  if (typeof val === "boolean") return val;
  if (typeof val !== "string") return val;

  const normalized = val.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return val;
};

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:19006"),
  JWT_SECRET: z.string().min(20),
  JWT_EXPIRES_IN: z.string().default("7d"),
  DATABASE_URL: z.string().min(1),

  // Opcional: URL directa para migraciones (Neon suele dar pooled + direct)
  DIRECT_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  WHATSAPP_DEFAULT_COUNTRY_CODE: z.string().regex(/^\d+$/).default("58"),

  // Prisma migrate dev (solo local)
  SHADOW_DATABASE_URL: z.string().min(1).optional(),

  // Uploads (Cloudinary). Si no se define, el backend cae a uploads locales.
  CLOUDINARY_CLOUD_NAME: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CLOUDINARY_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CLOUDINARY_API_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  CLOUDINARY_FOLDER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // Push notifications (FCM)
  FCM_SERVICE_ACCOUNT_PATH: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FCM_SERVICE_ACCOUNT_JSON: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  FCM_SERVICE_ACCOUNT_JSON_B64: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // Push notifications (APNs directo para iOS)
  APNS_AUTH_KEY_PATH: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  APNS_AUTH_KEY_P8: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  APNS_AUTH_KEY_P8_B64: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  APNS_KEY_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  APNS_TEAM_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  APNS_BUNDLE_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  APNS_USE_SANDBOX: z.preprocess(booleanStringToOptional, z.boolean().optional()).default(false),

  // Créditos chofer (descuento automático al completar)
  ENABLE_DRIVER_CREDIT_CHARGE: z
    .preprocess((v) => {
      if (v == null) return undefined;
      if (typeof v === "boolean") return v;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true") return true;
        if (s === "false") return false;
      }
      return v;
    }, z.boolean().optional())
    .default(false),

  // Ruteo (OSRM). Opcional: por defecto usa router.project-osrm.org
  OSRM_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),

  // Taxímetro / tarifa: cantidad de KM incluidos en el precio base
  METER_INCLUDED_KM: z.coerce.number().int().nonnegative().default(3),
});

export const env = EnvSchema.parse(process.env);
