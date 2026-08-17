import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { fetchHabits, createHabit, toggleHabitCompletion, setHabitArchived, deleteHabit, getCachedAt, ApiError, HabitRow } from "../api";
import { clearToken } from "../tokenStorage";
import { CacheBanner } from "../components/CacheBanner";

export function HabitsScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [habits, setHabits] = useState<HabitRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [newHabitName, setNewHabitName] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await fetchHabits();
      setHabits(result);
      setCachedAt(getCachedAt(result));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load habits.");
    }
  }, [onLoggedOut]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleAdd() {
    const name = newHabitName.trim();
    if (!name) return;
    setNewHabitName("");
    await createHabit(name).catch(() => {});
    await load();
  }

  async function handleToggleToday(habit: HabitRow) {
    setHabits((prev) => (prev ? prev.map((h) => (h.id === habit.id ? { ...h, completedToday: !h.completedToday } : h)) : prev));
    try {
      await toggleHabitCompletion(habit.id);
    } catch {
      await load();
    }
  }

  async function handleArchiveToggle(habit: HabitRow) {
    setHabits((prev) => (prev ? prev.map((h) => (h.id === habit.id ? { ...h, archived: !h.archived } : h)) : prev));
    await setHabitArchived(habit.id, !habit.archived).catch(() => load());
  }

  async function handleDelete(habitId: string) {
    setHabits((prev) => (prev ? prev.filter((h) => h.id !== habitId) : prev));
    await deleteHabit(habitId).catch(() => load());
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

  if (!habits) return null;
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <Text style={styles.title}>Habits</Text>
      {cachedAt !== null && <CacheBanner savedAt={cachedAt} />}

      {active.length === 0 ? (
        <Text style={styles.empty}>No habits yet. What&apos;s worth showing up for daily?</Text>
      ) : (
        active.map((h) => (
          <View key={h.id} style={styles.habitCard}>
            <Pressable style={[styles.checkbox, h.completedToday && styles.checkboxChecked]} onPress={() => handleToggleToday(h)} />
            <View style={{ flex: 1 }}>
              <Text style={styles.habitName}>{h.name}</Text>
              <Text style={styles.habitStats}>
                {h.currentStreak}d streak · {h.weekCompletions}/7 this week · {h.monthlyCompletionPct}% this month
              </Text>
            </View>
            <Pressable onPress={() => handleArchiveToggle(h)} hitSlop={8}>
              <Text style={styles.actionLink}>Archive</Text>
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.addRow}>
        <TextInput style={styles.addInput} placeholder="e.g. Drink water" value={newHabitName} onChangeText={setNewHabitName} onSubmitEditing={handleAdd} returnKeyType="done" />
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {archived.length > 0 && (
        <>
          <Text style={[styles.title, { fontSize: 15, marginTop: 24 }]}>Archived</Text>
          {archived.map((h) => (
            <View key={h.id} style={styles.archivedRow}>
              <Text style={styles.archivedName}>{h.name}</Text>
              <Pressable onPress={() => handleArchiveToggle(h)} hitSlop={8}>
                <Text style={styles.actionLink}>Restore</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(h.id)} hitSlop={8}>
                <Text style={styles.deleteLink}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  title: { fontSize: 20, fontWeight: "700", color: "#111111", marginBottom: 16 },
  habitCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 10, padding: 12, marginBottom: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#111111" },
  checkboxChecked: { backgroundColor: "#3f6b4f", borderColor: "#3f6b4f" },
  habitName: { fontSize: 15, fontWeight: "600", color: "#111111" },
  habitStats: { fontSize: 11, color: "#888888", marginTop: 2 },
  actionLink: { fontSize: 12, color: "#555555" },
  deleteLink: { fontSize: 12, color: "#b3261e" },
  addRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  addInput: { flex: 1, borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#ffffff", fontSize: 14 },
  addButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  addButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
  archivedRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e6e0d2" },
  archivedName: { flex: 1, fontSize: 13, color: "#888888" },
  empty: { color: "#888888", fontSize: 14, marginBottom: 8 },
  error: { color: "#b3261e", fontSize: 14, marginBottom: 12, textAlign: "center" },
  retryButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
