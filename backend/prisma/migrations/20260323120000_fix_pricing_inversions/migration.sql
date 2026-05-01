-- Corrige configuraciones invertidas (error humano) donde MOTO quedó más caro que CARRO.
-- Sólo actúa si BOTH baseFare y perKm están invertidos.

-- Swap CARRO <-> MOTO
WITH carro AS (
  SELECT * FROM "PricingConfig" WHERE "serviceType" = 'CARRO'
),
moto AS (
  SELECT * FROM "PricingConfig" WHERE "serviceType" = 'MOTO'
),
should_swap AS (
  SELECT
    (SELECT "baseFare" FROM moto) > (SELECT "baseFare" FROM carro) AS swap_base,
    (SELECT "perKm" FROM moto) > (SELECT "perKm" FROM carro) AS swap_perkm
)
UPDATE "PricingConfig" pc
SET
  "baseFare" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "baseFare" FROM moto)
    WHEN 'MOTO' THEN (SELECT "baseFare" FROM carro)
    ELSE pc."baseFare"
  END,
  "nightBaseFare" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "nightBaseFare" FROM moto)
    WHEN 'MOTO' THEN (SELECT "nightBaseFare" FROM carro)
    ELSE pc."nightBaseFare"
  END,
  "nightStartHour" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "nightStartHour" FROM moto)
    WHEN 'MOTO' THEN (SELECT "nightStartHour" FROM carro)
    ELSE pc."nightStartHour"
  END,
  "perKm" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "perKm" FROM moto)
    WHEN 'MOTO' THEN (SELECT "perKm" FROM carro)
    ELSE pc."perKm"
  END,
  "includedMeters" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "includedMeters" FROM moto)
    WHEN 'MOTO' THEN (SELECT "includedMeters" FROM carro)
    ELSE pc."includedMeters"
  END,
  "stepMeters" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "stepMeters" FROM moto)
    WHEN 'MOTO' THEN (SELECT "stepMeters" FROM carro)
    ELSE pc."stepMeters"
  END,
  "stepPrice" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "stepPrice" FROM moto)
    WHEN 'MOTO' THEN (SELECT "stepPrice" FROM carro)
    ELSE pc."stepPrice"
  END,
  "acSurcharge" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "acSurcharge" FROM moto)
    WHEN 'MOTO' THEN (SELECT "acSurcharge" FROM carro)
    ELSE pc."acSurcharge"
  END,
  "trunkSurcharge" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "trunkSurcharge" FROM moto)
    WHEN 'MOTO' THEN (SELECT "trunkSurcharge" FROM carro)
    ELSE pc."trunkSurcharge"
  END,
  "petsSurcharge" = CASE pc."serviceType"
    WHEN 'CARRO' THEN (SELECT "petsSurcharge" FROM moto)
    WHEN 'MOTO' THEN (SELECT "petsSurcharge" FROM carro)
    ELSE pc."petsSurcharge"
  END
WHERE pc."serviceType" IN ('CARRO', 'MOTO')
  AND (SELECT swap_base FROM should_swap)
  AND (SELECT swap_perkm FROM should_swap);

-- Swap CARRO_CARGA <-> MOTO_CARGA (si aplica)
WITH carro AS (
  SELECT * FROM "PricingConfig" WHERE "serviceType" = 'CARRO_CARGA'
),
moto AS (
  SELECT * FROM "PricingConfig" WHERE "serviceType" = 'MOTO_CARGA'
),
should_swap AS (
  SELECT
    (SELECT "baseFare" FROM moto) > (SELECT "baseFare" FROM carro) AS swap_base,
    (SELECT "perKm" FROM moto) > (SELECT "perKm" FROM carro) AS swap_perkm
)
UPDATE "PricingConfig" pc
SET
  "baseFare" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "baseFare" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "baseFare" FROM carro)
    ELSE pc."baseFare"
  END,
  "nightBaseFare" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "nightBaseFare" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "nightBaseFare" FROM carro)
    ELSE pc."nightBaseFare"
  END,
  "nightStartHour" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "nightStartHour" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "nightStartHour" FROM carro)
    ELSE pc."nightStartHour"
  END,
  "perKm" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "perKm" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "perKm" FROM carro)
    ELSE pc."perKm"
  END,
  "includedMeters" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "includedMeters" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "includedMeters" FROM carro)
    ELSE pc."includedMeters"
  END,
  "stepMeters" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "stepMeters" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "stepMeters" FROM carro)
    ELSE pc."stepMeters"
  END,
  "stepPrice" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "stepPrice" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "stepPrice" FROM carro)
    ELSE pc."stepPrice"
  END,
  "acSurcharge" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "acSurcharge" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "acSurcharge" FROM carro)
    ELSE pc."acSurcharge"
  END,
  "trunkSurcharge" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "trunkSurcharge" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "trunkSurcharge" FROM carro)
    ELSE pc."trunkSurcharge"
  END,
  "petsSurcharge" = CASE pc."serviceType"
    WHEN 'CARRO_CARGA' THEN (SELECT "petsSurcharge" FROM moto)
    WHEN 'MOTO_CARGA' THEN (SELECT "petsSurcharge" FROM carro)
    ELSE pc."petsSurcharge"
  END
WHERE pc."serviceType" IN ('CARRO_CARGA', 'MOTO_CARGA')
  AND (SELECT swap_base FROM should_swap)
  AND (SELECT swap_perkm FROM should_swap);
