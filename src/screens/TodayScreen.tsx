import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { fetchDay, toggleTask, createTask, getCachedAt, ApiError, TodayResponse, TodayTask } from "../api";
import { clearToken } from "../tokenStorage";
import { addDays, todayKey } from "../dateUtils";
import { CacheBanner } from "../components/CacheBanner";

export function TodayScreen({ onLoggedOut, initialDate }: { onLoggedOut: () => void; initialDate?: string }) {
  const [date, setDate] = useState(initialDate ?? todayKey());
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const load = useCallback(async (forDate: string) => {
    try {
      const result = await fetchDay(forDate);
      setData(result);
      setCachedAt(getCachedAt(result));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load this day.");
    }
  }, [onLoggedOut]);

  useEffect(() => {
    setLoading(true);
    load(date).finally(() => setLoading(false));
  }, [date, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load(date);
    setRefreshing(false);
  }

  async function handleToggle(task: TodayTask) {
    // Optimistic: flip locally, then persist. Revert on failure — same pattern the web
    // app uses for its two-state toggles (see DayView.handleToggleStar).
    setData((prev) => (prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)) } : prev));
    try {
      await toggleTask(task.id);
    } catch {
      setData((prev) => (prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)) } : prev));
    }
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    setNewTaskTitle("");
    try {
      const task = await createTask(title, date);
      setData((prev) => (prev ? { ...prev, tasks: [...prev.tasks, task] } : prev));
    } catch {
      // Reload from the server rather than guess at the failure — quick-add has no
      // error banner of its own, matching the web app's QuickAddTask pattern.
      await load(date);
    }
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
        <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(date).finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{data.isToday ? "Today" : "Day"}</Text>
          <Text style={styles.dateLabel}>{data.dateLabel}</Text>
        </View>
        <Pressable onPress={async () => { await clearToken(); onLoggedOut(); }}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {cachedAt !== null && <CacheBanner savedAt={cachedAt} />}

      <View style={styles.dayNav}>
        <Pressable style={styles.navButton} onPress={() => setDate((d) => addDays(d, -1))}>
          <Text style={styles.navButtonText}>← Prev</Text>
        </Pressable>
        {!data.isToday && (
          <Pressable style={styles.navButton} onPress={() => setDate(todayKey())}>
            <Text style={styles.navButtonText}>Today</Text>
          </Pressable>
        )}
        <Pressable style={styles.navButton} onPress={() => setDate((d) => addDays(d, 1))}>
          <Text style={styles.navButtonText}>Next →</Text>
        </Pressable>
      </View>

      {data.challenge && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Today&apos;s challenge</Text>
          <Text style={styles.cardBody}>{data.challenge}</Text>
        </View>
      )}
      {data.objective && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Objective</Text>
          <Text style={styles.cardBody}>{data.objective}</Text>
        </View>
      )}

      <FlatList
        style={{ marginTop: 12 }}
        data={data.tasks}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Nothing planned for this day yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.taskRow} onPress={() => handleToggle(item)}>
            <View style={[styles.checkbox, item.completed && styles.checkboxChecked]} />
            <Text style={[styles.taskTitle, item.completed && styles.taskTitleDone]}>{item.title}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Add a task…"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              onSubmitEditing={handleAddTask}
              returnKeyType="done"
            />
            <Pressable style={styles.addButton} onPress={handleAddTask}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: "600", color: "#888888", textTransform: "uppercase" },
  dateLabel: { fontSize: 20, fontWeight: "700", color: "#111111" },
  signOut: { fontSize: 13, color: "#555555" },
  dayNav: { flexDirection: "row", gap: 8, marginBottom: 16 },
  navButton: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  navButtonText: { fontSize: 12, color: "#555555" },
  card: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 10, padding: 12, marginBottom: 10 },
  cardLabel: { fontSize: 11, fontWeight: "600", color: "#555555", textTransform: "uppercase", marginBottom: 4 },
  cardBody: { fontSize: 14, color: "#111111" },
  taskRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#e6e0d2" },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: "#111111", marginRight: 10 },
  checkboxChecked: { backgroundColor: "#3f6b4f", borderColor: "#3f6b4f" },
  taskTitle: { fontSize: 15, color: "#111111", flex: 1 },
  taskTitleDone: { color: "#888888", textDecorationLine: "line-through" },
  empty: { color: "#888888", fontSize: 14, marginTop: 20, textAlign: "center" },
  error: { color: "#b3261e", fontSize: 14, marginBottom: 12, textAlign: "center" },
  retryButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
  addRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  addInput: { flex: 1, borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#ffffff", fontSize: 14 },
  addButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  addButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
});
