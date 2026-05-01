import * as SecureStore from "expo-secure-store";

const pwKey = (userId: string) => `xpress_saved_password:${userId}`;

export async function setSavedPasswordForUser(params: { userId: string; password: string }) {
  await SecureStore.setItemAsync(pwKey(params.userId), params.password);
}

export async function getSavedPasswordForUser(userId: string) {
  return SecureStore.getItemAsync(pwKey(userId));
}

export async function clearSavedPasswordForUser(userId: string) {
  await SecureStore.deleteItemAsync(pwKey(userId));
}
