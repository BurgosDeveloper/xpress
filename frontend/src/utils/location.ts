import * as Location from "expo-location";
import { getLastCoords, setLastCoords } from "../lib/locationCache";

export type Coords = { lat: number; lng: number };

export async function ensureForegroundPermission() {
  let perms = await Location.getForegroundPermissionsAsync();
  if (perms.status !== "granted") {
    perms = await Location.requestForegroundPermissionsAsync();
  }
  return perms.status === "granted";
}

export async function readCachedCoords() {
  // Preferimos un fallback “real” (última ubicación guardada) antes que caer en un centro fijo.
  // 30 días reduce el caso "arranca en otro país" si el usuario ya usó la app antes.
  return getLastCoords({ maxAgeMs: 30 * 24 * 60 * 60 * 1000 });
}

export async function getLastKnownCoords(): Promise<Coords | null> {
  const last = await Location.getLastKnownPositionAsync();
  if (!last?.coords) return null;
  return { lat: last.coords.latitude, lng: last.coords.longitude };
}

export async function getCurrentCoords(): Promise<Coords> {
  const timeoutMs = 8000;
  const pos = (await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        clearTimeout(t);
        reject(new Error("No se pudo obtener tu ubicación a tiempo. Probá de nuevo."));
      }, timeoutMs);
    }),
  ])) as Location.LocationObject;

  const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  await setLastCoords(coords);
  return coords;
}

// Mejor esfuerzo: devuelve lo más rápido posible (cache/lastKnown) y actualiza cache.
export async function getFastCoords(): Promise<Coords | null> {
  const cached = await readCachedCoords();
  if (cached) return cached;

  const last = await getLastKnownCoords();
  if (last) {
    await setLastCoords(last);
    return last;
  }

  return null;
}

// Secuencia típica para UX rápida: lastKnown inmediato, luego current.
export async function preloadCoords(): Promise<{ fast?: Coords; current?: Coords } | null> {
  const ok = await ensureForegroundPermission();
  if (!ok) return null;

  const out: { fast?: Coords; current?: Coords } = {};

  try {
    const fast = (await getLastKnownCoords()) ?? (await readCachedCoords());
    if (fast) {
      out.fast = fast;
      await setLastCoords(fast);
    }
  } catch {
    // ignore
  }

  try {
    const current = await getCurrentCoords();
    out.current = current;
    await setLastCoords(current);
  } catch {
    // ignore
  }

  return out;
}
