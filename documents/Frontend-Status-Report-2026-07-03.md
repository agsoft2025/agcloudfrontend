# AG Cloud Frontend — Development Status Report

**Date:** July 3, 2026
**Branch:** `dev` (HEAD `d3b9c63` — Merge PR #8 bugfixing)
**Prepared by:** Claude Code (code review of actual source files)
**Previous report:** `documents/Frontend-Status-Report-2026-06-30.md`

---

## What Changed Since June 30

Three PRs merged between June 30 and July 3. The largest (`#8 bugfixing`) landed significant infrastructure
and UX work:

| Commit | Summary |
|---|---|
| `6c162a4` | Axios fully removed; `client.ts` upgraded; `call/[roomName]` page rewritten |
| `ee237c5` | Responsive fixes: sidebar iOS safe-area, `CallSession` rebuilt, `LiveKitClient` mobile-camera support |
| `d3b9c63` | Merge PR #8 — combines the above |

---

## Overall Progress at a Glance

| Area | Progress | Status |
|---|---|---|
| Auth screens | ✅ 100% | All 4 routes complete; cookie auth solid |
| Call flow (initiate / accept / end) | ✅ 97% | Unified controls for caller and receiver; two call sites still disable performance flags |
| LiveKit integration | ⚠️ 87% | Adaptive stream + dynacast correct in `LiveKitClient` defaults; still overridden at 2 call sites |
| Component library | ✅ 95% | `CallSession` rebuilt with full control surface |
| Routing | ✅ 100% | All 14 spec routes plus `/offline` |
| State management | ✅ 95% | All stores live; `console.debug` still in presence store |
| API layer | ✅ 95% | Native fetch, 30 s timeout, GET cache, deduplication; `user.api.ts` still missing `getProfile` |
| Theme system | ✅ 100% | Light / dark / system |
| PWA / Service Worker | ⚠️ 60% | Shell caching done; push handler still not implemented |
| Real-time / Socket.IO | ✅ 95% | Call signaling + presence fully wired |
| Firebase FCM | ⚠️ 70% | Token flow built; service worker push handler not implemented |
| Testing | ⚠️ 30% | E2E auth/home done; store + call unit tests still missing |

---

## What Was Fixed in This Cycle

### 1. `client.ts` — major infrastructure upgrade (`6c162a4`)

The native-fetch API client (`src/lib/api/client.ts`) was significantly extended:

- **30-second default timeout** on every request via `AbortController` — hangs no longer block the UI indefinitely.
- **In-flight deduplication** for GET requests — concurrent calls to the same URL share a single network round-trip.
- **Opt-in in-memory response cache** (`cacheTtlMs` on `apiGet`) with `invalidateCache(pattern)` for post-mutation cleanup.
- **Per-request signal + timeout overrides** — callers can pass `AbortSignal` and `timeoutMs` independently.
- **`createApiClient()` factory** for non-singleton use (e.g. test environments).
- `service/api.ts` updated to forward `timeoutMs` to `apiFetch`.

### 2. `LiveKitClient.ts` — mobile camera and connect redesign (`ee237c5`)

- **Removed hardcoded 1280×720 resolution** from `videoCaptureDefaults`. The previous constraint forced landscape crops on portrait-mode mobile cameras. Now the device captures at its natural aspect ratio.
- **`setCameraFacingMode(facing)`** — switches front/rear camera mid-call using `track.restartTrack()`, republishing seamlessly to remote participants.
- **`tokenProvider` callback** — connect now accepts a lazy `() => Promise<LiveKitTokenResponse>` so callers do not need to pre-fetch tokens.
- **`publishDefaults.audio/video`** — caller can opt-in to auto-publish tracks on connect without a separate `setMicrophoneEnabled` / `setCameraEnabled` call.
- `adaptiveStream: true, dynacast: true` remain as class defaults (unchanged).

### 3. `CallSession.svelte` — complete rebuild (`ee237c5`)

Previously a thin wrapper. Now a full-screen meeting room overlay with:

| Control | Notes |
|---|---|
| Mic mute / unmute | `ctrl-off` red state, error message surface |
| Camera on / off | `NotReadableError` fallback message |
| **Flip camera** | Mobile-only (hidden >640 px); uses `setCameraFacingMode()` |
| End call | Red pill, centered |
| Client-side recording | `MediaRecorder` (webm/vp8+opus); downloads on stop; also calls `startRecording`/`stopRecording` API |
| Add people | Modal with searchable contacts, per-user invite/rejected status, 4 s reset timer after rejection |
| Screen share | Toggle with active state |
| Raise hand | Broadcasts via `room.localParticipant.publishData()` |
| Video quality | 4-tier picker: Auto / Data Saver / HD 720p / Full HD 1080p |
| Fullscreen | `requestFullscreen()` on meeting room element |
| Spotlight layout | Auto-activates on pin or screen share; main + thumbnail strip (vertical sidebar on ≥1024 px) |
| Elapsed timer | `setInterval` from `session.initiatedAt`, `MM:SS` / `H:MM:SS` |
| Waiting overlay | Shown when no remote participants; fades in bottom-right |
| Control error bar | Dismissible banner above controls bar |
| Recording badge | Blinking `REC MM:SS` in header |

### 4. `call/[roomName]/+page.svelte` — rewritten to use `CallSession` (`6c162a4`)

Previously 503 lines with its own video grid and minimal controls. Now 277 lines that:
- Delegates entirely to `<CallSession>` — caller and receiver now have **identical controls**.
- Handles incoming-call overlay while in-call (second call arrives).
- Accepts LiveKit credentials from `activeCallStore` or fetches a fresh token if missing.
- Cleans up `bindCallEvents`, disconnects LiveKit, and resets stores on destroy.

### 5. `HomeSidebar.svelte` — responsive and iOS fixes (`ee237c5`)

- **Two-row footer** (user card row + controls row) replaces single horizontal row — long names like "Ajayanand Gummi" no longer get truncated.
- **iOS safe-area** via `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` — notch + home indicator are respected.
- **Mobile overlay drawer**: `position: fixed`, `z-index: 60`, `transform: translateX(-100%)` slide, semi-transparent backdrop at `z-index: 59`.
- `overflow-x: hidden; overflow-y: auto` split on `.sidebar` prevents footer clipping on iOS Safari.
- Contacts click while already on `/home` now toggles the drawer instead of re-navigating.

### 6. `auth.store.ts` — simplified (`6c162a4`)

Now uses `apiGet<AuthUser>('/auth/me')` directly and relies on the new client timeout to handle network failures — no custom retry logic needed.

---

## Route Status

| Route | Status | Notes |
|---|---|---|
| `/signin` | ✅ Done | Zod validation, cookie-based auth |
| `/signup` | ✅ Done | Display name, password strength |
| `/forgot-password` | ✅ Done | |
| `/reset-password` | ✅ Done | Token from URL param |
| `/home` | ✅ Done | 3-column contact dashboard; mobile tab bar |
| `/contacts` | ✅ Done | Search (300 ms debounce), presence dots |
| `/contacts/[id]` | ✅ Done | Profile card, presence, video/audio call, block/unblock |
| `/calls` | ✅ Done | History list, direction/type/duration/timestamp |
| `/calls/[id]` | ✅ Done | Call metadata, participant list with presence |
| `/call/[roomName]` | ✅ Done | Full `CallSession`: all controls, spotlight layout, responsive |
| `/settings/profile` | ✅ Done | Avatar upload, displayName Zod validation |
| `/settings/devices` | ✅ Done | Camera preview, mic meter, speaker test, hot-plug |
| `/settings/notifications` | ✅ Done | FCM enable/disable flow |
| `/settings/privacy` | ✅ Done | Blocked users, optimistic unblock + rollback |
| `/offline` | ✅ Done | Bonus route, not in spec |

> **Note:** `.bak` files remain committed under `src/routes/(auth)/` — not served but add noise.

---

## API Layer

| Module | Status | Notes |
|---|---|---|
| `lib/api/client.ts` | ✅ Done | Native fetch, `credentials: 'include'`, 30 s timeout, GET cache + dedup, `ApiError`, typed helpers |
| `lib/api/auth.api.ts` | ✅ Done | signIn / signUp / signOut / forgotPassword / resetPassword / getSession |
| `lib/api/calls.api.ts` | ✅ Done | initiate / accept / reject / end / get / addParticipant / startRecording / stopRecording |
| `lib/api/contacts.api.ts` | ✅ Done | getContacts (search), getCallHistory |
| `lib/api/user.api.ts` | ⚠️ Partial | Only `updateProfile` (PUT /users/me) — no `getProfile`. `userStore.hydrateProfile` calls `apiGet('/users/:id')` directly |
| `lib/api/notifications.api.ts` | ✅ Done | registerNotificationToken / unregisterNotificationToken |
| `lib/api/privacy.api.ts` | ✅ Done | getBlockedUsers / unblockUser |
| `lib/service/api.ts` | ✅ In use | `callApi` wrapper (POST) used by `LiveKitClient.ts` for token fetch; now forwards `timeoutMs` |

---

## State Management

| Store | Status | Notes |
|---|---|---|
| `authStore` | ✅ Done | Cookie-driven; `apiGet('/auth/me')` with 30 s timeout |
| `activeCallStore` | ✅ Done | State machine: idle → outgoing-ringing → incoming-ringing → connecting → in-call; incoming invite queue |
| `callStore` | ✅ Done | LiveKit room snapshot; optimised `setActiveSpeakers` |
| `presenceStore` | ⚠️ Done | Polls every 15 s; WebSocket updates; **6 `console.debug` calls remain** (lines 100, 117, 130, 165, 168, 214) |
| `themeStore` | ✅ Done | light/dark/system, OS listener |
| `toastStore` | ⚠️ Partial | Store implemented; **`Toast.svelte` still not mounted in `routes/+layout.svelte`** — all toast calls silently dropped |
| `userStore` | ✅ Done | Profile cache, lazy hydration |
| `notificationStore` | ✅ Done | FCM permission state, localStorage |
| `privacyStore` | ✅ Done | Optimistic unblock + rollback |
| `contactsDrawerStore` | ✅ Done | Boolean open/close for contacts drawer |
| `devicePreferences` | ✅ Done | camera/mic/speaker IDs persisted to localStorage |

---

## Real-Time Layer

| Feature | Status | Notes |
|---|---|---|
| Socket.IO client | ✅ Done | Singleton, `withCredentials: true`, auto-reconnect |
| Call signaling | ✅ Done | 8 Socket.IO events drive `activeCallStore` |
| Presence via socket | ✅ Done | 4 events forwarded to `presenceStore` |
| Ringtone / ringback | ✅ Done | `lib/realtime/ringtone.ts` |
| Firebase FCM token | ✅ Done | Lazy init; graceful degradation |
| **Service worker push handler** | ❌ Missing | `push` event not implemented — incoming call notifications when app is backgrounded/closed will not fire |

---

## LiveKit Integration

| Feature | Status | Notes |
|---|---|---|
| `LiveKitClient` class | ✅ Done | Singleton; `adaptiveStream: true, dynacast: true` in class defaults |
| Camera capture (no resolution lock) | ✅ Fixed | Hardcoded 1280×720 removed; natural orientation preserved on mobile |
| VP8 simulcast (H180/360/720) | ✅ Done | On `setCameraEnabled` |
| `setCameraFacingMode()` | ✅ New | Front/rear switch via `restartTrack()` |
| `tokenProvider` callback | ✅ New | Lazy token fetch on connect |
| Audio output selection | ✅ Done | `lib/livekit/audio-output.ts` |
| **`adaptiveStream`/`dynacast` overrides** | ❌ P0 Bug | `GlobalCallManager.svelte:110` and `CallWorkspace.svelte:92` still pass `roomOptions: { adaptiveStream: false, dynacast: false }` — overriding class defaults and disabling adaptive quality for all calls |
| `lib/service/livekit.ts` | ⚠️ Dead code | Empty/deprecated stub — safe to delete |
| Full-screen call page | ✅ Done | Responsive grid → spotlight layout; both paths use `CallSession` |

---

## Component Library

### Atoms (`lib/components/atoms/`)
All 9: `Button`, `Input`, `Avatar`, `Badge`, `Skeleton`, `Spinner`, `NetworkIndicator`, `PasswordStrength`, `ThemeToggle`.

### Molecules (`lib/components/molecules/`)
All: `Modal`, `Toast`, `VideoTile`, `CallControls`, `IncomingCallOverlay`, `ParticipantList`, `DropdownMenu`, `ButtonDropdown`.

> **Toast is built but never rendered** — it is not mounted in the root layout.

### Call Components (`lib/components/calls/`)
`CallSession` (fully rebuilt), `CallWorkspace`, `AcceptCallForm`, `LocalMediaPreview`, `ParticipantTile`, `LiveKitTrack`, `CallStatus`, `CallTypeToggle`, `RoomIdChip`, `GlobalCallManager`, `IncomingCallNotifications`.

### Home Components (`lib/components/home/`)
`HomeSidebar` (responsive + iOS safe-area fix), `ContactList`, `ContactDetail`, `RecentCalls`, `NavItem`, `SettingsNavItem`.

---

## Remaining Issues

### P0 — Must fix before production

| # | Issue | Location | Fix |
|---|---|---|---|
| 1 | **Toast never rendered** | `src/routes/+layout.svelte` | Add `import Toast from '$lib/components/molecules/Toast.svelte'` and `<Toast />` above or below `<OfflineBanner />`. One-line change — affects every toast call in the app. |
| 2 | **`adaptiveStream`/`dynacast` disabled** | `GlobalCallManager.svelte:110`, `CallWorkspace.svelte:92` | Remove `roomOptions: { adaptiveStream: false, dynacast: false }` from both `liveKitClient.connect()` calls. `LiveKitClient` already defaults both to `true`. |
| 3 | **Service worker push handler missing** | `service-worker.ts` | Implement `self.addEventListener('push', ...)` so device receives incoming call notifications when the app is closed or backgrounded. |

### P1 — Important before launch

| # | Issue | Location | Fix |
|---|---|---|---|
| 4 | **`console.debug` in production** | `stores/presence.store.ts` (6 calls) | Remove all `console.debug` calls — they leak user presence data to the browser console. |
| 5 | **Dead code** | `lib/service/livekit.ts` | Delete file (empty stub, confirmed). |
| 6 | **`.bak` files committed** | `routes/(auth)/forgot-password/`, `reset-password/`, `signin/`, `signup/` | Delete all 4 `.bak` files. |
| 7 | **`user.api.ts` missing `getProfile`** | `lib/api/user.api.ts` | Add `getProfile(userId)` → `GET /users/:id`. Currently `userStore.hydrateProfile` calls `apiGet` directly, bypassing the API module. |
| 8 | **`alert()` in recording error path** | `CallSession.svelte:235` | `startRecordingMedia` calls `alert('No active media tracks…')` which blocks the main thread. Replace with `toastStore.error(…)` — once Toast is mounted (P0 #1). |

### P2 — Polish / nice to have

| # | Issue | Notes |
|---|---|---|
| 9 | **`formatDuration` dead branch** | `routes/calls/[id]/+page.svelte:79` — both branches of `endTs` ternary return `Date.now()`, so ended calls always show time-since-creation. Use `call.endedAt` or `call.updatedAt` for ended/missed/rejected calls. |
| 10 | **Client-side recording only** | `CallSession.svelte` uses `MediaRecorder` on the local device — only the caller's machine captures the recording. The API calls to `startRecording`/`stopRecording` suggest server-side recording is planned. Clarify intended architecture. |
| 11 | **Store unit tests** | `auth.store`, `call.store`, `active-call.store`, `presence.store` still untested. |
| 12 | **Lighthouse / bundle audit** | Target: <80 KB initial JS per spec. Not yet measured. |

---

## Environment Variables Required

```
# Backend
VITE_API_BASE_URL=http://localhost:3000

# LiveKit (must be ws:// or wss://)
VITE_LIVEKIT_URL=ws://localhost:7880

# Firebase FCM
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

Missing Firebase vars degrade gracefully — push notifications silently disabled, rest of app unaffected.

---

## Dependency Overview

| Package | Type | Purpose |
|---|---|---|
| `livekit-client` ^2.19 | runtime | WebRTC room management |
| `socket.io-client` ^4.8 | runtime | Real-time call signaling + presence |
| `zod` ^4.4 | runtime | Form validation |
| `@firebase/app` + `@firebase/messaging` | runtime | FCM push tokens (lazy-initialised) |
| `@picocss/pico` | devDep | Base CSS reset |
| `vitest` + `@testing-library/svelte` | devDep | Unit tests |
| `@playwright/test` | devDep | E2E tests |

No `axios` — confirmed removed.

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

```bash
npm run test:unit    # Vitest
npm run test:e2e     # build + Playwright
npm run test         # both
```
