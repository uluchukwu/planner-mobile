import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import {
  fetchReview,
  saveReview,
  moveTaskToNextWeek,
  rescheduleTaskToDate,
  archiveTask,
  getCachedAt,
  ApiError,
  ReviewResponse,
  ReviewFields,
} from "../api";
import { clearToken } from "../tokenStorage";
import { CacheBanner } from "../components/CacheBanner";

const FIELDS: { key: keyof ReviewFields; label: string }[] = [
  { key: "wentWell", label: "What went well?" },
  { key: "didntGoWell", label: "What didn't go well?" },
  { key: "learned", label: "What did I learn?" },
  { key: "changeNextWeek", label: "What should I change next week?" },
  { key: "proudOf", label: "What am I proud of?" },
  { key: "carryForward", label: "What should I carry forward?" },
];

const EMPTY_FIELDS: ReviewFields = {
  wentWell: "",
  didntGoWell: "",
  learned: "",
  changeNextWeek: "",
  proudOf: "",
  carryForward: "",
};

export function ReviewScreen({
  initialDate,
  onLoggedOut,
  onBack,
}: {
  initialDate?: string;
  onLoggedOut: () => void;
  onBack: () => void;
}) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [fields, setFields] = useState<ReviewFields>(EMPTY_FIELDS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rescheduling, setRescheduling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchReview(initialDate);
      setData(result);
      setFields(result.review);
      setCachedAt(getCachedAt(result));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load the weekly review.");
    }
  }, [initialDate, onLoggedOut]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    setSaved(false);
    try {
      await saveReview(data.weekId, fields);
      setSaved(true);
    } catch {
      // Leave the entered text in place — the user can retry Save.
    } finally {
      setSaving(false);
    }
  }

  function removeTask(taskId: string) {
    setData((prev) => (prev ? { ...prev, incompleteTasks: prev.incompleteTasks.filter((t) => t.id !== taskId) } : prev));
  }

  async function handleMoveNextWeek(taskId: string) {
    removeTask(taskId);
    await moveTaskToNextWeek(taskId).catch(() => load());
  }

  async function handleReschedule(taskId: string, dateKey: string) {
    setRescheduling(null);
    removeTask(taskId);
    await rescheduleTaskToDate(taskId, dateKey).catch(() => load());
  }

  async function handleArchive(taskId: string) {
    removeTask(taskId);
    await archiveTask(taskId).catch(() => load());
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Pressable onPress={onBack}>
        <Text style={styles.backLink}>← Back to week</Text>
      </Pressable>
      <Text style={styles.title}>Weekly review</Text>
      <Text style={styles.subtitle}>{data.weekLabel}</Text>
      {cachedAt !== null && <CacheBanner savedAt={cachedAt} />}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Planned</Text>
          <Text style={styles.statValue}>{data.planned}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statValue}>{data.completed}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Rate</Text>
          <Text style={styles.statValue}>{data.completionRate}%</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Habits avg.</Text>
          <Text style={styles.statValue}>{data.habitsAvgCompletion === null ? "—" : `${data.habitsAvgCompletion}%`}</Text>
        </View>
      </View>

      {data.goals.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Goals</Text>
          {data.goals.map((g) => (
            <View key={g.id} style={styles.goalRow}>
              <Text style={styles.goalTitle} numberOfLines={1}>{g.title} {g.progress >= 100 ? "✓" : ""}</Text>
              <Text style={styles.goalProgress}>{g.progress}%</Text>
            </View>
          ))}
        </>
      )}

      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Incomplete tasks</Text>
      <Text style={styles.hint}>Nothing carries forward automatically — decide what happens to each one.</Text>
      {data.incompleteTasks.length === 0 ? (
        <Text style={styles.empty}>Nothing left incomplete — everything planned this week was either finished or already handled.</Text>
      ) : (
        data.incompleteTasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
            <View style={styles.taskActions}>
              <Pressable onPress={() => handleMoveNextWeek(task.id)}>
                <Text style={styles.actionLink}>Next week</Text>
              </Pressable>
              <Pressable onPress={() => setRescheduling(rescheduling === task.id ? null : task.id)}>
                <Text style={styles.actionLink}>Reschedule</Text>
              </Pressable>
              <Pressable onPress={() => handleArchive(task.id)}>
                <Text style={styles.actionLinkMuted}>Archive</Text>
              </Pressable>
            </View>
            {rescheduling === task.id && (
              <View style={styles.rescheduleRow}>
                {data.nextWeekDays.map((d) => (
                  <Pressable key={d.dateKey} style={styles.rescheduleChip} onPress={() => handleReschedule(task.id, d.dateKey)}>
                    <Text style={styles.rescheduleChipText}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))
      )}

      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Reflection</Text>
      {FIELDS.map((f) => (
        <View key={f.key} style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <TextInput
            style={styles.fieldInput}
            multiline
            numberOfLines={2}
            value={fields[f.key]}
            onChangeText={(text) => setFields((prev) => ({ ...prev, [f.key]: text }))}
          />
        </View>
      ))}
      <View style={styles.saveRow}>
        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save reflection"}</Text>
        </Pressable>
        {saved && !saving && <Text style={styles.savedText}>Saved</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  backLink: { fontSize: 12, color: "#888888", marginBottom: 8 },
  title: { fontSize: 20, fontWeight: "700", color: "#111111" },
  subtitle: { fontSize: 13, color: "#888888", marginBottom: 16 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: { flexBasis: "47%", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 10, padding: 12 },
  statLabel: { fontSize: 10, fontWeight: "700", color: "#888888", textTransform: "uppercase" },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111111", marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#555555", textTransform: "uppercase", marginBottom: 6 },
  hint: { fontSize: 12, color: "#888888", marginBottom: 8 },
  goalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  goalTitle: { flex: 1, fontSize: 14, color: "#111111", marginRight: 8 },
  goalProgress: { fontSize: 12, color: "#555555" },
  empty: { color: "#888888", fontSize: 13 },
  taskRow: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 10, backgroundColor: "#ffffff", padding: 10, marginBottom: 8 },
  taskTitle: { fontSize: 14, color: "#111111", marginBottom: 8 },
  taskActions: { flexDirection: "row", gap: 14 },
  actionLink: { fontSize: 12, fontWeight: "600", color: "#c1653f" },
  actionLinkMuted: { fontSize: 12, fontWeight: "600", color: "#888888" },
  rescheduleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  rescheduleChip: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#faf7f1" },
  rescheduleChipText: { fontSize: 11, color: "#555555" },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#111111", marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, backgroundColor: "#ffffff", padding: 10, fontSize: 14, minHeight: 56, textAlignVertical: "top" },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  saveButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  saveButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
  savedText: { color: "#3f6b4f", fontSize: 12, fontWeight: "600" },
  error: { color: "#b3261e", fontSize: 14, textAlign: "center", marginBottom: 12 },
  retryButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
