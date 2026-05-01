import { Alert, Linking, Platform } from "react-native";

function normalizePhoneForTel(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  const hasPlus = s.startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";

  // `tel:` soporta '+' en muchos dispositivos; si el número no lo trae, no lo inventamos.
  return hasPlus ? `+${digits}` : digits;
}

export function buildTelUrl(phoneRaw: string): string | null {
  const normalized = normalizePhoneForTel(phoneRaw);
  if (!normalized) return null;
  return `tel:${normalized}`;
}

export async function openDialer(phoneRaw: string) {
  const normalized = normalizePhoneForTel(phoneRaw);
  if (!normalized) {
    Alert.alert("No disponible", "Número de teléfono inválido.");
    return { ok: false as const };
  }

  const primary = `tel:${normalized}`;

  try {
    await Linking.openURL(primary);
    return { ok: true as const };
  } catch {
    // Fallback iOS: algunos dispositivos prefieren telprompt
  }

  if (Platform.OS === "ios") {
    try {
      await Linking.openURL(`telprompt:${normalized}`);
      return { ok: true as const };
    } catch {
      // fallthrough
    }
  }

  Alert.alert("No disponible", "No se pudo abrir la app de teléfono en este dispositivo.");
  return { ok: false as const };
}
