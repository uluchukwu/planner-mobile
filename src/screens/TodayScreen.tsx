import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { fetchToday, toggleTask, ApiError, TodayResponse, TodayTask } from "../api";
import { clearToken } from "../tokenStorage";

export function TodayScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchToday();
      setData(result);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load today's plan.");
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.dateLabel}>{data.dateLabel}</Text>
        <Pressable onPress={async () => { await clearToken(); onLoggedOut(); }}>
          <Text style={styles.signOut}>Sign out</Text>
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
        ListEmptyComponent={<Text style={styles.empty}>Nothing planned for today yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.taskRow} onPress={() => handleToggle(item)}>
            <View style={[styles.checkbox, item.completed && styles.checkboxChecked]} />
            <Text style={[styles.taskTitle, item.completed && styles.taskTitleDone]}>{item.title}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  dateLabel: { fontSize: 20, fontWeight: "700", color: "#111111" },
  signOut: { fontSize: 13, color: "#555555" },
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
});
