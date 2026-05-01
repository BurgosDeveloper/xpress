export type SoundName = "tienes_servicio" | "aceptar_servicio" | "uber_llego" | "disponibles";

export const SOUND_NAMES: readonly SoundName[] = [
  "tienes_servicio",
  "aceptar_servicio",
  "uber_llego",
  "disponibles",
] as const;

export function isSoundName(value: unknown): value is SoundName {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return (SOUND_NAMES as readonly string[]).includes(v);
}
