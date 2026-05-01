import * as SecureStore from "expo-secure-store";

const LAST_COORDS_KEY = "xpress_last_coords";

type LastCoordsRow = {
  lat: number;
  lng: number;
  t: number; // epoch ms
};

export async function getLastCoords(opts?: { maxAgeMs?: number }) {
  const raw = await SecureStore.getItemAsync(LAST_COORDS_KEY);
  if (!raw) return null;

  try {
    const row = JSON.parse(raw) as LastCoordsRow;
    if (typeof row?.lat !== "number" || typeof row?.lng !== "number" || typeof row?.t !== "number") return null;

    const maxAgeMs = opts?.maxAgeMs;
    if (typeof maxAgeMs === "number" && maxAgeMs > 0) {
      if (Date.now() - row.t > maxAgeMs) return null;
    }

    return { lat: row.lat, lng: row.lng };
  } catch {
    return null;
  }
}

export async function setLastCoords(coords: { lat: number; lng: number }) {
  const row: LastCoordsRow = { lat: coords.lat, lng: coords.lng, t: Date.now() };
  await SecureStore.setItemAsync(LAST_COORDS_KEY, JSON.stringify(row));
}

export async function clearLastCoords() {
  await SecureStore.deleteItemAsync(LAST_COORDS_KEY);
}
