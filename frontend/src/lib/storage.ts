import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "xpress_auth_token";
const ACTIVE_RIDE_OFFERS_RIDE_ID_KEY = "xpress_active_ride_offers_ride_id";
const ACTIVE_RIDE_DRIVER_ARRIVED_NOTIFIED_AT_KEY = "xpress_active_ride_driver_arrived_notified_at";
const ACTIVE_RIDE_OFFER_COMMITTED_RIDE_ID_KEY = "xpress_active_ride_offer_committed_ride_id";
const DRIVER_BG_LOCATION_LAST_SENT_AT_KEY = "xpress_driver_bg_location_last_sent_at";

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getActiveRideOffersRideId() {
  return SecureStore.getItemAsync(ACTIVE_RIDE_OFFERS_RIDE_ID_KEY);
}

export async function setActiveRideOffersRideId(rideId: string) {
  await SecureStore.setItemAsync(ACTIVE_RIDE_OFFERS_RIDE_ID_KEY, rideId);
}

export async function clearActiveRideOffersRideId() {
  await SecureStore.deleteItemAsync(ACTIVE_RIDE_OFFERS_RIDE_ID_KEY);
}

export async function getActiveRideDriverArrivedNotifiedAt() {
  return SecureStore.getItemAsync(ACTIVE_RIDE_DRIVER_ARRIVED_NOTIFIED_AT_KEY);
}

export async function setActiveRideDriverArrivedNotifiedAt(isoOrValue: string) {
  await SecureStore.setItemAsync(ACTIVE_RIDE_DRIVER_ARRIVED_NOTIFIED_AT_KEY, isoOrValue);
}

export async function clearActiveRideDriverArrivedNotifiedAt() {
  await SecureStore.deleteItemAsync(ACTIVE_RIDE_DRIVER_ARRIVED_NOTIFIED_AT_KEY);
}

export async function getActiveRideOfferCommittedRideId() {
  return SecureStore.getItemAsync(ACTIVE_RIDE_OFFER_COMMITTED_RIDE_ID_KEY);
}

export async function setActiveRideOfferCommittedRideId(rideId: string) {
  await SecureStore.setItemAsync(ACTIVE_RIDE_OFFER_COMMITTED_RIDE_ID_KEY, rideId);
}

export async function clearActiveRideOfferCommittedRideId() {
  await SecureStore.deleteItemAsync(ACTIVE_RIDE_OFFER_COMMITTED_RIDE_ID_KEY);
}

export async function getDriverBackgroundLocationLastSentAt() {
  return SecureStore.getItemAsync(DRIVER_BG_LOCATION_LAST_SENT_AT_KEY);
}

export async function setDriverBackgroundLocationLastSentAt(value: string) {
  await SecureStore.setItemAsync(DRIVER_BG_LOCATION_LAST_SENT_AT_KEY, value);
}

export async function clearDriverBackgroundLocationLastSentAt() {
  await SecureStore.deleteItemAsync(DRIVER_BG_LOCATION_LAST_SENT_AT_KEY);
}
