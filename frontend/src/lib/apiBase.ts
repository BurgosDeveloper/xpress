const API_SUFFIX = "/api";

const DEFAULT_PROD_API_BASE_URL = "https://xpress-production-f0e7.up.railway.app/api";

function normalizeApiBaseUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.endsWith(API_SUFFIX) ? withProtocol : `${withProtocol}${API_SUFFIX}`;
}

function guessLanApiBaseUrl() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const maybe = require("expo-constants");
    const Constants = maybe?.default ?? maybe;
    const hostUri: unknown = Constants?.expoConfig?.hostUri;
    if (typeof hostUri === "string" && hostUri.length > 0) {
      const guessedHost = hostUri.split(":")[0];
      if (guessedHost) return `http://${guessedHost}:3001${API_SUFFIX}`;
    }
  } catch {
    // ignore
  }

  return null;
}

export function getApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) return normalizeApiBaseUrl(fromEnv);

  // Default: Railway (para que Expo Go local funcione sin levantar backend local)
  if (DEFAULT_PROD_API_BASE_URL) return normalizeApiBaseUrl(DEFAULT_PROD_API_BASE_URL);

  const guessed = guessLanApiBaseUrl();
  if (guessed) return guessed;

  return `http://localhost:3001${API_SUFFIX}`;
}

export function getServerOrigin() {
  const apiBase = getApiBaseUrl();
  if (apiBase.endsWith(API_SUFFIX)) return apiBase.slice(0, -API_SUFFIX.length);
  return apiBase;
}
