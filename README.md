# Planner Mobile

The Phase 6 mobile client for the [Planner](C:\programming\Planner) web app. Talks to that app's `/api/mobile/*` Route Handlers over HTTP — it does not connect to Postgres directly, and shares no code with the web app yet (see "Code sharing" below).

## Scope (this pass)

Phase 6 is being built in an agreed order: **screens first**, then offline sync, push notifications, and code sharing as separate later passes (see the web app's `docs/ROADMAP.md`).

- **Built this pass:** login, and six screens — Dashboard, Today (with day navigation and inline task creation), Week (priority goals with the star toggle, a 7-day summary that opens into Today, the habit tracker grid, the weekly checklist), Goals (year + month, add/delete/star), Habits (create/toggle/archive/restore/delete with streak and completion stats), Expenses (month view, category breakdown, add/delete).
- **Not built:** signup (create an account via the web app's `/signup` first), Settings, the Weekly Review screen (reflection form + week-transition triage — the most complex remaining screen, deliberately deferred), offline-first local persistence/sync, push notifications, code sharing with the web app. Drag-and-drop was not ported either — native mobile UIs don't really want desktop drag-and-drop anyway; the Week screen's day rows link into Today instead.

## Running it

1. The Planner web app must be running on `http://localhost:3100` (`cd ../Planner && npm run dev`) — this app has no backend of its own.
2. `npm install`
3. `npm run web` for the browser target, or `npm run android` / `npm run ios` for a device/emulator.

**If you're running on a physical device or emulator, not `--web`:** edit `API_BASE_URL` in `src/api.ts`. It's hardcoded to `http://localhost:3100`, which only resolves correctly when the app itself is *also* running in a browser on the same machine (`expo start --web`). A phone or emulator can't reach your dev machine via `localhost` — replace it with your machine's LAN IP, e.g. `http://192.168.1.23:3100`. This is the single most likely thing to cost you a debugging session if missed.

## What's verified vs. not

This environment has no Android SDK, no `adb`, no Java, and no physical device — so **only the `expo start --web` target (react-native-web) has actually been run and tested**, via scripted Playwright passes against `http://localhost:8082` covering every screen: sign in (wrong-password rejection + success), Today (seeded task/challenge visible, day-nav round-trip preserves state, inline task creation), Week (weekly goal visible and starrable with the priority count updating, day summary rows, checklist add), Goals (year goal visible, add a second one), Habits (create), Expenses (seeded expense + total + breakdown visible), Dashboard (aggregated stats reflect the week goal). A server-side cross-check via a direct `/api/mobile/dashboard` call (not the UI) confirmed the mobile-created task actually persisted. Zero console errors across all of it.

Not verified in this environment, and worth treating as unproven until someone runs it on real hardware:
- Native `expo-secure-store` token storage (`src/tokenStorage.ts` branches to `localStorage` on web — that's the path actually tested; the native branch is correct per Expo's docs but has never executed).
- Native navigation gestures, safe-area insets, keyboard behavior, and how the six-tab bottom bar actually feels on a real small screen (it was only ever viewed at a fixed 420×900 browser viewport).
- Anything Android/iOS-specific in general.

## Why no router

Six tabs (Dashboard, Today, Week, Goals, Habits, Expenses) gated by simple `useState` in `App.tsx` — no nested navigation, no back-stacks, no deep links. This is less machinery than wiring `expo-router` for a shape this flat. Add `expo-router` when a screen needs its own back-stack (e.g. a task-detail screen pushed from Today) rather than before.

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
