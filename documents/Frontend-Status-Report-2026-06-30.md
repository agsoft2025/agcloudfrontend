# AG Cloud Frontend — Development Status Report

**Date:** June 30, 2026 (updated July 3, 2026)
**Branch:** `dev`
**Prepared by:** Claude Code (code review of actual source files)
**Previous report:** `documents/Frontend-Status-Report.md` (June 14, 2026, by Venkat)

---

## Summary of Progress Since June 14

Significant work has landed on `dev` since the previous report. The most important changes:

- **Auth token issue resolved** — API client migrated from `axios` to native `fetch` with `credentials: 'include'`, letting the httpOnly session cookie flow automatically. No more manual `Authorization` header injection.
- **All 14 routes now exist** — `/contacts`, `/contacts/[id]`, `/calls`, `/calls/[id]`, `/call/[roomName]`, all five `/settings/*` pages, and `/offline` are implemented.
- **Real-time signaling wired** — Socket.IO client (`socket.ts`) and call lifecycle event handler (`call-signaling.ts`) are live and drive the `activeCallStore` state machine for both caller and callee.
- **Firebase FCM integrated** — `src/lib/firebase/messaging.ts` handles push token registration with graceful degradation when env vars are missing.
- **Presence store implemented** — polls `GET /users/presence` every 15 seconds and accepts real-time updates from Socket.IO `USER_ONLINE` / `USER_OFFLINE` / `USER_AWAY` / `PRESENCE_UPDATED` events.

---

## Overall Progress at a Glance

| Area | Progress | Status |
|---|---|---|
| Auth screens | ✅ 100% | All 4 routes complete; cookie auth resolved |
| Call flow (initiate / accept / end) | ✅ 95% | Fully wired via Socket.IO; performance flags still off in legacy path |
| LiveKit integration | ⚠️ 85% | Core solid; `adaptiveStream`/`dynacast` disabled in 2 of 3 connect sites |
| Component library | ✅ 90% | All atoms + molecules built; minor gaps only |
| Routing | ✅ 100% | All 14 spec routes plus `/offline` exist |
| State management | ✅ 95% | All 8 stores implemented; `console.debug` calls in presence store |
| API layer | ✅ 90% | All major APIs done; `user.api.ts` only has `updateProfile` (no `getProfile`) |
| Theme system | ✅ 100% | Light / dark / system |
| PWA / Service Worker | ⚠️ 60% | Shell caching done; push handler incomplete |
| Real-time / Socket.IO | ✅ 95% | Call signaling + presence fully wired |
| Firebase FCM | ⚠️ 70% | Token flow built; service worker push handler not implemented |
| Testing | ⚠️ 30% | E2E auth/home done; store + call unit tests still missing |

---

## Route Status

| Route | File | Status | Notes |
|---|---|---|---|
| `/signin` | `routes/signin/+page.svelte` | ✅ Done | Zod validation, cookie-based auth |
| `/signup` | `routes/signup/+page.svelte` | ✅ Done | Display name, password strength |
| `/forgot-password` | `routes/forgot-password/+page.svelte` | ✅ Done | |
| `/reset-password` | `routes/reset-password/+page.svelte` | ✅ Done | Token from URL param |
| `/home` | `routes/home/+page.svelte` | ✅ Done | `CallWorkspace` + `HomeSidebar` shell |
| `/contacts` | `routes/contacts/+page.svelte` | ✅ Done | Search, presence dots, links to detail |
| `/contacts/[id]` | `routes/contacts/[id]/+page.svelte` | ✅ Done | Full profile card: avatar, presence, email, role, video/audio call buttons, block/unblock |
| `/calls` | `routes/calls/+page.svelte` | ✅ Done | History list with direction/type/duration |
| `/calls/[id]` | `routes/calls/[id]/+page.svelte` | ✅ Done | Call metadata (type/mode/status/room), participant list with presence; `formatDuration` has a dead-branch bug (see P2) |
| `/call/[roomName]` | `routes/call/[roomName]/+page.svelte` | ✅ Done | Full-screen video grid, participant sidebar, controls bar |
| `/settings` | `routes/settings/+layout.svelte` | ✅ Done | Sidebar nav to all settings sub-pages |
| `/settings/profile` | `routes/settings/profile/+page.svelte` | ✅ Done | Avatar upload (2 MB limit, blob preview), displayName edit with Zod, read-only email |
| `/settings/devices` | `routes/settings/devices/+page.svelte` | ✅ Done | Camera preview, live mic level meter (28-segment), speaker test tone, hot-plug, loading skeleton |
| `/settings/notifications` | `routes/settings/notifications/+page.svelte` | ✅ Done | FCM enable/disable flow; syncs permission state on mount; graceful degradation when FCM not configured |
| `/settings/privacy` | `routes/settings/privacy/+page.svelte` | ✅ Done | Blocked users list; optimistic unblock + rollback via `privacyStore` |
| `/offline` | `routes/offline/+page.svelte` | ✅ Exists | (bonus — not in spec) |

