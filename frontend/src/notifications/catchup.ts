import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { SoundName } from "./channels";
import { playNotificationSound } from "./soundPlayer";
import { presentSilentLocalNotification } from "./incoming";
import { isIOSPushEnabled } from "./push";

export async function notifyCatchup(params: {
  title: string;
  body: string;
  soundName: SoundName;
  data?: Record<string, any>;
}) {
  try {
    const shouldNotify = params.soundName === "tienes_servicio" || params.soundName === "uber_llego";

    // Notificación silenciosa (Android) + sonido in-app.
    if (Platform.OS === "android") {
      if (shouldNotify) {
        await presentSilentLocalNotification({
          title: params.title,
          body: params.body,
          data: { ...(params.data ?? {}), soundName: params.soundName },
        });
      }
    } else if (isIOSPushEnabled()) {
      // iOS: sólo notificamos en casos 3 y 4; los demás son “en la app”.
      if (shouldNotify) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: params.title,
            body: params.body,
            data: { ...(params.data ?? {}), soundName: params.soundName },
          },
          trigger: null,
        });
      }
    }

    await playNotificationSound(params.soundName);
  } catch {
    // best-effort
  }
}
