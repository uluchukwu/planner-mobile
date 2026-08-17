# Planner Mobile

The Phase 6 mobile client for the [Planner](C:\programming\Planner) web app. Talks to that app's `/api/mobile/*` Route Handlers over HTTP — it does not connect to Postgres directly, and shares no code with the web app yet (see "Code sharing" below).

## Scope (this pass)

Phase 6 is being built in an agreed order: **screens first**, then offline sync, push notifications, and code sharing as separate later passes (see the web app's `docs/ROADMAP.md`). All planner screens are now built, including Settings — the mobile app has full feature parity with the web app's core planner surface. Offline sync is scoped, deliberately, to a **read-only cache** — see "Offline behavior" below for exactly what that does and doesn't cover.

- **Built:** login, eight screens — Dashboard, Today (with day navigation and inline task creation), Week (priority goals with the star toggle, a 7-day summary that opens into Today, the habit tracker grid, the weekly checklist, a link into Weekly review), Goals (year + month, add/delete/star), Habits (create/toggle/archive/restore/delete with streak and completion stats), Expenses (month view, category breakdown, add/delete), Weekly review (stats, goal progress, incomplete-task triage — move to next week / reschedule to a specific day / archive — and the six-question reflection form; reached from the Week screen's "Weekly review →" link, not the tab bar, mirroring the web app's own non-nav-item treatment), Settings (name, week-start day, theme, working hours, currency, notifications toggle, sign out — mirrors the web sidebar's persistent "Settings" nav item, so it's a tab here too) — and a read-only offline cache covering every `GET` screen.
- **Not built:** signup (create an account via the web app's `/signup` first), offline *writes* (see below — reads only), push notifications, code sharing with the web app. Drag-and-drop was not ported either — native mobile UIs don't really want desktop drag-and-drop anyway; the Week screen's day rows link into Today instead.
- **Known limitation:** the Goals screen's year navigation works, but month goals always show the current calendar month regardless of the selected year — `GoalsScreen` only ever calls `fetchGoals(year)`, and `monthKey` defaults server-side to "now". Month navigation isn't wired up yet.

## Running it

1. The Planner web app must be running on `http://localhost:3100` (`cd ../Planner && npm run dev`) — this app has no backend of its own.
2. `npm install`
3. `npm run web` for the browser target, or `npm run android` / `npm run ios` for a device/emulator.

**If you're running on a physical device or emulator, not `--web`:** edit `API_BASE_URL` in `src/api.ts`. It's hardcoded to `http://localhost:3100`, which only resolves correctly when the app itself is *also* running in a browser on the same machine (`expo start --web`). A phone or emulator can't reach your dev machine via `localhost` — replace it with your machine's LAN IP, e.g. `http://192.168.1.23:3100`. This is the single most likely thing to cost you a debugging session if missed.

## What's verified vs. not

This environment has no Android SDK, no `adb`, no Java, and no physical device — so **only the `expo start --web` target (react-native-web) has actually been run and tested**, via scripted Playwright passes against `http://localhost:8082` covering every screen: sign in (wrong-password rejection + success), Today (seeded task/challenge visible, day-nav round-trip preserves state, inline task creation), Week (weekly goal visible and starrable with the priority count updating, day summary rows, checklist add), Goals (year goal visible, add a second one), Habits (create), Expenses (seeded expense + total + breakdown visible), Dashboard (aggregated stats reflect the week goal). A server-side cross-check via a direct `/api/mobile/dashboard` call (not the UI) confirmed the mobile-created task actually persisted. Zero console errors across all of it.

Weekly review was verified with its own pass: seeded 3 incomplete tasks + a weekly goal, confirmed the review screen showed correct stats and all 3 tasks, then triaged one of each kind (Next week / Reschedule to a chosen day / Archive) and confirmed each disappeared from the list, ending on the "nothing left incomplete" empty state. Filled in two reflection fields, saved, re-navigated away and back (Week → Weekly review) to confirm the text persisted in the UI, then cross-checked at the server: `/api/mobile/review` shows 0 incomplete tasks and the saved reflection text, `/api/mobile/today` for the rescheduled task's new date shows it there, and the original day no longer lists any of the 3 triaged tasks. "Planned" correctly dropped from 3 to 1 after triage — moving/rescheduling removes a task from the week entirely, archiving keeps it counted (mirrors the web app's "progress must never mislead" rule for the archived-but-still-planned case). Zero console errors.

The weekly-priority cap (max 4) was separately verified against its rejection path, not just the happy path: a Playwright pass created 5 weekly goals, starred 4 successfully, then starred the 5th and confirmed the server's rejection message ("This week's top 4 priorities are full. Remove one first.") actually renders in the UI, the on-screen count stays at 4/4, and a server-side `/api/mobile/week` cross-check confirms exactly 4 ranks persisted. This caught a real bug: `WeekScreen.handleTogglePriority` originally expected the failed request to *return* `{ error }`, but `api.ts`'s `request()` throws `ApiError` on any non-2xx response, so the 400 the server sends for a full week never reached that branch — the rejection was a silent no-op (an unhandled promise rejection) rather than a shown error. Fixed by having `handleTogglePriority` catch `ApiError` and surface `e.message` instead.

Settings was verified with its own pass: loaded the screen, changed every field (name, week-start day, theme, working hours, currency, notifications toggle), saved, and cross-checked at the server via `GET /api/mobile/settings` that all six fields actually persisted. Sign-out was verified to do more than clear local storage: after tapping "Sign out", a direct request using the old (pre-logout) token got a 401 back from the server — confirming `POST /api/mobile/logout` actually deletes the session row (`deleteSessionForToken` in the web app), not just that the mobile app forgot its copy of the token. Zero console errors.

The offline cache was verified against a genuinely disconnected `fetch()`, not just a slow one: Playwright's `context.setOffline(true)` on the browser context running the mobile app (a second, separate context stayed online for server-side cross-checks — `setOffline` would otherwise block those too). Logged in online, visited Today and Dashboard so their cache entries existed, went offline, then switched tabs away and back — the realistic offline simulation here, since a page *reload* would need to refetch the JS bundle itself from the Expo dev server, which a real installed native app never has to do. Confirmed: (1) both previously-visited screens still showed their real data with the "Couldn't reach the server — showing saved data from…" banner visible, (2) a screen never visited online (Expenses) showed an honest "no connection, and no saved data available" error rather than a blank or misleading success, (3) reconnecting and reloading made the banner disappear. A separate pass confirmed cache isolation across accounts: signed in as user A, populated the cache, signed out, signed in as user B on the same device, went offline immediately — B never saw A's cached task (the sign-out purge worked), and correctly saw their own cached task instead once their own online login had populated it. Zero console errors (aside from the browser's own "Failed to load resource: net::ERR_INTERNET_DISCONNECTED" log lines, which are the expected artifact of the deliberate offline simulation, not app errors). What this does *not* claim: behavior across an actual app kill-and-relaunch, a token expiring while offline, or the native `AsyncStorage` implementation — all untested here, see below.

Not verified in this environment, and worth treating as unproven until someone runs it on real hardware:
- Native `expo-secure-store` token storage (`src/tokenStorage.ts` branches to `localStorage` on web — that's the path actually tested; the native branch is correct per Expo's docs but has never executed).
- `@react-native-async-storage/async-storage`'s native (non-web) implementation — same caveat as SecureStore above; only its web/`localStorage`-backed path has run.
- Native navigation gestures, safe-area insets, keyboard behavior, and how the seven-tab bottom bar actually feels on a real small screen (it was only ever viewed at a fixed 420×900 browser viewport).
- Anything Android/iOS-specific in general.

## Offline behavior

**Scope, decided explicitly rather than assumed:** this is a read-only cache, not offline-first sync. "Offline sync" splits into two very different features that differ by roughly 10x in complexity — cache the last good read vs. buffer and replay writes with conflict resolution — and several endpoints here aren't naturally replay-safe (`POST /goals/:id/priority` is a toggle, not idempotent; `POST /tasks/:id/move-next-week` computes "next week" from the task's *current* week, so a queued replay could land somewhere the user didn't intend). Building the write-queue version without resolving those per-endpoint first would mean discovering the problems mid-implementation instead of before writing any code — so this pass deliberately stops at reads.

**How it works:** `src/cache.ts` wraps `@react-native-async-storage/async-storage` with three functions — `saveToCache`, `loadFromCache`, `clearCache` — keyed by request path. `api.ts`'s `request()` is the single place that uses them: every successful `GET` writes its response to the cache; if `fetch()` itself throws (no connection reached the server at all — not a 4xx/5xx, which is a real response and never triggers cache fallback), a `GET` falls back to whatever's cached for that path, or throws an honest "no connection, and no saved data available" error if there's nothing cached yet. Non-`GET` requests never read or write the cache — a mutation made offline just fails; there's no queue. Because the fallback lives in `request()` itself, no screen has custom offline-handling code — each just calls `getCachedAt(result)` after a successful load and shows `<CacheBanner savedAt={...} />` if the result came from the cache, so a user is never looking at stale data without knowing it.

**Why a 401 is never served from cache:** a real HTTP response (including 401) takes a completely different code path than a `fetch()`-level failure — it never reaches the cache-fallback branch. A signed-out or expired session still gets bounced to the login screen, exactly as before this pass; it doesn't get to look logged-in on stale data.

**Cache is purged on every sign-out**, not just cleared implicitly: `tokenStorage.ts`'s `clearToken()` — the one choke point every sign-out path (explicit and 401-triggered) already goes through — now also calls `clearCache()`. Without this, a second user signing in on the same device could see the first user's stale cached data while offline before their own first successful fetch. Verified directly (see below).

## Why no router

Seven tabs (Dashboard, Today, Week, Goals, Habits, Expenses, Settings) plus one non-tab screen (Weekly review, reached via a link from Week) gated by simple `useState` in `App.tsx` — no nested navigation, no back-stacks, no deep links. A consequence worth knowing: a full page reload in the `--web` target drops back to the Today tab, since `activeTab` is in-memory state, not URL state. This is less machinery than wiring `expo-router` for a shape this flat. Add `expo-router` when a screen needs its own back-stack (e.g. a task-detail screen pushed from Today) rather than before.

## Code sharing with the web app

None yet. The web app's pure logic (`lib/date/week.ts`, `lib/habits.ts`, `lib/progress.ts`, `lib/expenses.ts`, `lib/format.ts`) has no Next.js/DOM dependency and could in principle be extracted into a shared package — this app currently duplicates a small slice of it directly (`src/dateUtils.ts` has its own `addDays`/`todayKey`, and `ExpensesScreen.tsx` has its own tiny `formatCurrency`/`shiftMonth`/`formatMonthLabel`) rather than importing across repos. That duplication is deliberate and small (a few lines each) — real code-sharing needs an npm/pnpm workspace restructuring of the *web* repo too, which is its own future pass, not a change to make in passing.

## `npm audit`

A fresh `create-expo-app` scaffold reports ~18 findings (7 moderate, 11 high) — all inside Expo's own dev-time bundler toolchain (`metro`, `@expo/cli`, `image-size`), not runtime code shipped in the app. `npm audit fix --force` would downgrade `expo` from SDK 57 to 53, a major breaking change to the exact SDK version this app was built against — left alone deliberately, same reasoning as the pre-existing `deepmerge-ts` finding in the web app's `prisma` dependency (see that project's `ROADMAP.md`).

## API surface it depends on (web app side)

All under `../Planner/src/app/api/mobile/`, auth via `Authorization: Bearer <token>` against the same `Session` table the web app's cookie-based auth uses — a mobile login and a web login are the same kind of row, just handed to the client differently. See `../Planner/docs/ARCHITECTURE.md` for why these routes each re-verify auth themselves rather than inheriting it from a layout, and for `lib/core/weeklyPriority.ts` — the one place the non-negotiable "max 4 weekly priorities" transaction lives, shared between the web Server Action and the mobile route so the two surfaces can't drift on that rule.

| Method | Path | Purpose |
|---|---|---|
| POST | `/login` | `{ email, password }` → `{ token, expiresAt, user }` |
| GET | `/today?date=` | day's challenge/objective/tasks (defaults to today) |
| POST | `/today` | create a task on a given date |
| POST | `/tasks/:id/toggle` | toggle task completion |
| GET | `/week?date=` | week aggregation: goals, day summaries, habits, checklist |
| GET | `/goals?year=&month=` | year + month goals with progress |
| POST | `/goals` | create a goal (year/month/week level) |
| DELETE | `/goals/:id` | delete a goal |
| POST | `/goals/:id/priority` | toggle weekly priority (the capped, non-negotiable one) |
| POST | `/goals/:id/star` | toggle a year goal's "most important" star (uncapped) |
| GET | `/habits` | habits with streak/week/month stats |
| POST | `/habits` | create a habit |
| POST | `/habits/:id/toggle?date=` | toggle completion for a date (defaults to today) |
| PATCH | `/habits/:id` | `{ archived: boolean }` |
| DELETE | `/habits/:id` | delete a habit |
| POST | `/checklist/items` | add a checklist item |
| POST | `/checklist/items/:id/toggle` | toggle a checklist item |
| DELETE | `/checklist/items/:id` | delete a checklist item |
| GET | `/expenses?month=` | month's expenses + category breakdown |
| POST | `/expenses` | create an expense |
| DELETE | `/expenses/:id` | delete an expense |
| GET | `/dashboard` | aggregated stats mirroring the web dashboard |
| GET | `/review?date=` | week stats, goal progress, incomplete tasks, next-week day options, saved reflection |
| POST | `/review` | `{ weekId, ...sixReflectionFields }` → upsert the week's reflection |
| POST | `/tasks/:id/move-next-week` | move an incomplete task to next week's inbox |
| POST | `/tasks/:id/reschedule` | `{ date }` → move a task to a specific day |
| POST | `/tasks/:id/archive` | archive a task (still counts toward "planned") |
| GET | `/settings` | current preferences (name, week-start day, theme, working hours, currency, notifications) |
| POST | `/settings` | update preferences (server-validates enum/range fields, unlike the web `<select>`) |
| POST | `/logout` | revoke this device's session server-side (deletes the `Session` row for the bearer token) |
