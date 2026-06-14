# agcloud Frontend (Web) — Development Status Report

**Date:** June 14, 2026
**Repo:** `agsoft2025/agcloudfrontend` — `dev` branch (commit `521cfc8`)
**Reference spec:** `documents/Frontend-Specification.md`
**Prepared by:** Venkat

---

## Overall Progress at a Glance

| Area | Progress | Status |
|---|---|---|
| Auth screens | 90% | All 4 screens implemented; token mismatch with backend |
| Call flow (initiate / accept / end) | 75% | Works in browser; push-driven incoming calls not wired |
| LiveKit integration | 70% | Client solid; duplicate implementations; no dedicated call route |
| Component library | 65% | Atoms and molecules built; ContactList missing |
| Routing | 40% | Auth + Home only; Contacts / Call History / Settings all missing |
| State management | 70% | Auth, call, theme, toast done; presence store missing |
| API layer | 60% | Auth + call APIs done; user/contacts API missing; refresh flow broken |
| Theme system | 100% | Light / dark / system fully working |
| PWA / Service Worker | 50% | Shell caching done; push notifications not implemented |
| Testing | 30% | E2E auth + home tests; no store or call unit tests |

---

## What Is Working Today

The following can be used in a browser right now (with backend on `localhost:3000`):

- Sign in, sign up, forgot password, reset password — all forms work end-to-end
- Protected route guards redirect unauthenticated users to `/signin` and vice-versa
- Light / dark / system theme toggle, persisted across page reloads
- **Initiate a call** by typing a user ID → generates LiveKit room, connects audio/video
- **Accept a call** by entering a call ID → connects the callee's camera/microphone
- Mute/unmute microphone, enable/disable camera during an active call
- Screen share (implemented in LiveKit client)
- End call (sends API request and disconnects LiveKit room)
- Call recording toggle (sends `recording: true` to the backend)
- Camera-unavailable detection with retry button
- Automatic call cleanup when the remote peer disconnects (one-to-one mode)

---

## Screen / Route Status

Spec defines 14 routes. Current state:

| Route | Status | Notes |
|---|---|---|
| `/signin` | ✅ Done | Zod validation, error handling, redirect on success |
| `/signup` | ✅ Done | Display name, email, password with strength indicator |
| `/forgot-password` | ✅ Done | Sends request, shows neutral confirmation message |
| `/reset-password` | ✅ Done | Token from URL param, password update |
| `/home` | ⚠️ Partial | Only shows call workspace — no recents list, no search, no presence dots |
| `/contacts` | ❌ Missing | No route, no page, no component |
| `/contacts/:id` | ❌ Missing | |
| `/calls` (history) | ❌ Missing | No route, no page |
| `/calls/:id` | ❌ Missing | |
| `/call/:roomName` | ❌ Missing | Spec requires a dedicated full-screen call page; call is rendered inside `/home` |
| `/settings` | ❌ Missing | |
| `/settings/profile` | ❌ Missing | |
| `/settings/devices` | ❌ Missing | Microphone/camera/speaker chooser |
| `/settings/notifications` | ❌ Missing | |
| `/settings/privacy` | ❌ Missing | |

> **Note:** There are stale `.bak` files committed to the repo under `src/routes/(app)/` and `src/routes/(auth)/` — these should be deleted.

---

## Component Library Status

### Atoms

| Component | Status | Notes |
|---|---|---|
| `Button.svelte` | ✅ Done | Variants, sizes, loading state, icon slots |
| `Input.svelte` | ✅ Done | Label, error, disabled, password toggle |
| `Avatar.svelte` | ✅ Done | Initials fallback, size variants |
| `Badge.svelte` | ✅ Done | |
| `Skeleton.svelte` | ✅ Done | Shimmer animation for loading states |
| `Spinner.svelte` | ✅ Done | |
| `NetworkIndicator.svelte` | ✅ Done | Signal strength visualization |
| `PasswordStrength.svelte` | ✅ Done | Used on signup page |
| `ThemeToggle.svelte` | ✅ Done | Light/dark/system cycle |

### Molecules

| Component | Status | Notes |
|---|---|---|
| `Modal.svelte` | ✅ Done | Focus trap, escape to close, portal rendering |
| `Toast.svelte` | ✅ Done | Component built; not yet wired to root layout |
| `VideoTile.svelte` | ✅ Done | Track attachment, mute overlay, participant label |
| `CallControls.svelte` | ✅ Done | Mute, video, screen share, end call buttons |
| `IncomingCallOverlay.svelte` | ✅ Built | Full ARIA-compliant modal with pulse rings; **not wired to any notification channel** |
| `ParticipantList.svelte` | ✅ Done | Sidebar list of call participants |
| `DropdownMenu.svelte` | ✅ Done | |
| `ButtonDropdown.svelte` | ✅ Done | |
| `ContactList` | ❌ Missing | Required for `/contacts` and home recents — not started |

### Call-Specific Components