> **Note:** `.bak` files remain committed under `src/routes/(auth)/` (4 files). These are not served but add noise to git history and `check` output. Delete them.

---

## API Layer

| Module | File | Status | Notes |
|---|---|---|---|
| HTTP client | `lib/api/client.ts` | ✅ Done | Native fetch, `credentials: 'include'`, `ApiError` class, typed helpers |
| Auth | `lib/api/auth.api.ts` | ✅ Done | signIn/signUp/signOut/forgot/reset/getSession |
| Calls | `lib/api/calls.api.ts` | ✅ Done | initiate/accept/reject/end/get/addParticipant/startRecording/stopRecording |
| Contacts | `lib/api/contacts.api.ts` | ✅ Done | getContacts (with search), getCallHistory |
| User | `lib/api/user.api.ts` | ⚠️ Partial | Only `updateProfile` (PUT /users/me) — no `getProfile` (GET /users/:id). `user.store` uses its own fallback via `apiGet('/users/:id')` directly |
| Notifications | `lib/api/notifications.api.ts` | ✅ Done | registerNotificationToken / unregisterNotificationToken |
| Privacy | `lib/api/privacy.api.ts` | ✅ Done | getBlockedUsers / unblockUser |

**Auth strategy:** The client sends `credentials: 'include'` on every request — no `Authorization` header. Auth is entirely cookie-driven. The previous token/localStorage mismatch is resolved.

---

## State Management

| Store | File | Status | Notes |
|---|---|---|---|
| `authStore` | `stores/auth.store.ts` | ✅ Done | Verifies session via `GET /auth/me` on mount; cookie-driven |
| `activeCallStore` | `stores/active-call.store.ts` | ✅ Done | Full call state machine (idle → outgoing-ringing → connecting → in-call) + incoming invite queue |
| `callStore` | `stores/call.store.ts` | ✅ Done | LiveKit room state snapshot (participants, tracks, speakers); optimised `setActiveSpeakers` avoids video tile re-renders |
| `presenceStore` | `stores/presence.store.ts` | ✅ Done | Polls every 15 s; accepts WebSocket updates; handles 4 API response shapes; has leftover `console.debug` calls |
| `themeStore` | `stores/theme.store.ts` | ✅ Done | light/dark/system, OS listener, localStorage |
| `toastStore` | `stores/toast.store.ts` | ⚠️ Partial | Store implemented; **`Toast.svelte` is not mounted in root `+layout.svelte`** — toasts are silently dropped |
| `userStore` | `stores/user.store.ts` | ✅ Done | Profile cache with localStorage persistence and `hydrateProfile` lazy-loading |
| `notificationStore` | `stores/notification.store.ts` | ✅ Done | FCM permission state, token management, localStorage persistence |
| `privacyStore` | `stores/privacy.store.ts` | ✅ Done | Blocked user list with optimistic unblock + rollback |
| `contactsDrawerStore` | `stores/contacts-drawer.store.ts` | ✅ Done | Boolean open/close for the contacts drawer on `/home`; imported by `home/+page.svelte` |
| `devicePreferences` | `stores/device-preferences.ts` | ✅ Done | Persists selected camera/mic/speaker IDs to localStorage; `setCamera/setMicrophone/setSpeaker` helpers; used by `/settings/devices` and `LiveKitClient` |

