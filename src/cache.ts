import AsyncStorage from "@react-native-async-storage/async-storage";

// Read-only cache: the last successful GET response per path, served back when a
// fetch fails outright (no connection), never as a substitute for a real HTTP error
// (a 401 must still sign the user out, not serve stale data — see api.ts's request()).
// No write queue — mutations made offline are not buffered or replayed.
const PREFIX = "cache:";

type CacheEntry<T> = { data: T; savedAt: number };

// Timestamps for cache-served responses, keyed by object identity rather than stored
// on the response itself — the shape mobile screens fetch varies between plain objects
// (WeekResponse) and arrays (HabitRow[]), and a WeakMap works for both without
// polluting either shape with an extra field every consumer would need to know about.
const cachedAtByResponse = new WeakMap<object, number>();

export function markAsCached<T>(data: T, savedAt: number): T {
  if (data && typeof data === "object") {
    cachedAtByResponse.set(data as object, savedAt);
  }
  return data;
}

export function getCachedAt(data: unknown): number | null {
  if (data && typeof data === "object") {
    return cachedAtByResponse.get(data as object) ?? null;
  }
  return null;
}

export async function saveToCache<T>(path: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, savedAt: Date.now() };
    await AsyncStorage.setItem(PREFIX + path, JSON.stringify(entry));
  } catch {
    // Best-effort — a full or unavailable disk shouldn't break the live request path.
  }
}

export async function loadFromCache<T>(path: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + path);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(PREFIX));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // Best-effort — a device signing out with a broken disk shouldn't crash on it.
  }
}