| Component | Status | Notes |
|---|---|---|
| `CallWorkspace.svelte` | ✅ Done | Main call initiation + accept UI |
| `CallSession.svelte` | ✅ Done | Active call view with participant video grid |
| `AcceptCallForm.svelte` | ✅ Done | Accept incoming call by entering call ID |
| `LocalMediaPreview.svelte` | ✅ Done | Shows local camera before connecting |
| `ParticipantTile.svelte` | ✅ Done | Individual participant video cell |
| `LiveKitTrack.svelte` | ✅ Done | Svelte action for attaching media tracks to DOM |
| `CallStatus.svelte` | ✅ Done | Status/error banner inside workspace |
| `CallTypeToggle.svelte` | ✅ Done | Audio / video switcher |
| `RoomIdChip.svelte` | ✅ Done | Displays active room ID with copy button |

---

## LiveKit Integration Status

| Feature | Status | Notes |
|---|---|---|
| `LiveKitClient.ts` — connect/disconnect | ✅ Done | Singleton, proper cleanup on disconnect |
| Camera enable/disable | ✅ Done | With `NotReadableError` fallback for in-use cameras |
| Microphone enable/disable | ✅ Done | |
| Screen share enable/disable | ✅ Done | |
| Remote track subscription | ✅ Done | Auto-subscribes on participant join |
| Room event binding (`useCall`) | ✅ Done | 16 room events wired to `call.store` |
| Speaker/audio output selection | ✅ Done | `audio-output.ts` |
| Adaptive stream / dynacast | ⚠️ Off | `adaptiveStream: false, dynacast: false` hardcoded in `connectLiveKit()` — spec requires these on |
| `VITE_LIVEKIT_URL` env var | ✅ Exists | Must be `ws://` not `http://` |
| Duplicate LiveKit layers | ⚠️ Issue | Both `src/lib/livekit/LiveKitClient.ts` and `src/lib/service/livekit.ts` manage LiveKit rooms — routes use the former; the latter is dead code |
| Dedicated `/call/:roomName` page | ❌ Missing | Call runs inside the home page, not a navigable full-screen route |

---

## State Management Status

| Store | Status | Notes |
|---|---|---|
| `auth.store.ts` | ✅ Done | localStorage persistence, initialize on mount, setSession, clear |
| `call.store.ts` | ✅ Done | Full LiveKit room state sync (participants, tracks, connection state) |
| `theme.store.ts` | ✅ Done | light/dark/system modes, OS preference listener, localStorage |
| `toast.store.ts` | ✅ Done | Toast queue; `Toast.svelte` component not yet rendered in root layout |
| `user.store.ts` | ✅ Done | Profile cache with localStorage persistence |
| `presence.store.ts` | ❌ Missing | Spec requires Redis-backed presence; no WebSocket/SSE for online/offline |

---

## API Layer Status

| Feature | Status | Notes |
|---|---|---|
| `client.ts` (axios base) | ✅ Done | Bearer token injection, base URL from `VITE_API_BASE_URL` |
| `auth.api.ts` (signIn/signUp/forgot/reset) | ✅ Done | |
| `calls.api.ts` (initiate/accept/reject/end/get) | ✅ Done | |
| `user.api.ts` (profile, contacts) | ❌ Missing | No implementation; user.store fetches nothing |
| Auto token refresh on 401 | ❌ Broken | Client references `/auth/refresh` but backend has no refresh endpoint |
| Spec: `axios` vs native fetch | ⚠️ Deviation | Spec says "native fetch + thin wrapper"; team added `axios` (~13 KB gzipped); increases bundle |

---

## Critical Issues

### 1. Token storage mismatch with backend — calls cannot authenticate

The backend sets an **httpOnly cookie** on login. The frontend `authStore` reads from **localStorage** (`accessToken`, `refreshToken`). The signin page itself prints the warning:

> *"Sign-in succeeded, but the API did not return a session token. Calls cannot be started until the backend returns token or accessToken from /auth/signin."*

The backend currently returns the raw JWT in the response body only in non-production mode (`config.env !== 'production'`). Either:
- **Option A (recommended):** Keep the backend cookie and remove the `Authorization` header injection from the axios client — let the cookie be sent automatically (`withCredentials: true`).
- **Option B:** Have the backend always return the token in the response body (less secure, XSS-vulnerable).

Both teams need to agree on this before the app can authenticate API calls in any environment.

### 2. `IncomingCallOverlay` is built but never shown

The `IncomingCallOverlay` component is feature-complete (ARIA, focus trap, pulse animation, Accept/Reject). However, there is no mechanism to trigger it:

- No WebSocket or SSE connection for real-time call events
- No push notification handler in the service worker
- The home page polls the **same call the user just initiated** every 5 seconds — it never detects a call arriving from another user

Until a push or WebSocket channel is in place, the callee will never see an incoming call.

### 3. `adaptiveStream` and `dynacast` are disabled

In `CallWorkspace.svelte`:
```typescript
roomOptions: { adaptiveStream: false, dynacast: false }
```

These are the two most important LiveKit performance features — they adapt video quality to network conditions and camera track demand. Disabling them means every participant always receives the highest bitrate track regardless of their connection. This will cause quality issues on mobile or weak connections.

