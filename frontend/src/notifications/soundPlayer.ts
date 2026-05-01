import { Audio } from "expo-av";
import { Platform } from "react-native";
import type { SoundName } from "./channels";

const SOUND_ASSETS: Record<SoundName, any> = {
  tienes_servicio: require("../../assets/notifications/tienes_servicio.mp3"),
  aceptar_servicio: require("../../assets/notifications/aceptar_servicio.mp3"),
  uber_llego: require("../../assets/notifications/uber_llego.mp3"),
  disponibles: require("../../assets/notifications/disponibles.mp3"),
};

let audioModeReady = false;
let playChain: Promise<void> = Promise.resolve();

const loadedSounds: Partial<Record<SoundName, Audio.Sound>> = {};

async function ensureSoundLoaded(soundName: SoundName): Promise<Audio.Sound | null> {
  const existing = loadedSounds[soundName];
  if (existing) return existing;

  const source = SOUND_ASSETS[soundName];
  if (!source) return null;

  try {
    const { sound } = await Audio.Sound.createAsync(
      source,
      {
        shouldPlay: false,
        volume: 1.0,
        isLooping: false,
      },
      undefined,
      false
    );
    loadedSounds[soundName] = sound;
    return sound;
  } catch {
    return null;
  }
}

async function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // best-effort
  }
}

export function playNotificationSound(soundName: SoundName) {
  // Serializa para evitar solapamientos (varias notifs juntas).
  playChain = playChain.then(async () => {
    await ensureAudioMode();

    const sound = await ensureSoundLoaded(soundName);
    if (!sound) return;

    try {
      // `replayAsync` es más rápido que recrear el objeto en cada notificación.
      await sound.replayAsync();

      // En Android, si el sistema ya está reproduciendo el sonido de notificación,
      // a veces el audio focus puede limitar el volumen. Aun así, esto es best-effort.
      if (Platform.OS === "android") {
        // nada extra
      }
    } catch {
      // best-effort
    }
  });

  return playChain;
}

export async function preloadNotificationSounds() {
  await ensureAudioMode();
  await Promise.all([
    ensureSoundLoaded("tienes_servicio"),
    ensureSoundLoaded("aceptar_servicio"),
    ensureSoundLoaded("uber_llego"),
    ensureSoundLoaded("disponibles"),
  ]);
}
