function normalizeWhatsappDigits(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";

  // WhatsApp wa.me requiere: código de país + número, sin '+'.
  // Si llega con '+', lo dejamos en dígitos.
  if (trimmed.startsWith("+")) {
    return trimmed.replace(/\D/g, "");
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  // Heurística útil: VE suele venir como 0XXXXXXXXXX (11 dígitos). Lo normalizamos a 58XXXXXXXXXX.
  if (digits.length === 11 && digits.startsWith("0")) {
    return `58${digits.slice(1)}`;
  }

  return digits;
}

export function buildWhatsappLink(params: { phone: string; text: string }) {
  const digits = normalizeWhatsappDigits(params.phone);
  const encoded = encodeURIComponent(params.text);
  return `https://wa.me/${digits}?text=${encoded}`;
}
