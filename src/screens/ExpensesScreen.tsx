import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { fetchExpenses, createExpense, deleteExpense, getCachedAt, ApiError, ExpensesResponse } from "../api";
import { clearToken } from "../tokenStorage";
import { todayKey } from "../dateUtils";
import { CacheBanner } from "../components/CacheBanner";

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function ExpensesScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [data, setData] = useState<ExpensesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async (forMonth: string) => {
    try {
      const result = await fetchExpenses(forMonth);
      setData(result);
      setCachedAt(getCachedAt(result));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setError(e instanceof Error ? e.message : "Couldn't load expenses.");
    }
  }, [onLoggedOut]);

  useEffect(() => {
    setLoading(true);
    load(month).finally(() => setLoading(false));
  }, [month, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load(month);
    setRefreshing(false);
  }

  async function handleAdd() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setAdding(false);
    setAmount("");
    setDescription("");
    await createExpense({ amount: parsed, date: todayKey(), category: "OTHER", paymentMethod: "CARD", description }).catch(() => {});
    await load(month);
  }

  async function handleDelete(expenseId: string) {
    setData((prev) => (prev ? { ...prev, expenses: prev.expenses.filter((e) => e.id !== expenseId) } : prev));
    await deleteExpense(expenseId).catch(() => load(month));
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
        <Pressable style={styles.retryButton} onPress={() => { setLoading(true); load(month).finally(() => setLoading(false)); }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.title}>{formatMonthLabel(month)}</Text>
        <View style={styles.dayNav}>
          <Pressable style={styles.navButton} onPress={() => setMonth((m) => shiftMonth(m, -1))}>
            <Text style={styles.navButtonText}>← Prev</Text>
          </Pressable>
          <Pressable style={styles.navButton} onPress={() => setMonth((m) => shiftMonth(m, 1))}>
            <Text style={styles.navButtonText}>Next →</Text>
          </Pressable>
        </View>
      </View>

      {cachedAt !== null && <CacheBanner savedAt={cachedAt} />}

      <Text style={styles.total}>{formatCurrency(data.total, data.currency)} total</Text>

      {data.breakdown.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          {data.breakdown.map((b) => (
            <View key={b.category} style={{ marginBottom: 8 }}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownCategory}>{b.category.charAt(0) + b.category.slice(1).toLowerCase()}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(b.total, data.currency)} · {b.pct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, b.pct)}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {data.expenses.length === 0 ? (
        <Text style={styles.empty}>No expenses logged for this month yet.</Text>
      ) : (
        data.expenses.map((e) => (
          <View key={e.id} style={styles.expenseRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.expenseDesc}>{e.description || e.category}</Text>
              <Text style={styles.expenseMeta}>{e.date} · {e.category}</Text>
            </View>
            <Text style={styles.expenseAmount}>{formatCurrency(e.amount, data.currency)}</Text>
            <Pressable onPress={() => handleDelete(e.id)} hitSlop={8}>
              <Text style={styles.deleteX}>✕</Text>
            </Pressable>
          </View>
        ))
      )}

      {adding ? (
        <View style={styles.addForm}>
          <TextInput style={styles.addInput} placeholder="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.addInput} placeholder="Description (optional)" value={description} onChangeText={setDescription} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>Add expense</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setAdding(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addTrigger} onPress={() => setAdding(true)}>
          <Text style={styles.addTriggerText}>+ Add expense</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf7f1", padding: 20, paddingTop: 56 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#faf7f1", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: "700", color: "#111111" },
  dayNav: { flexDirection: "row", gap: 8 },
  navButton: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  navButtonText: { fontSize: 12, color: "#555555" },
  total: { fontSize: 14, fontWeight: "600", color: "#111111", marginBottom: 16 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  breakdownCategory: { fontSize: 13, color: "#111111" },
  breakdownAmount: { fontSize: 12, color: "#555555" },
  progressTrack: { height: 6, backgroundColor: "#eeeeee", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: "#3f6b4f" },
  expenseRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e6e0d2" },
  expenseDesc: { fontSize: 14, color: "#111111" },
  expenseMeta: { fontSize: 11, color: "#888888", marginTop: 2 },
  expenseAmount: { fontSize: 14, fontWeight: "600", color: "#111111" },
  deleteX: { color: "#888888", fontSize: 13, paddingHorizontal: 2 },
  addTrigger: { marginTop: 16, alignItems: "center", paddingVertical: 10, borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8 },
  addTriggerText: { color: "#3f6b4f", fontWeight: "600", fontSize: 13 },
  addForm: { marginTop: 16, gap: 8 },
  addInput: { borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#ffffff", fontSize: 14 },
  addButton: { flex: 1, backgroundColor: "#3f6b4f", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  addButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#e6e0d2", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  cancelButtonText: { color: "#555555", fontWeight: "600", fontSize: 13 },
  empty: { color: "#888888", fontSize: 14 },
  error: { color: "#b3261e", fontSize: 14, marginBottom: 12, textAlign: "center" },
  retryButton: { backgroundColor: "#3f6b4f", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
