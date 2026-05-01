import { Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { getApiBaseUrl } from "../lib/apiBase";
import {
  clearDriverBackgroundLocationLastSentAt,
  getDriverBackgroundLocationLastSentAt,
  getToken,
  setDriverBackgroundLocationLastSentAt,
} from "../lib/storage";
import { setLastCoords } from "../lib/locationCache";

export const DRIVER_BACKGROUND_LOCATION_TASK = "DRIVER_BACKGROUND_LOCATION_TASK";

const DRIVER_BACKGROUND_LOCATION_MIN_INTERVAL_MS = 5000;

type LocationLike = {
  coords?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number | null;
  };
  timestamp?: number;
};

function getLatestLocation(data: unknown): LocationLike | null {
  if (!data || typeof data !== "object") return null;
  const locations = (data as { locations?: unknown }).locations;
  if (!Array.isArray(locations) || locations.length === 0) return null;
  const last = locations[locations.length - 1];
  if (!last || typeof last !== "object") return null;
  return last as LocationLike;
}

async function shouldSkipByThrottle(timestamp: number) {
  const lastSentAtRaw = await getDriverBackgroundLocationLastSentAt();
  const lastSentAt = Number(lastSentAtRaw ?? 0);
  if (Number.isFinite(lastSentAt) && lastSentAt > 0 && timestamp - lastSentAt < DRIVER_BACKGROUND_LOCATION_MIN_INTERVAL_MS) {
    return true;
  }

  await setDriverBackgroundLocationLastSentAt(String(timestamp));
  return false;
}

async function sendBackgroundDriverLocation(input: { lat: number; lng: number }) {
  const token = await getToken();
  if (!token) return;

  await fetch(`${getApiBaseUrl()}/driver/me/location`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

TaskManager.defineTask(DRIVER_BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  const location = getLatestLocation(data);
  const lat = Number(location?.coords?.latitude);
  const lng = Number(location?.coords?.longitude);
  const accuracy = Number(location?.coords?.accuracy ?? 0);
  const timestamp = Number(location?.timestamp ?? Date.now());

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (Number.isFinite(accuracy) && accuracy > 80) return;
  if (await shouldSkipByThrottle(timestamp)) return;

  await setLastCoords({ lat, lng });

  try {
    await sendBackgroundDriverLocation({ lat, lng });
  } catch {
    // best-effort: iOS puede batch-ear o cortar red temporalmente en background.
  }
});

export async function startIOSDriverBackgroundLocation() {
  if (Platform.OS !== "ios") return false;

  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    foreground = await Location.requestForegroundPermissionsAsync();
  }
  if (foreground.status !== "granted") return false;

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    background = await Location.requestBackgroundPermissionsAsync();
  }
  if (background.status !== "granted") return false;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) return true;

  await clearDriverBackgroundLocationLastSentAt();

  await Location.startLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5000,
    distanceInterval: 5,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
  });

  return true;
}

export async function stopIOSDriverBackgroundLocation() {
  if (Platform.OS !== "ios") return;

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
    }
  } finally {
    await clearDriverBackgroundLocationLastSentAt();
  }
}