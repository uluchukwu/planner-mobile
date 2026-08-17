import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import {
  fetchWeek,
  toggleWeeklyPriority,
  createGoal,
  toggleHabitCompletion,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  ApiError,
  WeekResponse,
} from "../api";
import { clearToken } from "../tokenStorage";
import { addDays, todayKey } from "../dateUtils";

export function WeekScreen({
  onLoggedOut,
  onOpenDay,
  onOpenReview,
}: {
  onLoggedOut: () => void;
  onOpenDay: (date: string) => void;
  onOpenReview: (date: string) => void;
}) {
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [data, setData] = useState<WeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newChecklistLabel, setNewChecklistLabel] = useState("");

  const load = useCallback(async (forDate: string) => {
    try {
      const result = await fetchWeek(forDate);
      setData(result);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load this week.");
    }
  }, [onLoggedOut]);

  useEffect(() => {
    setLoading(true);
    load(anchorDate).finally(() => setLoading(false));
  }, [anchorDate, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load(anchorDate);
    setRefreshing(false);
  }

  async function handleAddGoal() {
    const title = newGoalTitle.trim();
    if (!title || !data) return;
    setNewGoalTitle("");
    await createGoal({ level: "WEEK", title, weekId: data.weekId }).catch(() => {});
    await load(anchorDate);
  }

  async function handleTogglePriority(goalId: string) {
    setPriorityError(null);
    try {
      await toggleWeeklyPriority(goalId);
      await load(anchorDate);
    } catch (e) {
      setPriorityError(e instanceof Error ? e.message : "Couldn't update priority.");
    }
  }

  async function handleToggleHabit(habitId: string, date: string) {
    setData((prev) => {
      if (!prev) return prev;
      const dayIndex = prev.days.findIndex((d) => d.date === date);
      if (dayIndex === -1) return prev;
      return {
        ...prev,
        habits: prev.habits.map((h) =>
          h.id === habitId ? { ...h, weekDots: h.weekDots.map((v, i) => (i === dayIndex ? !v : v)) } : h
        ),
      };
    });
    try {
      await toggleHabitCompletion(habitId, date);
    } catch {
      await load(anchorDate);
    }
  }

  async function handleAddChecklistItem() {
    const label = newChecklistLabel.trim();
    if (!label || !data) return;
    setNewChecklistLabel("");
    const item = await addChecklistItem(data.checklist.id, label).catch(() => null);
    if (item) {
      setData((prev) => (prev ? { ...prev, checklist: { ...prev.checklist, items: [...prev.checklist.items, item] } } : prev));
    }
  }

  async function handleToggleChecklistItem(itemId: string) {
    setData((prev) =>
      prev
        ? { ...prev, checklist: { ...prev.checklist, items: prev.checklist.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i)) } }
        : prev
    );
    await toggleChecklistItem(itemId).catch(() => load(anchorDate));
  }

  async function handleDeleteChecklistItem(itemId: string) {
    setData((prev) => (prev ? { ...prev, checklist: { ...prev.checklist, items: prev.checklist.items.filter((i) => i.id !== itemId) } } : prev));
    await deleteChecklistItem(itemId).catch(() => load(anchorDate));
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
        <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(anchorDate).finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={styles.eyebrow}>{data.isCurrentWeek ? "This week" : "Week"}</Text>
            <Text style={styles.weekLabel}>{data.weekLabel}</Text>
          </View>
          <Pressable onPress={() => onOpenReview(anchorDate)}>
            <Text style={styles.reviewLink}>Weekly review →</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.dayNav}>
        <Pressable style={styles.navButton} onPress={() => setAnchorDate((d) => addDays(d, -7))}>
          <Text style={styles.navButtonText}>← Prev</Text>
        </Pressable>
        {!data.isCurrentWeek && (
          <Pressable style={styles.navButton} onPress={() => setAnchorDate(todayKey())}>
            <Text style={styles.navButtonText}>This week</Text>
          </Pressable>
        )}
        <Pressable style={styles.navButton} onPress={() => setAnchorDate((d) => addDays(d, 7))}>
          <Text style={styles.navButtonText}>Next →</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Priority goals ({data.goals.filter((g) => g.weeklyPriorityRank !== null).length}/4)</Text>
      {priorityError && <Text style={styles.error}>{priorityError}</Text>}
      {data.goals.map((g) => (
        <View key={g.id} style={styles.goalRow}>
          <Pressable
            style={[styles.starButton, g.weeklyPriorityRank !== null && styles.starButtonActive]}
            onPress={() => handleTogglePriority(g.id)}
          >
            <Text style={[styles.starButtonText, g.weeklyPriorityRank !== null && styles.starButtonTextActive]}>
              {g.weeklyPriorityRank ?? "★"}
            </Text>
          </Pressable>
          <Text style={styles.goalTitle}>{g.title}</Text>
          <Text style={styles.goalProgress}>{g.progress}%</Text>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add a weekly goal…"
          value={newGoalTitle}
          onChangeText={setNewGoalTitle}
          onSubmitEditing={handleAddGoal}
          returnKeyType="done"
        />
        <Pressable style={styles.addButton} onPress={handleAddGoal}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Days</Text>
      {data.days.map((d) => (
        <Pressable key={d.date} style={styles.dayRow} onPress={() => onOpenDay(d.date)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayRowLabel}>
              {d.label} {d.isToday ? "· Today" : ""}
            </Text>
            <Text style={styles.dayRowSublabel}>{d.sublabel}</Text>
          </View>
          <Text style={styles.dayRowCount}>{d.completedCount}/{d.taskCount}</Text>
        </Pressable>
      ))}

      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Habit tracker</Text>
      {data.habits.length === 0 ? (
        <Text style={styles.empty}>No active habits.</Text>
      ) : (
        data.habits.map((h) => (
          <View key={h.id} style={styles.habitRow}>
            <Text style={styles.habitName} numberOfLines={1}>{h.name}</Text>
            <View style={styles.dotsRow}>
              {h.weekDots.map((done, i) => (
                <Pressable key={i} style={[styles.dot, done && styles.dotDone]} onPress={() => handleToggleHabit(h.id, data.days[i].date)} />
              ))}
            </View>
          </View>
        ))
      )}

      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Weekly checklist</Text>
      {data.checklist.items.map((item) => (
        <Pressable key={item.id} style={styles.checklistRow} onPress={() => handleToggleChecklistItem(item.id)}>
          <View style={[styles.checkbox, item.completed && styles.checkboxChecked]} />
          <Text style={[styles.checklistLabel, item.completed && styles.checklistLabelDone]}>{item.label}</Text>
          <Pressable onPress={() => handleDeleteChecklistItem(item.id)} hitSlop={8}>
            <Text style={styles.deleteX}>✕</Text>
          </Pressable>
        </Pressable>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Add checklist item…"
          value={newChecklistLabel}
          onChangeText={setNewChecklistLabel}
          onSubmitEditing={handleAddChecklistItem}
          returnKeyType="done"
        />
        <Pressable style={styles.addButton} onPress={handleAddChecklistItem}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  header: { marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: "600", color: "#888888", textTransform: "uppercase" },
  weekLabel: { fontSize: 20, fontWeight: "700", color: "#111111" },
  reviewLink: { fontSize: 12, fontWeight: "600", color: "#c1653f", marginTop: 4 },
  dayNav: { flexDirection: "row", gap: 8, marginBottom: 16 },
  navButton: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  navButtonText: { fontSize: 12, color: "#555555" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#555555", textTransform: "uppercase", marginBottom: 8 },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  starButton: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "#888888", alignItems: "center", justifyContent: "center" },
  starButtonActive: { backgroundColor: "#c1653f", borderColor: "#c1653f" },
  starButtonText: { fontSize: 11, fontWeight: "700", color: "#888888" },
  starButtonTextActive: { color: "#ffffff" },
  goalTitle: { flex: 1, fontSize: 14, color: "#111111" },
  goalProgress: { fontSize: 12, color: "#555555" },
  dayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e6e0d2" },
  dayRowLabel: { fontSize: 14, fontWeight: "600", color: "#111111" },
  dayRowSublabel: { fontSize: 12, color: "#888888" },
  dayRowCount: { fontSize: 13, color: "#555555" },
  habitRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
  habitName: { width: 100, fontSize: 13, color: "#111111" },
  dotsRow: { flexDirection: "row", gap: 6 },
  dot: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: "#111111" },
  dotDone: { backgroundColor: "#3f6b4f", borderColor: "#3f6b4f" },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: "#111111" },
  checkboxChecked: { backgroundColor: "#3f6b4f", borderColor: "#3f6b4f" },
  checklistLabel: { flex: 1, fontSize: 14, color: "#111111" },
  checklistLabelDone: { color: "#888888", textDecorationLine: "line-through" },
  deleteX: { color: "#888888", fontSize: 13 },
  addRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  addInput: { flex: 1, borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#ffffff", fontSize: 14 },
  addButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  addButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
  empty: { color: "#888888", fontSize: 14 },
  error: { color: "#b3261e", fontSize: 13, marginBottom: 8 },
  retryButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
