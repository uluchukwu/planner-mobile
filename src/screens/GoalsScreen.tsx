import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { fetchGoals, createGoal, deleteGoal, toggleGoalStar, ApiError, GoalsResponse } from "../api";
import { clearToken } from "../tokenStorage";

export function GoalsScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<GoalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newYearGoal, setNewYearGoal] = useState("");
  const [newMonthGoal, setNewMonthGoal] = useState("");

  const load = useCallback(async (forYear: number) => {
    try {
      const result = await fetchGoals(forYear);
      setData(result);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load goals.");
    }
  }, [onLoggedOut]);

  useEffect(() => {
    setLoading(true);
    load(year).finally(() => setLoading(false));
  }, [year, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load(year);
    setRefreshing(false);
  }

  async function handleAddYearGoal() {
    const title = newYearGoal.trim();
    if (!title) return;
    setNewYearGoal("");
    await createGoal({ level: "YEAR", title, yearKey: year }).catch(() => {});
    await load(year);
  }

  async function handleAddMonthGoal() {
    const title = newMonthGoal.trim();
    if (!title || !data) return;
    setNewMonthGoal("");
    await createGoal({ level: "MONTH", title, monthKey: data.monthKey }).catch(() => {});
    await load(year);
  }

  async function handleDelete(goalId: string) {
    setData((prev) =>
      prev
        ? { ...prev, yearGoals: prev.yearGoals.filter((g) => g.id !== goalId), monthGoals: prev.monthGoals.filter((g) => g.id !== goalId) }
        : prev
    );
    await deleteGoal(goalId).catch(() => load(year));
  }

  async function handleStar(goalId: string) {
    setData((prev) =>
      prev ? { ...prev, yearGoals: prev.yearGoals.map((g) => (g.id === goalId ? { ...g, isPriority: !g.isPriority } : g)) } : prev
    );
    await toggleGoalStar(goalId).catch(() => load(year));
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
        <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(year).finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.title}>{year} Goals</Text>
        <View style={styles.dayNav}>
          <Pressable style={styles.navButton} onPress={() => setYear((y) => y - 1)}>
            <Text style={styles.navButtonText}>← {year - 1}</Text>
          </Pressable>
          <Pressable style={styles.navButton} onPress={() => setYear((y) => y + 1)}>
            <Text style={styles.navButtonText}>{year + 1} →</Text>
          </Pressable>
        </View>
      </View>

      {data.yearGoals.length === 0 ? (
        <Text style={styles.empty}>No yearly goals yet.</Text>
      ) : (
        data.yearGoals.map((g) => (
          <View key={g.id} style={styles.goalRow}>
            <Pressable onPress={() => handleStar(g.id)} hitSlop={8}>
              <Text style={[styles.star, g.isPriority && styles.starActive]}>★</Text>
            </Pressable>
            <Text style={styles.goalTitle}>{g.title}</Text>
            <Text style={styles.goalProgress}>{g.progress}%</Text>
            <Pressable onPress={() => handleDelete(g.id)} hitSlop={8}>
              <Text style={styles.deleteX}>✕</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={styles.addRow}>
        <TextInput style={styles.addInput} placeholder="Add a yearly goal…" value={newYearGoal} onChangeText={setNewYearGoal} onSubmitEditing={handleAddYearGoal} returnKeyType="done" />
        <Pressable style={styles.addButton} onPress={handleAddYearGoal}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, { fontSize: 17, marginTop: 24, marginBottom: 12 }]}>This month</Text>
      {data.monthGoals.length === 0 ? (
        <Text style={styles.empty}>No goals for this month yet.</Text>
      ) : (
        data.monthGoals.map((g) => (
          <View key={g.id} style={styles.goalRow}>
            <Text style={[styles.goalTitle, { marginLeft: 0 }]}>{g.title}</Text>
            <Text style={styles.goalProgress}>{g.progress}%</Text>
            <Pressable onPress={() => handleDelete(g.id)} hitSlop={8}>
              <Text style={styles.deleteX}>✕</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={styles.addRow}>
        <TextInput style={styles.addInput} placeholder="Add this month's goal…" value={newMonthGoal} onChangeText={setNewMonthGoal} onSubmitEditing={handleAddMonthGoal} returnKeyType="done" />
        <Pressable style={styles.addButton} onPress={handleAddMonthGoal}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#111111" },
  dayNav: { flexDirection: "row", gap: 8 },
  navButton: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  navButtonText: { fontSize: 12, color: "#555555" },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e6e0d2" },
  star: { fontSize: 16, color: "#cccccc" },
  starActive: { color: "#c1653f" },
  goalTitle: { flex: 1, fontSize: 14, color: "#111111", marginLeft: 4 },
  goalProgress: { fontSize: 12, color: "#555555" },
  deleteX: { color: "#888888", fontSize: 13, paddingHorizontal: 2 },
  addRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  addInput: { flex: 1, borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#ffffff", fontSize: 14 },
  addButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  addButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
  empty: { color: "#888888", fontSize: 14, marginBottom: 8 },
  error: { color: "#b3261e", fontSize: 14, marginBottom: 12, textAlign: "center" },
  retryButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
