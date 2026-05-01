import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { isSoundName, type SoundName } from "./channels";
import { playNotificationSound } from "./soundPlayer";

export const ANDROID_SILENT_CHANNEL_ID = "xpress_silent_v3";

const BRAND_NAME = "STAR TRASLADOS C.A";

export function androidSoundChannelId(soundName: SoundName) {
  return `xpress_sound_${soundName}_v3`;
}

const LOCAL_MARKER_KEY = "__xpress_local";
const RECENT_TTL_MS = 30_000;
const MAX_RECENT = 200;

const recentEventIds = new Map<string, number>();

function nowMs() {
  return Date.now();
}

function cleanRecent() {
  const now = nowMs();
  for (const [key, ts] of recentEventIds.entries()) {
    if (now - ts > RECENT_TTL_MS) recentEventIds.delete(key);
  }
  if (recentEventIds.size <= MAX_RECENT) return;
  // Evita crecimiento sin límite: elimina los más antiguos.
  const entries = Array.from(recentEventIds.entries()).sort((a, b) => a[1] - b[1]);
  const toDelete = Math.max(0, entries.length - MAX_RECENT);
  for (let i = 0; i < toDelete; i++) recentEventIds.delete(entries[i]![0]);
}

function shouldProcessEventId(eventId: string | null): boolean {
  if (!eventId) return true;
  cleanRecent();
  const seenAt = recentEventIds.get(eventId);
  if (seenAt != null && nowMs() - seenAt <= RECENT_TTL_MS) return false;
  recentEventIds.set(eventId, nowMs());
  return true;
}

export function isLocalXpressNotification(data: any): boolean {
  return data && typeof data === "object" && String((data as any)[LOCAL_MARKER_KEY] ?? "") === "1";
}

export function ensureLocalMarker(data: Record<string, any> | undefined): Record<string, any> {
  return { ...(data ?? {}), [LOCAL_MARKER_KEY]: "1" };
}

export async function ensureAndroidSilentChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_SILENT_CHANNEL_ID, {
      name: BRAND_NAME,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: null,
    });
  } catch {
    // best-effort
  }
}

export async function ensureAndroidSoundChannels() {
  if (Platform.OS !== "android") return;
  // Android usa el nombre del recurso en res/raw (sin extensión): R.raw.<soundFile>
  const items: Array<{ id: string; name: string; soundFile: string }> = [
    { id: androidSoundChannelId("disponibles"), name: `${BRAND_NAME}: disponibles`, soundFile: "disponibles" },
    { id: androidSoundChannelId("aceptar_servicio"), name: `${BRAND_NAME}: aceptar servicio`, soundFile: "aceptar_servicio" },
    { id: androidSoundChannelId("tienes_servicio"), name: `${BRAND_NAME}: tienes servicio`, soundFile: "tienes_servicio" },
    { id: androidSoundChannelId("uber_llego"), name: `${BRAND_NAME}: uber llegó`, soundFile: "uber_llego" },
  ];

  await Promise.all(
    items.map(async (c) => {
      try {
        await Notifications.setNotificationChannelAsync(c.id, {
          name: c.name,
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: c.soundFile,
        });
      } catch {
        // best-effort
      }
    })
  );
}

function extractFromData(data: any): {
  eventId: string | null;
  soundName: SoundName;
  title?: string;
  body?: string;
  data: Record<string, any>;
} | null {
  const d = (data ?? {}) as any;
  if (isLocalXpressNotification(d)) return null;

  const rawSoundName = typeof d.soundName === "string" ? d.soundName.trim() : "";
  if (!isSoundName(rawSoundName)) return null;

  const eventId = typeof d.eventId === "string" && d.eventId.trim() ? d.eventId.trim() : null;
  const title = typeof d.title === "string" && d.title.trim() ? d.title.trim() : undefined;
  const body = typeof d.message === "string" && d.message.trim() ? d.message.trim() : undefined;

  return { eventId, soundName: rawSoundName, title, body, data: d };
}

export async function presentSilentLocalNotification(params: {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) {
  if (Platform.OS !== "android") return;
  const title = params.title?.trim() ? params.title.trim() : undefined;
  const body = params.body?.trim() ? params.body.trim() : undefined;
  if (!title && !body) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: ensureLocalMarker(params.data),
      },
      // Nota: este SDK no tipa `content.android.channelId`, así que forzamos el canal vía trigger.
      // 1s es suficiente para que Android use el canal correcto (y se sienta "instantáneo").
      trigger: { seconds: 1, channelId: ANDROID_SILENT_CHANNEL_ID } as any,
    });
  } catch {
    // best-effort
  }
}