---

## Real-Time Layer

| Feature | File | Status | Notes |
|---|---|---|---|
| Socket.IO client | `lib/realtime/socket.ts` | ✅ Done | Singleton; connects with `withCredentials: true`; reconnects on drop |
| Call signaling | `lib/realtime/call-signaling.ts` | ✅ Done | Handles `call:incoming`, `call:accepted`, `call:rejected`, `call:cancelled`, `call:ended`, `call:participant-joined/rejected` |
| Presence via socket | `lib/realtime/call-signaling.ts` | ✅ Done | `USER_ONLINE`, `USER_OFFLINE`, `USER_AWAY`, `PRESENCE_UPDATED` events forwarded to `presenceStore` |
| Ringtone / ringback | `lib/realtime/ringtone.ts` | ✅ Exists | |
| Firebase FCM token | `lib/firebase/messaging.ts` | ✅ Done | Lazy init; graceful degradation when env vars missing; `isMessagingSupported()` pre-flight check |
| Service worker push handler | (service-worker.ts) | ❌ Missing | `push` event listener not implemented — device push for incoming calls when app is closed/backgrounded will not work |

**Lifecycle:** `GlobalCallManager.svelte` (mounted in the `(app)` layout) initialises `initCallSignaling()` on mount, which connects the socket and registers all event handlers. Presence polling is started per-page (e.g. `/contacts` calls `presenceStore.startPolling()` on mount).

---

## LiveKit Integration

| Feature | Status | Notes |
|---|---|---|
| `LiveKitClient` class | ✅ Done | Singleton `liveKitClient`; `adaptiveStream: true, dynacast: true` set as class defaults |
| Camera / mic / screen share | ✅ Done | VP8 simulcast, H180/H360/H720 layers, `NotReadableError` fallback |
| `useCall` / `bindCallEvents` | ✅ Done | 16 `RoomEvent` handlers sync to `callStore` |
| Audio output selection | ✅ Done | `lib/livekit/audio-output.ts` |
| **adaptiveStream / dynacast** | ⚠️ Bug | `LiveKitClient.connect()` defaults to `true`, but **`GlobalCallManager.svelte` and `CallWorkspace.svelte`** pass `roomOptions: { adaptiveStream: false, dynacast: false }` — overriding the class defaults. These two call sites must remove the override. |
| `lib/service/livekit.ts` | ⚠️ Dead code | Marked `@deprecated` and empty — safe to delete. Only `LiveKitClient.ts` is the canonical implementation. |
| `lib/service/api.ts` | ✅ In use | Second HTTP wrapper (`callApi`) used exclusively by `LiveKitClient.ts` for the `getLiveKitToken()` POST. Not dead code. |
| Full-screen `/call/[roomName]` route | ✅ Done | Responsive grid (1→2→3 columns by participant count); desktop sidebar + mobile drawer |

---

## Component Library

### Atoms (`lib/components/atoms/`)
All 9 planned atoms are built: `Button`, `Input`, `Avatar`, `Badge`, `Skeleton`, `Spinner`, `NetworkIndicator`, `PasswordStrength`, `ThemeToggle`.

### Molecules (`lib/components/molecules/`)
All planned molecules are built: `Modal`, `Toast`, `VideoTile`, `CallControls`, `IncomingCallOverlay`, `ParticipantList`, `DropdownMenu`, `ButtonDropdown`.

`examples/` subfolder contains usage demonstrations — these are for development reference only and are not imported by any route.

### Call Components (`lib/components/calls/`)
`CallWorkspace`, `CallSession`, `AcceptCallForm`, `LocalMediaPreview`, `ParticipantTile`, `LiveKitTrack`, `CallStatus`, `CallTypeToggle`, `RoomIdChip`, `GlobalCallManager`, `IncomingCallNotifications`.

### Home Components (`lib/components/home/`)
`HomeSidebar`, `ContactList`, `ContactDetail`, `RecentCalls`, `NavItem`, `SettingsNavItem`.

