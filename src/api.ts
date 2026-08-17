import { loadToken } from "./tokenStorage";

// `localhost` resolves to the browser's own machine when running `expo start --web`
// (the only target verified in this environment — no Android SDK/emulator available),
// which is correct for that case. A physical device or emulator can't reach your dev
// machine via "localhost" — replace this with your machine's LAN IP (e.g.
// "http://192.168.1.23:3100") when testing on a real device.
export const API_BASE_URL = "http://localhost:3100";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

// Every screen but login needs the stored token — this wrapper loads it so call
// sites don't repeat `const token = await loadToken()` at every call.
async function authed<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await loadToken();
  return request<T>(path, options, token);
}

export async function login(email: string, password: string) {
  return request<{ token: string; expiresAt: string; user: { id: string; name: string | null; email: string } }>(
    "/api/mobile/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

// --- Today / day ---

export type TodayTask = { id: string; title: string; completed: boolean; dailyPriorityRank: number | null };
export type TodayResponse = {
  date: string;
  dateLabel: string;
  isToday: boolean;
  challenge: string | null;
  objective: string | null;
  tasks: TodayTask[];
};

export async function fetchDay(date?: string): Promise<TodayResponse> {
  return authed(`/api/mobile/today${date ? `?date=${date}` : ""}`, { method: "GET" });
}

export async function toggleTask(taskId: string): Promise<{ id: string; completed: boolean }> {
  return authed(`/api/mobile/tasks/${taskId}/toggle`, { method: "POST" });
}

export async function createTask(title: string, date: string): Promise<TodayTask> {
  return authed("/api/mobile/today", { method: "POST", body: JSON.stringify({ title, date }) });
}

// --- Week ---

export type WeekGoal = { id: string; title: string; weeklyPriorityRank: number | null; progress: number };
export type WeekDay = { date: string; label: string; sublabel: string; isToday: boolean; taskCount: number; completedCount: number };
export type WeekHabit = { id: string; name: string; weekDots: boolean[]; currentStreak: number };
export type ChecklistItemData = { id: string; label: string; completed: boolean };
export type WeekResponse = {
  weekId: string;
  weekLabel: string;
  isCurrentWeek: boolean;
  goals: WeekGoal[];
  days: WeekDay[];
  habits: WeekHabit[];
  checklist: { id: string; items: ChecklistItemData[] };
};

export async function fetchWeek(date?: string): Promise<WeekResponse> {
  return authed(`/api/mobile/week${date ? `?date=${date}` : ""}`, { method: "GET" });
}

// --- Goals ---

export type GoalsResponse = {
  year: number;
  monthKey: string;
  yearGoals: { id: string; title: string; isPriority: boolean; progress: number }[];
  monthGoals: { id: string; title: string; progress: number; parentTitle: string | null }[];
};

export async function fetchGoals(year?: number, month?: string): Promise<GoalsResponse> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", month);
  const qs = params.toString();
  return authed(`/api/mobile/goals${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export async function createGoal(input: { level: "YEAR" | "MONTH" | "WEEK"; title: string; yearKey?: number; monthKey?: string; weekId?: string }) {
  return authed<{ id: string; title: string }>("/api/mobile/goals", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteGoal(goalId: string) {
  return authed<{ ok: true }>(`/api/mobile/goals/${goalId}`, { method: "DELETE" });
}

export async function toggleWeeklyPriority(goalId: string) {
  return authed<{ error?: string }>(`/api/mobile/goals/${goalId}/priority`, { method: "POST" });
}

export async function toggleGoalStar(goalId: string) {
  return authed<{ id: string; isPriority: boolean }>(`/api/mobile/goals/${goalId}/star`, { method: "POST" });
}

// --- Habits ---

export type HabitRow = {
  id: string;
  name: string;
  archived: boolean;
  currentStreak: number;
  weekCompletions: number;
  monthlyCompletionPct: number;
  completedToday: boolean;
};

export async function fetchHabits(): Promise<HabitRow[]> {
  return authed("/api/mobile/habits", { method: "GET" });
}

export async function createHabit(name: string) {
  return authed<{ id: string; name: string }>("/api/mobile/habits", { method: "POST", body: JSON.stringify({ name }) });
}

export async function toggleHabitCompletion(habitId: string, date?: string) {
  return authed<{ date: string; completed: boolean }>(`/api/mobile/habits/${habitId}/toggle${date ? `?date=${date}` : ""}`, { method: "POST" });
}

export async function setHabitArchived(habitId: string, archived: boolean) {
  return authed<{ id: string; archived: boolean }>(`/api/mobile/habits/${habitId}`, { method: "PATCH", body: JSON.stringify({ archived }) });
}

export async function deleteHabit(habitId: string) {
  return authed<{ ok: true }>(`/api/mobile/habits/${habitId}`, { method: "DELETE" });
}

// --- Checklist ---

export async function addChecklistItem(checklistId: string, label: string) {
  return authed<ChecklistItemData>("/api/mobile/checklist/items", { method: "POST", body: JSON.stringify({ checklistId, label }) });
}

export async function toggleChecklistItem(itemId: string) {
  return authed<{ id: string; completed: boolean }>(`/api/mobile/checklist/items/${itemId}/toggle`, { method: "POST" });
}

export async function deleteChecklistItem(itemId: string) {
  return authed<{ ok: true }>(`/api/mobile/checklist/items/${itemId}`, { method: "DELETE" });
}

// --- Expenses ---

export type ExpenseRow = { id: string; amount: number; date: string; category: string; paymentMethod: string; description: string | null };
export type ExpensesResponse = {
  month: string;
  currency: string;
  total: number;
  expenses: ExpenseRow[];
  breakdown: { category: string; total: number; pct: number }[];
};

export async function fetchExpenses(month?: string): Promise<ExpensesResponse> {
  return authed(`/api/mobile/expenses${month ? `?month=${month}` : ""}`, { method: "GET" });
}

export async function createExpense(input: { amount: number; date: string; category: string; paymentMethod: string; description?: string }) {
  return authed<{ id: string }>("/api/mobile/expenses", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteExpense(expenseId: string) {
  return authed<{ ok: true }>(`/api/mobile/expenses/${expenseId}`, { method: "DELETE" });
}

// --- Dashboard ---

export type DashboardResponse = {
  dateLabel: string;
  today: { total: number; completed: number; progress: number };
  week: { total: number; completed: number; completionRate: number; goals: { id: string; title: string; progress: number }[] };
  month: { goals: { id: string; title: string; progress: number }[] };
  bestHabitStreak: number;
};

export async function fetchDashboard(): Promise<DashboardResponse> {
  return authed("/api/mobile/dashboard", { method: "GET" });
}
