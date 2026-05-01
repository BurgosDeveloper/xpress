import { z } from "zod";

export const CreateDriverSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  fullName: z.string().min(2),
  phone: z.string().min(6),
  mobilePayBank: z.string().min(1).max(120),
  mobilePayDocument: z.string().min(1).max(80),
  mobilePayPhone: z.string().min(1).max(40),
  photoUrl: z.string().min(1),
  serviceType: z.enum(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"]),
  vehicle: z.object({
    brand: z.string().min(1),
    model: z.string().min(1),
    year: z.coerce.number().int().min(1980).max(2100),
    color: z.string().min(1),
    doors: z.coerce.number().int().min(1).max(10).optional(),
    hasAC: z.coerce.boolean().default(false),
    hasTrunk: z.coerce.boolean().default(false),
    allowsPets: z.coerce.boolean().default(false),
  }),
  documents: z.object({
    vehiclePhotoUrls: z.array(z.string().min(1)).min(1),
  }),
});

export const UpdateDriverStatusSchema = z.object({
  status: z.enum(["OBSERVATION", "APPROVED", "REJECTED"]),
});

export const UpsertPricingSchema = z.object({
  baseFare: z.coerce.number().nonnegative(),
  nightBaseFare: z.coerce.number().nonnegative().optional().default(0),
  nightStartHour: z.coerce.number().int().min(0).max(23).optional().default(20),
  nightEndHour: z.coerce.number().int().min(0).max(23).optional().default(23),
  perKm: z.coerce.number().nonnegative().optional().default(0),

  // Pricing por tramos (opcional: si stepMeters es 0, no aplica)
  includedMeters: z.coerce.number().int().nonnegative().optional().default(0),
  stepMeters: z.coerce.number().int().nonnegative().optional().default(0),
  stepPrice: z.coerce.number().nonnegative().optional().default(0),
  acSurcharge: z.coerce.number().nonnegative().default(0),
  trunkSurcharge: z.coerce.number().nonnegative().default(0),
  petsSurcharge: z.coerce.number().nonnegative().default(0),
});

export const AssignRideDriverSchema = z.object({
  driverId: z.string().min(1),
});

export const CreatePricingAddonSchema = z.object({
  serviceType: z.enum(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"]),
  name: z.string().min(1).max(80),
  amount: z.coerce.number().nonnegative(),
  isActive: z.coerce.boolean().default(true),
});

export const UpdatePricingAddonSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const AdjustDriverCreditsSchema = z.object({
  // Delta en COP (puede ser negativo para descuento manual)
  deltaCop: z.coerce.number().int().min(-1_000_000_000).max(1_000_000_000),
});

export const SetDriverActiveSchema = z.object({
  isActive: z.coerce.boolean(),
});

export const SetPassengerActiveSchema = z.object({
  isActive: z.coerce.boolean(),
});

export const UpdatePassengerSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  firstName: z.string().min(1).optional().nullable(),
  lastName: z.string().min(1).optional().nullable(),
  phone: z.string().min(6).optional(),
  photoUrl: z.string().min(1).optional().nullable(),
});

export const UpdateDriverSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
  mobilePayBank: z.string().min(1).max(120).optional().nullable(),
  mobilePayDocument: z.string().min(1).max(80).optional().nullable(),
  mobilePayPhone: z.string().min(1).max(40).optional().nullable(),
  photoUrl: z.string().min(1).optional(),
  serviceType: z.enum(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"]).optional(),
  creditChargeFixedCop: z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable(),
  vehicle: z
    .object({
      brand: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      plate: z.string().min(1).optional().nullable(),
      year: z.coerce.number().int().min(1980).max(2100).optional(),
      color: z.string().min(1).optional(),
      doors: z.coerce.number().int().min(1).max(10).optional().nullable(),
      hasAC: z.coerce.boolean().optional(),
      hasTrunk: z.coerce.boolean().optional(),
      allowsPets: z.coerce.boolean().optional(),
    })
    .optional(),
  documents: z
    .object({
      vehiclePhotoUrls: z.array(z.string().min(1)).min(1).optional(),
    })
    .optional(),
});

export const UpdateAppConfigSchema = z.object({
  // (Compat) Pricing global: si se envía, se replica a todos los serviceType.
  // En la app nueva, el pricing se edita por tipo vía /admin/pricing.
  pricingBaseFare: z.coerce.number().nonnegative().optional(),
  pricingPerKm: z.coerce.number().nonnegative().optional(),

  pricingIncludedMeters: z.coerce.number().int().nonnegative().optional(),
  pricingStepMeters: z.coerce.number().int().nonnegative().optional(),
  pricingStepPrice: z.coerce.number().nonnegative().optional(),

  // Débito chofer
  driverCreditChargePercent: z.coerce.number().min(0).max(100).optional().default(0),
  driverCreditChargeMode: z.enum(["SERVICE_VALUE", "FIXED_AMOUNT"]).optional().default("SERVICE_VALUE"),

  // Tasas para mostrar montos secundarios.
  // Interpretación: COP por 1 unidad.
  fxCopPerUsd: z.coerce.number().nonnegative().optional(),
  fxCopPerVes: z.coerce.number().nonnegative().optional(),

  matchingRadiusM: z.coerce.number().int().positive().max(20000).optional(),

  // WhatsApp operador (ZOE)
  zoeWhatsappPhone: z.string().max(40).optional().nullable(),

  // Métodos de pago (visible al cliente)
  paymentBancolombiaHolder: z.string().max(120).optional().nullable(),
  paymentBancolombiaDocument: z.string().max(80).optional().nullable(),
  paymentBancolombiaAccountType: z.string().max(40).optional().nullable(),
  paymentBancolombiaAccountNumber: z.string().max(60).optional().nullable(),

  paymentZelleHolder: z.string().max(120).optional().nullable(),
  paymentZelleEmail: z.string().max(120).optional().nullable(),
  paymentZellePhone: z.string().max(40).optional().nullable(),
});
