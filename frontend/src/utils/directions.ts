export type Coords = { lat: number; lng: number };
export type TimedCoords = Coords & { ts?: number; accuracy?: number | null };

type DrivingRoute = { distanceMeters: number; durationSeconds: number; path: { latitude: number; longitude: number }[] };

const DEFAULT_MAPBOX_TIMEOUT_MS = 8000;
const DEFAULT_OSRM_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 60_000;
const FAILURE_CACHE_TTL_MS = 8_000;
const CACHE_MAX = 250;
const BUILTIN_OSRM_BASE_URLS = ["https://router.project-osrm.org", "https://routing.openstreetmap.de/routed-car"];
const MAPBOX_DIRECTIONS_BASE_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
const MAPBOX_MATCHING_BASE_URL = "https://api.mapbox.com/matching/v5/mapbox/driving";

type CacheEntry<T> = { ts: number; value: T; ttlMs: number };

const routeCache = new Map<string, CacheEntry<DrivingRoute | null>>();
const distCache = new Map<string, CacheEntry<number | null>>();
const nearestCache = new Map<string, CacheEntry<Coords | null>>();
const traceDistCache = new Map<string, CacheEntry<number | null>>();

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > entry.ttlMs) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs = CACHE_TTL_MS) {
  if (map.size >= CACHE_MAX) {
    // simple: borra el primero insertado
    const firstKey = map.keys().next().value as string | undefined;
    if (firstKey) map.delete(firstKey);
  }
  map.set(key, { ts: Date.now(), value, ttlMs });
}

function keyFromPair(from: Coords, to: Coords): string {
  // Redondeo suave para evitar cache-miss por ruido de GPS
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return `${r(from.lat)},${r(from.lng)}|${r(to.lat)},${r(to.lng)}`;
}

function keyFromCoord(coord: Coords): string {
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return `${r(coord.lat)},${r(coord.lng)}`;
}

function keyFromTrace(points: TimedCoords[]): string {
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return points.map((point) => `${r(point.lat)},${r(point.lng)},${Math.round((point.ts ?? 0) / 1000)}`).join("|");
}

function haversineMeters(from: Coords, to: Coords) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}

function sameCoord(a: Coords, b: Coords) {
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return r(a.lat) === r(b.lat) && r(a.lng) === r(b.lng);
}

function withOriginalEndpoints(path: { latitude: number; longitude: number }[], from: Coords, to: Coords) {
  let nextPath = path.slice();

  if (!nextPath.length) return nextPath;
  if (!sameCoord({ lat: nextPath[0]!.latitude, lng: nextPath[0]!.longitude }, from)) {
    nextPath = [{ latitude: from.lat, longitude: from.lng }, ...nextPath];
  }
  if (!sameCoord({ lat: nextPath[nextPath.length - 1]!.latitude, lng: nextPath[nextPath.length - 1]!.longitude }, to)) {
    nextPath = [...nextPath, { latitude: to.lat, longitude: to.lng }];
  }

  return nextPath;
}

export function getTraceStraightDistanceMeters(points: Array<Coords | TimedCoords>): number {
  if (!Array.isArray(points) || points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    if (!prev || !next) continue;
    total += haversineMeters(prev, next);
  }

  return Math.round(total);
}

function sanitizeTracePoints(points: TimedCoords[]): TimedCoords[] {
  const out: TimedCoords[] = [];
  for (const point of points) {
    if (!point) continue;
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const prev = out[out.length - 1];
    if (prev && sameCoord(prev, point)) continue;
    out.push(point);
  }
  return out;
}

