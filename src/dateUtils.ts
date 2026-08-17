// Deliberately duplicated from the web app's src/lib/date/week.ts rather than shared —
// code-sharing between the two apps is its own future pass (see ROADMAP.md), and this
// is a handful of lines, not a maintenance-heavy chunk of logic.
export function todayKey(): string {
  return dateToKey(new Date());
}

export function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return dateToKey(date);
}
