import { env } from "./env";

function digitsOnly(input: string) {
  return input.replace(/\D/g, "");
}

export function toWhatsappE164OrNull(phoneRaw: string) {
  const trimmed = phoneRaw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = digitsOnly(trimmed);
    return digits.length >= 8 ? `+${digits}` : null;
  }

  const digits = digitsOnly(trimmed);
  if (digits.length < 8) return null;

  const cc = env.WHATSAPP_DEFAULT_COUNTRY_CODE;

  // Si ya viene con código de país sin '+', no duplicar
  if (digits.startsWith(cc)) {
    return `+${digits}`;
  }

  // Caso común VE: 0XXXXXXXXXX -> +58XXXXXXXXXX
  const normalizedLocal = digits.replace(/^0+/, "");
  if (normalizedLocal.length < 8) return null;
  return `+${cc}${normalizedLocal}`;
}

export function buildWhatsappLink(params: { phoneRaw: string; text?: string }) {
  const e164 = toWhatsappE164OrNull(params.phoneRaw);
  if (!e164) return null;
  const phone = e164.replace(/^\+/, "");
  const text = params.text ? encodeURIComponent(params.text) : undefined;
  return text ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/${phone}`;
}
