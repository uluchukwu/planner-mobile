import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Switch } from "react-native";
import { fetchSettings, saveSettings, logout, getCachedAt, ApiError, SettingsResponse, Weekday, ThemePreference } from "../api";
import { clearToken } from "../tokenStorage";
import { CacheBanner } from "../components/CacheBanner";

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "MONDAY", label: "Mon" },
  { value: "TUESDAY", label: "Tue" },
  { value: "WEDNESDAY", label: "Wed" },
  { value: "THURSDAY", label: "Thu" },
  { value: "FRIDAY", label: "Fri" },
  { value: "SATURDAY", label: "Sat" },
  { value: "SUNDAY", label: "Sun" },
];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "SYSTEM", label: "System" },
  { value: "LIGHT", label: "Light" },
  { value: "DARK", label: "Dark" },
];

export function SettingsScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchSettings();
      setData(result);
      setCachedAt(getCachedAt(result));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load settings.");
    }
  }, [onLoggedOut]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const { email, ...fields } = data;
      void email;
      await saveSettings(fields);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await logout();
    await clearToken();
    onLoggedOut();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load().finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>{data.email}</Text>
      {cachedAt !== null && <CacheBanner savedAt={cachedAt} />}

      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput style={styles.input} value={data.name} onChangeText={(name) => setData((prev) => (prev ? { ...prev, name } : prev))} />

      <Text style={styles.fieldLabel}>Week starts on</Text>
      <View style={styles.chipRow}>
        {WEEKDAYS.map((d) => (
          <Pressable
            key={d.value}
            style={[styles.chip, data.weekStartsOn === d.value && styles.chipActive]}
            onPress={() => setData((prev) => (prev ? { ...prev, weekStartsOn: d.value } : prev))}
          >
            <Text style={[styles.chipText, data.weekStartsOn === d.value && styles.chipTextActive]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Theme</Text>
      <View style={styles.chipRow}>
        {THEMES.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.chip, data.theme === t.value && styles.chipActive]}
            onPress={() => setData((prev) => (prev ? { ...prev, theme: t.value } : prev))}
          >
            <Text style={[styles.chipText, data.theme === t.value && styles.chipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.hourRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Working hours start</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(data.defaultWorkStartHour)}
            onChangeText={(v) => setData((prev) => (prev ? { ...prev, defaultWorkStartHour: Number(v) || 0 } : prev))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Working hours end</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(data.defaultWorkEndHour)}
            onChangeText={(v) => setData((prev) => (prev ? { ...prev, defaultWorkEndHour: Number(v) || 0 } : prev))}
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Currency (ISO code)</Text>
      <TextInput
        style={styles.input}
        maxLength={3}
        autoCapitalize="characters"
        value={data.currency}
        onChangeText={(v) => setData((prev) => (prev ? { ...prev, currency: v.toUpperCase() } : prev))}
      />

      <View style={styles.switchRow}>
        <Text style={styles.fieldLabel}>Enable notifications</Text>
        <Switch
          value={data.notificationsEnabled}
          onValueChange={(v) => setData((prev) => (prev ? { ...prev, notificationsEnabled: v } : prev))}
        />
      </View>

      {saveError && <Text style={styles.error}>{saveError}</Text>}
      <View style={styles.saveRow}>
        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save changes"}</Text>
        </Pressable>
        {saved && !saving && <Text style={styles.savedText}>Saved</Text>}
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  title: { fontSize: 20, fontWeight: "700", color: "#111111" },
  subtitle: { fontSize: 13, color: "#888888", marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#111111", marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, backgroundColor: "#ffffff", paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#ffffff" },
  chipActive: { backgroundColor: "#3f6b4f", borderColor: "#3f6b4f" },
  chipText: { fontSize: 12, color: "#555555" },
  chipTextActive: { color: "#ffffff", fontWeight: "600" },
  hourRow: { flexDirection: "row", gap: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 },
  saveButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  saveButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
  savedText: { color: "#3f6b4f", fontSize: 12, fontWeight: "600" },
  signOutButton: { marginTop: 24, alignSelf: "flex-start" },
  signOutText: { fontSize: 13, color: "#888888" },
  error: { color: "#b3261e", fontSize: 13, marginTop: 12 },
  retryButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