`ContactList` is now built (was missing in June 14 report).

---

## Remaining Issues

### P0 — Must fix before production

| # | Issue | Location | Fix |
|---|---|---|---|
| 1 | **Toast not rendered** | `routes/+layout.svelte` | Mount `<Toast />` in root layout — one-line fix |
| 2 | **`adaptiveStream`/`dynacast` disabled** | `GlobalCallManager.svelte:110`, `CallWorkspace.svelte:94` | Remove `roomOptions: { adaptiveStream: false, dynacast: false }` from both `connectLiveKit` calls |
| 3 | **Service worker push handler missing** | `service-worker.ts` | Implement `push` event listener so incoming call notifications work when app is backgrounded |

### P1 — Important before launch

| # | Issue | Location | Fix |
|---|---|---|---|
| 4 | **`console.debug` in production code** | `stores/presence.store.ts` (lines 101, 119, 122, 132, 168, 172) | Remove all `console.debug` calls |
| 5 | **Dead code** | `lib/service/livekit.ts` | Delete file |
| 6 | **`.bak` files committed** | `routes/(auth)/forgot-password/`, `reset-password/`, `signin/`, `signup/` | Delete all 4 `_page.svelte.bak` files |
| 7 | **`user.api.ts` missing `getProfile`** | `lib/api/user.api.ts` | Add `getProfile(userId)` — `userStore.hydrateProfile` currently calls `apiGet('/users/:id')` directly instead of going through the API module |

### P2 — Polish / nice to have

| # | Issue | Notes |
|---|---|---|
| 8 | Store unit tests | `auth.store`, `call.store`, `active-call.store`, `presence.store` all untested |
| 9 | **`formatDuration` dead branch in `/calls/[id]`** | `calls/[id]/+page.svelte:79` — `const endTs = call.status === 'ended' \|\| ... ? Date.now() : Date.now()` — both branches return `Date.now()`, so ended calls show time-since-created instead of actual duration. Should use `call.endedAt` or `call.updatedAt` for ended/missed/rejected states. |
| 10 | Lighthouse / bundle audit | Target: <80 KB initial JS per spec |

---

## Environment Variables Required

```
# Backend
VITE_API_BASE_URL=http://localhost:3000   # or production URL

# LiveKit (must be ws:// or wss://, not http://)
VITE_LIVEKIT_URL=ws://localhost:7880

# Firebase FCM (all required for push notifications)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

If any Firebase var is missing, FCM degrades gracefully — push notifications are silently disabled, the rest of the app works normally.

---

## Dependency Overview

| Package | Type | Purpose |
|---|---|---|
| `livekit-client` ^2.19 | runtime | WebRTC room management |
| `socket.io-client` ^4.8 | runtime | Real-time call signaling + presence |
| `zod` ^4.4 | runtime | Form validation on auth pages |
| `@firebase/app` + `@firebase/messaging` | runtime | FCM push tokens (lazy-initialised) |
| `@picocss/pico` | devDep | Base CSS reset / utility layer |
| `vitest` + `@testing-library/svelte` | devDep | Unit tests |
| `@playwright/test` | devDep | E2E tests |

No `axios` — confirmed removed. API layer uses native `fetch`.

---

## Test Coverage

| Test | File | Status |
|---|---|---|
| E2E: auth flows | `tests/e2e/auth.spec.ts` | ✅ Done |
| E2E: home page | `tests/e2e/home.spec.ts` | ✅ Done |
| Unit: modal | `tests/unit/modal.test.ts` | ✅ Done |
| Unit: auth header | `tests/unit/auth-header.test.ts` | ✅ Done |
| Unit: index | `tests/unit/index.test.ts` | ✅ Done |
| Unit: auth/call/presence stores | — | ❌ Missing |
| Unit: call flow components | — | ❌ Missing |
| E2E runner script | `scripts/run-e2e.mjs` | ✅ Done |

Run tests:
```bash
npm run test:unit          # Vitest (unit)
npm run test:e2e           # build + Playwright
npm run test               # both
```
