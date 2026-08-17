import { loadToken } from "./tokenStorage";

// `localhost` resolves to the browser's own machine when running `expo start --web`
// (the only target verified in this environment — no Android SDK/emulator available),
// which is correct for that case. A physical device or emulator can't reach your dev
// machine via "localhost" — replace this with your machine's LAN IP (e.g.
// "http://192.168.1.23:3100") when testing on a real device.
export const API_BASE_URL = "http://localhost:3100";

export type TodayTask = {
  id: string;
  title: string;
  completed: boolean;
  dailyPriorityRank: number | null;
};

export type TodayResponse = {
  date: string;
  dateLabel: string;
  challenge: string | null;
  objective: string | null;
  tasks: TodayTask[];
};

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

export async function login(email: string, password: string) {
  return request<{ token: string; expiresAt: string; user: { id: string; name: string | null; email: string } }>(
    "/api/mobile/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

export async function fetchToday(): Promise<TodayResponse> {
  const token = await loadToken();
  return request<TodayResponse>("/api/mobile/today", { method: "GET" }, token);
}

export async function toggleTask(taskId: string): Promise<{ id: string; completed: boolean }> {
  const token = await loadToken();
  return request(`/api/mobile/tasks/${taskId}/toggle`, { method: "POST" }, token);
}
