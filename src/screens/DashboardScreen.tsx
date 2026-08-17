import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { fetchDashboard, getCachedAt, ApiError, DashboardResponse } from "../api";
import { clearToken } from "../tokenStorage";
import { CacheBanner } from "../components/CacheBanner";

export function DashboardScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
      setCachedAt(getCachedAt(result));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load the dashboard.");
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
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>{data.dateLabel}</Text>
      {cachedAt !== null && <CacheBanner savedAt={cachedAt} />}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Today</Text>
        <Text style={styles.cardBig}>{data.today.completed}/{data.today.total} tasks · {data.today.progress}%</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>This week</Text>
        <Text style={styles.cardBig}>{data.week.completed}/{data.week.total} tasks · {data.week.completionRate}%</Text>
        {data.week.goals.map((g) => (
          <View key={g.id} style={styles.goalRow}>
            <Text style={styles.goalTitle} numberOfLines={1}>{g.title}</Text>
            <Text style={styles.goalProgress}>{g.progress}%</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>This month</Text>
        {data.month.goals.length === 0 ? (
          <Text style={styles.empty}>No monthly goals yet.</Text>
        ) : (
          data.month.goals.map((g) => (
            <View key={g.id} style={styles.goalRow}>
              <Text style={styles.goalTitle} numberOfLines={1}>{g.title}</Text>
              <Text style={styles.goalProgress}>{g.progress}%</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Best habit streak</Text>
        <Text style={styles.cardBig}>{data.bestHabitStreak > 0 ? `${data.bestHabitStreak} days` : "—"}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  title: { fontSize: 20, fontWeight: "700", color: "#111111" },
  subtitle: { fontSize: 13, color: "#888888", marginBottom: 16 },
  card: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 10, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 11, fontWeight: "700", color: "#555555", textTransform: "uppercase", marginBottom: 6 },
  cardBig: { fontSize: 16, fontWeight: "600", color: "#111111", marginBottom: 4 },
  goalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  goalTitle: { flex: 1, fontSize: 13, color: "#111111", marginRight: 8 },
  goalProgress: { fontSize: 12, color: "#555555" },
  empty: { color: "#888888", fontSize: 13 },
  error: { color: "#b3261e", fontSize: 14, textAlign: "center" },
});
