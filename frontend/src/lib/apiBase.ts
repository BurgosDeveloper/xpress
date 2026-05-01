const API_SUFFIX = "/api";

const DEFAULT_PROD_API_BASE_URL = "https://xpress-production-c897.up.railway.app/api";

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
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  // Default: Railway (para que Expo Go local funcione sin levantar backend local)
  if (DEFAULT_PROD_API_BASE_URL) return DEFAULT_PROD_API_BASE_URL;

  const guessed = guessLanApiBaseUrl();
  if (guessed) return guessed;

  return `http://localhost:3001${API_SUFFIX}`;
}

export function getServerOrigin() {
  const apiBase = getApiBaseUrl();
  if (apiBase.endsWith(API_SUFFIX)) return apiBase.slice(0, -API_SUFFIX.length);
  return apiBase;
}
