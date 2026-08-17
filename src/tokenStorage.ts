import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { clearCache } from "./cache";

// expo-secure-store has no web implementation (native iOS/Android/tvOS only, per its
// own docs) — expo start --web is the only target this environment can actually run
// and verify (no Android SDK/emulator available here), so this branch is what every
// test in this project actually exercises. The native SecureStore path is correct per
// Expo's docs but was not run on a device or emulator in this environment.
const KEY = "planner_session_token";

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.removeItem(KEY);
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
  // Every sign-out path (explicit and 401-triggered) goes through here — the one
  // choke point to purge cached responses so a signed-out session can't read back
  // the previous user's stale data after someone else logs in on the same device.
  await clearCache();
}
