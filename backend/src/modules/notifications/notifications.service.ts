import { PushPlatform } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { sendAPNsMulticast } from "../../integrations/apns";
import { getFCMOrNull } from "../../integrations/fcm";

let warnedFcmNotConfigured = false;
let warnedApnsNotConfigured = false;

function makeEventId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function inferEventId(params: {
  userId: string;
  data?: Record<string, string>;
}): string | null {
  const d = params.data ?? {};

  const explicit = typeof d.eventId === "string" ? d.eventId.trim() : "";
  if (explicit) return explicit;

  // Bursts: deben ser únicos por envío (no dedupe), usamos burstId si existe.
  const burstId = typeof d.burstId === "string" ? d.burstId.trim() : "";
  if (burstId) return `BURST:${burstId}`;

  const type = typeof d.type === "string" ? d.type.trim() : "";
  if (!type) return null;

  // Identificadores comunes para hacer el eventId determinístico.
  const rideId = typeof d.rideId === "string" ? d.rideId.trim() : "";
  const offerId = typeof d.offerId === "string" ? d.offerId.trim() : "";
  const driverId = typeof d.driverId === "string" ? d.driverId.trim() : "";

  const key = rideId || offerId || driverId || params.userId;
  return `${type}:${key}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePushToken(token: string, platform: "ANDROID" | "IOS") {
  const trimmed = token.trim();
  if (platform !== "IOS") return trimmed;
  return trimmed.replace(/[<>\s]/g, "");
}

export async function registerPushToken(params: {
  userId: string;
  token: string;
  platform: "ANDROID" | "IOS";
}) {
  const normalizedToken = normalizePushToken(params.token, params.platform);

  return prisma.pushToken.upsert({
    where: { token: normalizedToken },
    update: { userId: params.userId, platform: params.platform as PushPlatform },
    create: { userId: params.userId, token: normalizedToken, platform: params.platform as PushPlatform },
  });
}

export async function sendPushToUser(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  soundName?: string;
}) {
  const tokens = await prisma.pushToken.findMany({ where: { userId: params.userId } });
  if (tokens.length === 0) return { ok: true as const, sent: 0, failed: 0 };

  const soundName = params.soundName?.trim() ? params.soundName.trim() : undefined;
  const eventId = inferEventId({ userId: params.userId, data: params.data }) ?? makeEventId();

  function androidChannelIdForSound(soundName: string | undefined) {
    // Debe matchear los IDs creados en el frontend (notifications/incoming.ts)
    if (soundName && soundName.trim()) return `xpress_sound_${soundName.trim()}_v3`;
    return "xpress_silent_v3";
  }

  const baseData: Record<string, string> = {
    ...(params.data ?? {}),
    eventId,
    ...(soundName ? { soundName } : null),
  };

  const androidTokens = tokens
    .filter((t) => t.platform === "ANDROID")
    .map((t) => normalizePushToken(t.token, "ANDROID"))
    .filter(Boolean);
  const iosTokens = tokens
    .filter((t) => t.platform === "IOS")
    .map((t) => normalizePushToken(t.token, "IOS"))
    .filter(Boolean);

  let sent = 0;
  let failed = 0;

  // ANDROID: notification + channelId.
  // - Foreground: Expo Notifications handler evita sonido del sistema y la app reproduce el MP3.
  // - Background: Android muestra la notificación y reproduce el MP3 vía canal nativo.
  if (androidTokens.length > 0) {
    const messaging = getFCMOrNull();
    if (!messaging) {
      if (!warnedFcmNotConfigured) {
        warnedFcmNotConfigured = true;
        console.warn("[push] FCM no configurado. Revisar FCM_SERVICE_ACCOUNT_JSON/FCM_SERVICE_ACCOUNT_PATH");
      }
      failed += androidTokens.length;
    } else {
    const androidData: Record<string, string> = { ...baseData };

    const channelId = androidChannelIdForSound(soundName);

    const resAndroid = await messaging.sendEachForMulticast({
      tokens: androidTokens,
      notification: { title: params.title, body: params.body },
      data: androidData,
      android: {
        priority: "high",
        notification: {
          channelId,
        },
      },
    });

    sent += resAndroid.successCount;
    failed += resAndroid.failureCount;
    }
  }

  // IOS: enviamos directo a APNs usando el token nativo que expone expo-notifications.
  if (iosTokens.length > 0) {
    const resIos = await sendAPNsMulticast({
      tokens: iosTokens,
      title: params.title,
      body: params.body,
      data: baseData,
      soundName,
    });

    if (!resIos.configured && !warnedApnsNotConfigured) {
      warnedApnsNotConfigured = true;
      console.warn(
        "[push] APNs no configurado. Revisar APNS_AUTH_KEY_P8/APNS_AUTH_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID y APNS_BUNDLE_ID"
      );
    }

    sent += resIos.successCount;
    failed += resIos.failureCount;
  }

  if (sent === 0 && failed > 0) {
    return { ok: false as const, reason: "PUSH_NOT_CONFIGURED", sent, failed };
  }

  return { ok: true as const, sent, failed };
}

export function sendPushToUserBurst(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  soundName: string;
  times: number;
  intervalMs?: number;
}) {
  const times = Math.min(5, Math.max(1, Math.floor(params.times)));
  const intervalMs = Math.min(10_000, Math.max(250, Math.floor(params.intervalMs ?? 1500)));

  // Fire-and-forget: no bloquea la request.
  void (async () => {
    for (let i = 0; i < times; i++) {
      try {
        await sendPushToUser({
          userId: params.userId,
          title: params.title,
          body: params.body,
          soundName: params.soundName,
          data: {
            ...(params.data ?? {}),
            soundName: params.soundName,
            burstCount: String(times),
            burstIndex: String(i + 1),
            burstId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          },
        });
      } catch {
        // silencioso
      }

      if (i < times - 1) await sleep(intervalMs);
    }
  })();
}

export async function sendPushToAdmins(params: {
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const results = await Promise.all(admins.map((a) => sendPushToUser({ userId: a.id, ...params })));
  const sent = results.reduce((acc, r) => (r.ok ? acc + r.sent : acc), 0);
  const failed = results.reduce((acc, r) => (r.ok ? acc + r.failed : acc), 0);
  return { ok: true as const, sent, failed };
}