### 4. Toast system is not rendered

`toast.store.ts` is fully implemented and used in several components via `import { toastStore } from '$lib/stores/toast.store'`. However, the `Toast.svelte` component is never mounted in `+layout.svelte`. Toasts will never appear.

---

## Dependency Note

| Spec said | What was used | Impact |
|---|---|---|
| Native fetch + thin wrapper | `axios` (added as runtime dep) | +~13 KB gzipped to first-load bundle |
| `zod` (already in devDeps) | `zod` (moved to dependencies) | Correct — runtime validation |
| No heavy deps | `axios` is the only deviation | Acceptable if team prefers axios DX; consider switching to native fetch later |

---

## PWA / Offline Status

| Feature | Status | Notes |
|---|---|---|
| `manifest.webmanifest` | ✅ Done | Name, icons, display: standalone, theme_color |
| `service-worker.ts` — shell caching | ✅ Done | Caches all build artifacts, versioned cache name |
| `service-worker.ts` — offline fallback | ❌ Missing | No offline fallback page; app shows browser error if offline |
| Push notification handler in SW | ❌ Missing | `push` event listener not implemented — required for incoming calls |
| Background sync | ❌ Missing | (Phase 2, acceptable) |

---

## Testing Status

| Test | Status | Notes |
|---|---|---|
| `tests/e2e/auth.spec.ts` (Playwright) | ✅ Done | Sign-in / sign-up / forgot-password E2E flows |
| `tests/e2e/home.spec.ts` (Playwright) | ✅ Done | Home page E2E |
| `tests/unit/modal.test.ts` (Vitest) | ✅ Done | Modal component unit test |
| `tests/unit/auth-header.test.ts` (Vitest) | ✅ Done | Auth header logic |
| `tests/unit/index.test.ts` (Vitest) | ✅ Done | |
| Store unit tests (auth, call, theme) | ❌ Missing | |
| Call flow unit tests | ❌ Missing | |
| Component tests (CallWorkspace, CallSession) | ❌ Missing | |
| `scripts/run-e2e.mjs` | ✅ Done | Build + Playwright runner script |

---

## Recommended Sprint Priorities

### Sprint 1 — Fix the blockers so existing features actually work
1. **Resolve the token/cookie mismatch** — agree on auth strategy with backend team (cookie vs localStorage), then fix accordingly. Add `withCredentials: true` to axios client if keeping cookies.
2. **Mount `Toast.svelte` in root `+layout.svelte`** — one-line fix that activates the already-built toast system.
3. **Enable `adaptiveStream` and `dynacast`** — remove the two false flags from `CallWorkspace.svelte`.
4. **Delete `.bak` files** from `src/routes/(app)/` and `src/routes/(auth)/`.
5. **Remove `src/lib/service/livekit.ts`** — dead code that duplicates `LiveKitClient.ts`.

### Sprint 2 — Wire the incoming call experience
1. WebSocket or SSE client to receive call events from the backend
2. Wire `IncomingCallOverlay` to display when a call arrives (for in-browser callers)
3. Service worker `push` event handler (for device push notifications, after backend notification module is built)
4. Create dedicated `/call/:roomName` full-screen route

### Sprint 3 — Complete the app shell
1. `/contacts` page with contact list, search, presence dots
2. `/contacts/:id` contact detail + call history with that person
3. `/calls` paginated call history
4. `/calls/:id` call detail (recording playback, participant list)
5. Wire `user.api.ts` to fetch profiles and populate `user.store`

### Sprint 4 — Settings and polish
1. `/settings/profile` — display name, avatar upload
2. `/settings/devices` — mic/cam/speaker chooser using `audio-output.ts` (already built)
3. `/settings/notifications` — push opt-in/out
4. `/settings/privacy` — allowCallsFrom toggle
5. Offline fallback page
6. Lighthouse audit and bundle size check (target <80 KB initial JS)
7. Presence store with heartbeat

---

## Questions for the Team

1. **Nishant (Frontend) + Vipin (Backend):** The token/cookie mismatch (Issue #1) is the most urgent blocker — authenticated API calls will fail silently. Which approach do you want to go with: keep cookies (`withCredentials: true`, remove `Authorization` header injection from axios) or have the backend always return the token in the JSON response?

2. **Nishant (Frontend):** `src/lib/service/livekit.ts` duplicates `LiveKitClient.ts` and appears to be dead code (no routes import it). Safe to delete?

3. **Nishant (Frontend):** The home page renders the call workspace directly at `/home`. The spec has a separate `/call/:roomName` full-screen route for active calls. Should we create that route, or keep the call inside the home page?

4. **Venkat / Ajay:** The `IncomingCallOverlay` component is ready to use but requires a real-time channel (WebSocket, SSE, or push) to know when a call arrives. Since the backend notification module is at 0%, what is the interim plan — should the frontend fall back to polling the backend for new calls?

5. **Nishant (Frontend):** `adaptiveStream` and `dynacast` are disabled in code. These are critical for good call quality on variable-bandwidth connections. Was this intentional (debugging workaround) or accidental?