function buildMapMatchingTimestamps(points: TimedCoords[]): string | null {
  const secs = points.map((point) => Math.floor(Number(point.ts ?? 0) / 1000));
  if (secs.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  for (let i = 1; i < secs.length; i += 1) {
    if (secs[i] <= secs[i - 1]) return null;
  }
  return secs.join(";");
}

function buildMapMatchingRadiuses(points: TimedCoords[]): string {
  return points
    .map((point) => {
      const raw = typeof point.accuracy === "number" && Number.isFinite(point.accuracy) ? point.accuracy : 15;
      const clamped = Math.max(5, Math.min(50, Math.round(raw)));
      return String(clamped);
    })
    .join(";");
}

async function fetchMapboxMatchedTraceDistance(points: TimedCoords[]): Promise<number | null> {
  const token = mapboxAccessToken();
  if (!token) return null;

  const coords = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const params = new URLSearchParams({
    access_token: token,
    geometries: "geojson",
    overview: "full",
    tidy: "true",
    radiuses: buildMapMatchingRadiuses(points),
  });
  const timestamps = buildMapMatchingTimestamps(points);
  if (timestamps) params.set("timestamps", timestamps);

  const url = `${MAPBOX_MATCHING_BASE_URL}/${coords}.json?${params.toString()}`;
  const data: any = await fetchJsonWithTimeout(url, DEFAULT_MAPBOX_TIMEOUT_MS);
  if (!data || (data.code !== "Ok" && data.code !== "NoMatch" && data.code !== "NoSegment")) return null;

  const matchings = Array.isArray(data.matchings) ? data.matchings : [];
  let total = 0;
  for (const match of matchings) {
    const dist = match?.distance;
    if (typeof dist === "number" && Number.isFinite(dist) && dist > 0) total += dist;
  }

  return total > 0 ? Math.round(total) : null;
}

function mapboxAccessToken(): string | null {
  const raw = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;
  const token = typeof raw === "string" ? raw.trim() : "";
  return token || null;
}

function parseRoutePath(coords: unknown): { latitude: number; longitude: number }[] | null {
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const path = coords
    .map((pair) => {
      const lng = Array.isArray(pair) ? pair[0] : null;
      const lat = Array.isArray(pair) ? pair[1] : null;
      if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
      if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
      return { latitude: lat, longitude: lng };
    })
    .filter(Boolean) as { latitude: number; longitude: number }[];

  return path.length >= 2 ? path : null;
}

function parseWaypointLocation(value: unknown): Coords | null {
  const lng = Array.isArray(value) ? value[0] : null;
  const lat = Array.isArray(value) ? value[1] : null;
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseWaypointDistance(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

async function fetchMapboxDrivingRouteForPair(params: { from: Coords; to: Coords }): Promise<DrivingRoute | null> {
  const token = mapboxAccessToken();
  if (!token) return null;

  const coordinates = `${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}`;
  const url = `${MAPBOX_DIRECTIONS_BASE_URL}/${coordinates}?alternatives=false&steps=false&geometries=geojson&overview=full&radiuses=unlimited;unlimited&access_token=${encodeURIComponent(token)}`;

  const data: any = await fetchJsonWithTimeout(url, DEFAULT_MAPBOX_TIMEOUT_MS);
  const route = data?.routes?.[0];
  const dist = route?.distance;
  const dur = route?.duration;
  const path = parseRoutePath(route?.geometry?.coordinates);

  if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
  if (typeof dur !== "number" || !Number.isFinite(dur) || dur < 0) return null;
  if (!path) return null;

  const snappedFrom = parseWaypointLocation(data?.waypoints?.[0]?.location);
  const snappedTo = parseWaypointLocation(data?.waypoints?.[1]?.location);
  const connectorMeters =
    (snappedFrom ? parseWaypointDistance(data?.waypoints?.[0]?.distance) || haversineMeters(params.from, snappedFrom) : 0) +
    (snappedTo ? parseWaypointDistance(data?.waypoints?.[1]?.distance) || haversineMeters(params.to, snappedTo) : 0);

  return {
    distanceMeters: Math.round(dist) + connectorMeters,
    durationSeconds: Math.round(dur),
    path: withOriginalEndpoints(path, params.from, params.to),
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any | null> {
  const hasAbort = typeof (globalThis as any).AbortController !== "undefined";
  const controller = hasAbort ? new (globalThis as any).AbortController() : null;
  const id = setTimeout(() => {
    try {
      controller?.abort();
    } catch {
      // noop
    }
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller?.signal,
    } as any);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

function osrmBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_OSRM_BASE_URL;
  const base = (fromEnv && fromEnv.trim()) || "https://router.project-osrm.org";
  return base.replace(/\/$/, "");
}

function osrmBaseUrls(): string[] {
  return Array.from(new Set([osrmBaseUrl(), ...BUILTIN_OSRM_BASE_URLS].map((url) => url.replace(/\/$/, ""))));
}

async function fetchFirstJsonAgainstUrls(urls: string[], timeoutMs: number): Promise<any | null> {
  if (!urls.length) return null;

  return new Promise((resolve) => {
    let pending = urls.length;
    let done = false;

    for (const url of urls) {
      void fetchJsonWithTimeout(url, timeoutMs)
        .then((data) => {
          if (done || !data) return;
          done = true;
          resolve(data);
        })
        .finally(() => {
          pending -= 1;
          if (!done && pending <= 0) resolve(null);
        });
    }
  });
}

async function snapCoordToRoad(coord: Coords): Promise<Coords | null> {
  const cacheKey = keyFromCoord(coord);
  const cached = cacheGet(nearestCache, cacheKey);
  if (cached !== undefined) return cached;

  const urls = osrmBaseUrls().map((base) => `${base}/nearest/v1/driving/${coord.lng},${coord.lat}?number=1`);

  try {
    const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_OSRM_TIMEOUT_MS);
    const location = data?.waypoints?.[0]?.location;
    const lng = location?.[0];
    const lat = location?.[1];

    if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lng !== "number" || !Number.isFinite(lng)) {
      cacheSet(nearestCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const snapped = { lat, lng };
    cacheSet(nearestCache, cacheKey, snapped);
    return snapped;
  } catch {
    cacheSet(nearestCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
    return null;
  }
}

async function fetchDrivingRouteForPair(params: { from: Coords; to: Coords }): Promise<DrivingRoute | null> {
  const urls = osrmBaseUrls().map(
    (base) => `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=simplified&geometries=geojson&alternatives=false&steps=false`
  );

  const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_OSRM_TIMEOUT_MS);
  const route = data?.routes?.[0];
  const dist = route?.distance;
  const dur = route?.duration;
  const path = parseRoutePath(route?.geometry?.coordinates);

  if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
  if (typeof dur !== "number" || !Number.isFinite(dur) || dur < 0) return null;
  if (!path) return null;

  return {
    distanceMeters: Math.round(dist),
    durationSeconds: Math.round(dur),
    path,
  };
}

async function fetchDrivingRouteDistanceForPair(params: { from: Coords; to: Coords }): Promise<number | null> {
  const urls = osrmBaseUrls().map(
    (base) => `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=false&alternatives=false&steps=false`
  );

  const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_OSRM_TIMEOUT_MS);
  const dist = data?.routes?.[0]?.distance;
  if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
  return Math.round(dist);
}

export async function getDrivingRoute(params: { from: Coords; to: Coords }): Promise<DrivingRoute | null> {
  const cacheKey = keyFromPair(params.from, params.to);
  const cached = cacheGet(routeCache, cacheKey);
  if (cached !== undefined) {
    if (cached) cacheSet(distCache, cacheKey, cached.distanceMeters);
    return cached;
  }

  try {
    const mapboxRoute = await fetchMapboxDrivingRouteForPair(params);
    if (mapboxRoute) {
      cacheSet(routeCache, cacheKey, mapboxRoute);
      cacheSet(distCache, cacheKey, mapboxRoute.distanceMeters);
      return mapboxRoute;
    }

    const directRoute = await fetchDrivingRouteForPair(params);
    if (directRoute) {
      cacheSet(routeCache, cacheKey, directRoute);
      cacheSet(distCache, cacheKey, directRoute.distanceMeters);
      return directRoute;
    }

    const [snappedFrom, snappedTo] = await Promise.all([snapCoordToRoad(params.from), snapCoordToRoad(params.to)]);
    if (!snappedFrom || !snappedTo) {
      cacheSet(routeCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const snappedRoute = await fetchDrivingRouteForPair({ from: snappedFrom, to: snappedTo });
    if (!snappedRoute) {
      cacheSet(routeCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const connectorMeters = haversineMeters(params.from, snappedFrom) + haversineMeters(params.to, snappedTo);
    const value = {
      distanceMeters: snappedRoute.distanceMeters + connectorMeters,
      durationSeconds: snappedRoute.durationSeconds,
      path: withOriginalEndpoints(snappedRoute.path, params.from, params.to),
    };
    cacheSet(routeCache, cacheKey, value);
    cacheSet(distCache, cacheKey, value.distanceMeters);
    return value;
  } catch {
    cacheSet(routeCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
    return null;
  }
}

export async function getDrivingRouteDistanceMeters(params: { from: Coords; to: Coords }): Promise<number | null> {
  const cacheKey = keyFromPair(params.from, params.to);
  const cached = cacheGet(distCache, cacheKey);
  if (cached !== undefined) return cached;

  const cachedRoute = cacheGet(routeCache, cacheKey);
  if (cachedRoute) {
    cacheSet(distCache, cacheKey, cachedRoute.distanceMeters);
    return cachedRoute.distanceMeters;
  }

  try {
    const mapboxRoute = await fetchMapboxDrivingRouteForPair(params);
    if (mapboxRoute) {
      cacheSet(routeCache, cacheKey, mapboxRoute);
      cacheSet(distCache, cacheKey, mapboxRoute.distanceMeters);
      return mapboxRoute.distanceMeters;
    }

    const directDistance = await fetchDrivingRouteDistanceForPair(params);
    if (directDistance) {
      cacheSet(distCache, cacheKey, directDistance);
      return directDistance;
    }

    const [snappedFrom, snappedTo] = await Promise.all([snapCoordToRoad(params.from), snapCoordToRoad(params.to)]);
    if (!snappedFrom || !snappedTo) {
      cacheSet(distCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const snappedDistance = await fetchDrivingRouteDistanceForPair({ from: snappedFrom, to: snappedTo });
    if (!snappedDistance) {
      cacheSet(distCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const value = snappedDistance + haversineMeters(params.from, snappedFrom) + haversineMeters(params.to, snappedTo);
    cacheSet(distCache, cacheKey, value);
    return value;
  } catch {
    cacheSet(distCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
    return null;
  }
}

export async function getMatchedDrivingTraceDistanceMeters(points: TimedCoords[]): Promise<number | null> {
  const sanitized = sanitizeTracePoints(points).slice(-100);
  if (sanitized.length < 2) return 0;

  const cacheKey = keyFromTrace(sanitized);
  const cached = cacheGet(traceDistCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    const matched = await fetchMapboxMatchedTraceDistance(sanitized);
    if (matched != null && matched > 0) {
      cacheSet(traceDistCache, cacheKey, matched);
      return matched;
    }

    const direct = await getDrivingRouteDistanceMeters({ from: sanitized[0]!, to: sanitized[sanitized.length - 1]! });
    if (direct != null && direct > 0) {
      cacheSet(traceDistCache, cacheKey, direct);
      return direct;
    }

    const straight = getTraceStraightDistanceMeters(sanitized);
    cacheSet(traceDistCache, cacheKey, straight, FAILURE_CACHE_TTL_MS);
    return straight;
  } catch {
    const straight = getTraceStraightDistanceMeters(sanitized);
    cacheSet(traceDistCache, cacheKey, straight, FAILURE_CACHE_TTL_MS);
    return straight;
  }
}
