# Planner Mobile

The Phase 6 mobile client for the [Planner](C:\programming\Planner) web app. Talks to that app's `/api/mobile/*` Route Handlers over HTTP — it does not connect to Postgres directly, and shares no code with the web app yet (see "Code sharing" below).

## Scope (this pass)

Auth + one real screen, per the roadmap's "scaffold it now" instruction — not the full Phase 6:

- **Built:** login, and a Today screen (challenge, objective, task list, tap-to-complete).
- **Not built:** signup (create an account via the web app's `/signup` first), offline-first local persistence/sync, push notifications. These are the rest of Phase 6 — this pass is the foundation, not the finish.

## Running it

1. The Planner web app must be running on `http://localhost:3100` (`cd ../Planner && npm run dev`) — this app has no backend of its own.
2. `npm install`
3. `npm run web` for the browser target, or `npm run android` / `npm run ios` for a device/emulator.

**If you're running on a physical device or emulator, not `--web`:** edit `API_BASE_URL` in `src/api.ts`. It's hardcoded to `http://localhost:3100`, which only resolves correctly when the app itself is *also* running in a browser on the same machine (`expo start --web`). A phone or emulator can't reach your dev machine via `localhost` — replace it with your machine's LAN IP, e.g. `http://192.168.1.23:3100`. This is the single most likely thing to cost you a debugging session if missed.

## What's verified vs. not

This environment has no Android SDK, no `adb`, no Java, and no physical device — so **only the `expo start --web` target (react-native-web) has actually been run and tested**, via a scripted Playwright pass against `http://localhost:8082`: login with wrong credentials shows the server's error, login with correct credentials reaches the Today screen and shows a seeded task, tapping the task persists after a hard reload (not just a local re-render), zero console errors.

Not verified in this environment, and worth treating as unproven until someone runs it on real hardware:
- Native `expo-secure-store` token storage (`src/tokenStorage.ts` branches to `localStorage` on web — that's the path actually tested; the native branch is correct per Expo's docs but has never executed).
- Native navigation gestures, safe-area insets, keyboard behavior.
- Anything Android/iOS-specific in general.

## Why no router

Two screens (login, today) gated by "do we have a stored token" — see `App.tsx` — which is less machinery than wiring `expo-router` (install, `app/` directory restructure, `app.json` plugin, new entry point) for something this small. Add `expo-router` when a third screen needs real navigation (a week view, settings, task detail) rather than before.

## Code sharing with the web app

None yet. The web app's pure logic (`lib/date/week.ts`, `lib/habits.ts`, `lib/progress.ts`, etc.) has no Next.js/DOM dependency and could in principle be extracted into a shared package once both apps' shapes stabilize — but that's an npm/pnpm workspace restructuring of the *web* repo too, and premature before this app has more than one screen. Not done in this pass; noted as the natural next step if development continues.

## `npm audit`

A fresh `create-expo-app` scaffold reports ~18 findings (7 moderate, 11 high) — all inside Expo's own dev-time bundler toolchain (`metro`, `@expo/cli`, `image-size`), not runtime code shipped in the app. `npm audit fix --force` would downgrade `expo` from SDK 57 to 53, a major breaking change to the exact SDK version this app was built against — left alone deliberately, same reasoning as the pre-existing `deepmerge-ts` finding in the web app's `prisma` dependency (see that project's `ROADMAP.md`).

## API surface it depends on (web app side)

- `POST /api/mobile/login` — `{ email, password }` → `{ token, expiresAt, user }`
- `GET /api/mobile/today` — `Authorization: Bearer <token>` → today's challenge/objective/tasks
- `POST /api/mobile/tasks/:id/toggle` — `Authorization: Bearer <token>` → toggles completion

All three live in `../Planner/src/app/api/mobile/`, auth via the same `Session` table the web app's cookie-based auth uses (`getSessionUserIdForToken` in `../Planner/src/lib/auth/session.ts`) — a mobile login and a web login are the same kind of row, just handed to the client differently. See `../Planner/docs/ARCHITECTURE.md` for why these routes each re-verify auth themselves rather than inheriting it from a layout.
