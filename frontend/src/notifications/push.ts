import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { BACKGROUND_NOTIFICATION_TASK } from "./backgroundSoundTask";
import {
  ensureAndroidSilentChannel,
  handleIncomingSoundEventFromNotification,
  ANDROID_SILENT_CHANNEL_ID,
  ensureAndroidSoundChannels,
} from "./incoming";
import { SOUND_NAMES } from "./channels";
import { isSoundName } from "./channels";

const LOCAL_MARKER_KEY = "__xpress_local";

export function isIOSPushEnabled() {
  if (Platform.OS !== "ios") return true;
  return process.env.EXPO_PUBLIC_IOS_PUSH_ENABLED === "1";
}

function extractSoundNameForHandler(notification: Notifications.Notification): string {
  const content: any = notification?.request?.content ?? {};
  const trigger: any = notification?.request?.trigger ?? {};

  const remoteData: any = trigger?.remoteMessage?.data ?? trigger?.data ?? null;

  const merged = {
    ...(remoteData && typeof remoteData === "object" ? remoteData : null),
    ...(content?.data && typeof content.data === "object" ? content.data : null),
  } as any;

  const raw = typeof merged.soundName === "string" ? merged.soundName.trim() : "";
  return raw;
}

function isLocalForHandler(notification: Notifications.Notification): boolean {
  const content: any = notification?.request?.content ?? {};
  const d: any = content?.data ?? {};
  return d && typeof d === "object" && String(d[LOCAL_MARKER_KEY] ?? "") === "1";
}

let handlerInstalled = false;
let inAppSoundInstalled = false;
let backgroundTaskRegistered = false;

function isExpoGo() {
  const executionEnvironment = (Constants as any)?.executionEnvironment;
  if (executionEnvironment != null) return executionEnvironment === "storeClient";

  // Fallback para versiones viejas de expo-constants.
  const appOwnership = (Constants as any)?.appOwnership;
  return appOwnership === "expo";
}

export function setupNotificationHandlerOnce() {
  if (handlerInstalled) return;
  handlerInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const local = isLocalForHandler(notification);
      const soundName = extractSoundNameForHandler(notification);
      const allowSystemSoundAndroid = Platform.OS === "android" && !local && isSoundName(soundName);

      return {
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        // ANDROID:
        // - Sólo dejamos sonido del sistema cuando viene soundName válido (nuestros 4 MP3).
        // - Notificaciones locales (polling/catch-up) siempre silenciosas para evitar "ding".
        // iOS: en foreground lo manejamos in-app.
        shouldPlaySound: allowSystemSoundAndroid,
        shouldSetBadge: false,
      };
    },
  });
}

export function setupInAppSoundOnce() {
  if (inAppSoundInstalled) return;
  inAppSoundInstalled = true;

  // Si llega una Notification (iOS / local / edge cases), podemos reproducir el MP3.
  // OJO: las notificaciones locales que generamos desde Task se marcan y se ignoran.
  Notifications.addNotificationReceivedListener((notification) => {
    void handleIncomingSoundEventFromNotification(notification);
  });
}

export async function registerBackgroundNotificationTaskOnce() {
  if (backgroundTaskRegistered) return;
  backgroundTaskRegistered = true;

  // Desde Expo SDK 53, Expo Go no soporta push remoto.
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  if (Platform.OS === "ios" && !isIOSPushEnabled()) return;
  if (isExpoGo()) return;

  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch {
    // Si TaskManager no está disponible en algún build, no rompemos la app.
  }
}

export async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;

  async function safeDeleteChannel(id: string) {
    try {
      await Notifications.deleteNotificationChannelAsync(id);
    } catch {
      // best-effort
    }
  }

  // Limpieza: evita que MIUI acumule categorías duplicadas.
  // Ahora usamos un canal silencioso (la app reproduce el MP3 por su cuenta).
  const legacyIds = [
    "tienes_servicio",
    "aceptar_servicio",
    "uber_llego",
    "disponibles",
    "tienes_servicio_v2",
    "aceptar_servicio_v2",
    "uber_llego_v2",
    "disponibles_v2",
    "tienes_servicio_v3",
    "aceptar_servicio_v3",
    "uber_llego_v3",
    "disponibles_v3",
    "xpress_fallback_v1",
    "xpress_default_v1",
    // nuestros canales con prefijo (v1/v2) + silent v1
    "xpress_silent_v1",
    "xpress_silent_v2",
  ];

  const prefixedSoundV1 = SOUND_NAMES.map((s) => `xpress_sound_${s}_v1`);
  const prefixedSoundV2 = SOUND_NAMES.map((s) => `xpress_sound_${s}_v2`);

  await Promise.all([...legacyIds, ...prefixedSoundV1, ...prefixedSoundV2].map(safeDeleteChannel));

  await ensureAndroidSilentChannel();
  await ensureAndroidSoundChannels();

  // Compat: si por alguna razón otra parte agenda usando el id antiguo, lo migramos.
  try {
    // No-op: solo referencia para que TS no elimine el import.
    void ANDROID_SILENT_CHANNEL_ID;
  } catch {
    // ignore
  }
}

export async function getNativePushToken() {
  // Desde Expo SDK 53, Expo Go ya no soporta push remoto.
  // Para testear push, usar un development build (EAS dev client) o standalone.
  if (Platform.OS === "web" || isExpoGo()) return null;
  if (Platform.OS === "ios" && !isIOSPushEnabled()) return null;

  const settings = await Notifications.getPermissionsAsync();
  const granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const req =
      Platform.OS === "ios"
        ? await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowSound: true, allowBadge: false },
          })
        : await Notifications.requestPermissionsAsync();

    const ok = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!ok) return null;
  }

  const tokenRes = await Notifications.getDevicePushTokenAsync();
  const platform = Platform.OS === "ios" ? ("IOS" as const) : ("ANDROID" as const);

  return { token: tokenRes.data, platform };
}