export async function presentSoundLocalNotification(params: {
  soundName: SoundName;
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) {
  if (Platform.OS !== "android") return;
  const title = params.title?.trim() ? params.title.trim() : undefined;
  const body = params.body?.trim() ? params.body.trim() : undefined;
  if (!title && !body) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: ensureLocalMarker({ ...(params.data ?? {}), soundName: params.soundName }),
      },
      trigger: { seconds: 1, channelId: androidSoundChannelId(params.soundName) } as any,
    });
  } catch {
    // best-effort
  }
}

export async function handleIncomingSoundEventFromTask(taskData: any) {
  // En Android, cuando llega como notificación del sistema en background,
  // el propio canal reproduce el MP3. Evitamos duplicar programando otra.
  const possibleNotification = taskData?.notification;
  if (possibleNotification?.request?.content) return;

  const extracted = extractFromData(taskData?.data);
  if (!extracted) return;
  if (!shouldProcessEventId(extracted.eventId)) return;

  // Background/minimizada: en Android el JS no puede garantizar audio in-app.
  // En su lugar, usamos un canal Android con MP3 nativo por evento.
  await presentSoundLocalNotification({
    soundName: extracted.soundName,
    title: extracted.title,
    body: extracted.body,
    data: extracted.data,
  });
}

export async function handleIncomingSoundEventFromNotification(notification: Notifications.Notification) {
  const content: any = notification?.request?.content ?? {};
  const trigger: any = notification?.request?.trigger ?? {};

  // En Android, cuando el push incluye `notification`, Expo puede dejar `content.data` vacío.
  // En ese caso, la data real viene en `trigger.remoteMessage.data`.
  const remoteData: any = trigger?.remoteMessage?.data ?? trigger?.data ?? null;

  const merged = {
    ...(remoteData && typeof remoteData === "object" ? remoteData : null),
    ...(content?.data && typeof content.data === "object" ? content.data : null),
    title: content?.title,
    message: content?.body,
  };

  const extracted = extractFromData(merged);
  if (!extracted) return;
  if (!shouldProcessEventId(extracted.eventId)) return;

  // Android: el SO reproduce el MP3 vía canal (también en foreground).
  // Evitamos duplicar el sonido en-app.
  if (Platform.OS === "android") return;

  // Si ya llegó como Notification (por iOS/otro), no reprogramamos otra notificación.
  await playNotificationSound(extracted.soundName);
}

// Fallback para eventos detectados por polling/realtime (sin depender de push):
// muestra notificación local silenciosa (Android) y reproduce el MP3.
// Usa el mismo dedupe por `eventId` para evitar doble notificación/sonido.
export async function notifyAndPlayInAppOnce(params: {
  eventId: string;
  soundName: SoundName;
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) {
  const eventId = params.eventId?.trim() ? params.eventId.trim() : "";
  if (!eventId) return;
  if (!shouldProcessEventId(eventId)) return;

  await presentSilentLocalNotification({
    title: params.title,
    body: params.body,
    data: { ...(params.data ?? {}), eventId, soundName: params.soundName },
  });

  await playNotificationSound(params.soundName);
}

// Fallback para eventos detectados por polling/realtime (sin depender de push):
// usa el mismo dedupe por `eventId` para evitar doble sonido.
export async function playInAppSoundOnce(params: { eventId: string; soundName: SoundName }) {
  const eventId = params.eventId?.trim() ? params.eventId.trim() : "";
  if (!eventId) return;
  if (!shouldProcessEventId(eventId)) return;
  await playNotificationSound(params.soundName);
}

export async function playInAppSoundBurstOnce(params: {
  eventId: string;
  soundName: SoundName;
  times: number;
  intervalMs: number;
}) {
  const eventId = params.eventId?.trim() ? params.eventId.trim() : "";
  if (!eventId) return;
  if (!shouldProcessEventId(eventId)) return;

  const total = Math.max(1, Math.min(5, Math.floor(params.times || 1)));
  const waitMs = Math.max(0, Math.floor(params.intervalMs || 0));

  for (let index = 0; index < total; index += 1) {
    if (index > 0 && waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    await playNotificationSound(params.soundName);
  }
}
