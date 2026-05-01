import { playInAppSoundBurstOnce, playInAppSoundOnce } from "./incoming";

function normalizeString(value: unknown) {
  return value != null ? String(value).trim() : "";
}

export async function handleRideChangedForegroundRealtime(params: {
  role: "USER" | "DRIVER";
  payload: any;
}) {
  const type = normalizeString(params.payload?.type);
  const rideId = normalizeString(params.payload?.rideId);
  const driverId = normalizeString(params.payload?.driverId);
  const offerId = normalizeString(params.payload?.offerId);
  const eventIdFromPayload = normalizeString(params.payload?.eventId);

  if (params.role === "DRIVER") {
    if (type === "RIDE_ASSIGNED" || type === "RIDE_MATCHED") {
      const eventId = eventIdFromPayload || `${type}:${rideId || "unknown"}`;
      await playInAppSoundBurstOnce({
        eventId,
        soundName: "tienes_servicio",
        times: 2,
        intervalMs: 1200,
      });
    }
    return;
  }

  if (type === "DRIVER_ARRIVED") {
    await playInAppSoundOnce({
      eventId: eventIdFromPayload || `${type}:${rideId || "unknown"}`,
      soundName: "uber_llego",
    });
    return;
  }

  if (
    type === "RIDE_OFFERED" ||
    type === "OFFER_COMMITTED" ||
    type === "RIDE_ASSIGNED" ||
    type === "RIDE_ACCEPTED"
  ) {
    await playInAppSoundOnce({
      eventId:
        eventIdFromPayload ||
        `${type}:${rideId || "unknown"}:${driverId || offerId || "default"}`,
      soundName: "aceptar_servicio",
    });
  }
}

export async function handleDriverNearbyForegroundRealtime(payload: any) {
  const type = normalizeString(payload?.type);
  if (type !== "RIDE_AVAILABLE" && type !== "OFFER_AVAILABLE") return;

  const rideId = normalizeString(payload?.rideId);
  const offerId = normalizeString(payload?.offerId);
  const eventId = normalizeString(payload?.eventId) || `${type}:${rideId || offerId || "unknown"}`;

  await playInAppSoundOnce({ eventId, soundName: "disponibles" });
}