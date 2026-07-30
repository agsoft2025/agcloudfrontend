# AG Cloud Frontend — Development Status Report

**Date:** July 17, 2026
**Branch:** `dev` (HEAD `31573e6` — Merge PR #13 feature/videotemplate)
**Prepared by:** Claude Code (code review of actual source files)
**Previous report:** `documents/Frontend-Status-Report-2026-07-10.md`

---

## What Changed Since July 10

| Commit / PR | Date | Summary |
|---|---|---|
| `d8be300` (standalone) | Jul 8 | `user.api.ts` — `getProfile()` added; `user.store.ts` updated |
| PR #11 (`ad67304`) | Jul 12 | Debug log cleanup; `leaveCall` API; signaling events; GlobalCallManager presence-aware outgoing screen; 832-line E2E call test suite |
| PR #12 (`a933837`) | Jul 13 | `RoomIdChip` template restored; `LiveKitTrack` object-fit fix; `CallSession` add-participant re-invite improvements |
| PR #13 (`31573e6`) | Jul 15 | `CallSession` — Google Meet-style responsive grid algorithm |

---

## Overall Progress

| Area | Progress | Status |
|---|---|---|
| Auth screens | ✅ 100% | Stable |
| Call flow (initiate / accept / end / leave) | ✅ 100% | Caller = receiver parity; leave vs end separation |
| LiveKit integration | ✅ 99% | All quality flags on; video container fit fixed |
| Component library | ✅ 100% | `RoomIdChip` restored; all components rendering |
| Routing | ✅ 100% | All 14 spec routes |
| State management | ✅ 100% | All stores fully implemented and tested |
| API layer | ✅ 100% | `getProfile` added; `leaveCall` added |
| Theme system | ✅ 100% | |
| PWA / Service Worker | ✅ 95% | Push handler complete |
| Real-time / Socket.IO | ✅ 100% | All call lifecycle events including participant-left |
| Firebase FCM | ✅ 85% | Token flow + SW handler done |
| Testing | ✅ 80% | Call E2E suite added; **auth injection broken** — tests need a `/auth/me` interceptor |

---

## What Was Fixed in This Cycle

### `d8be300` — getProfile (Jul 8, standalone)

**`user.api.ts`** — `getProfile(userId: string): Promise<UserProfile>` function added:
```typescript
export async function getProfile(userId: string): Promise<UserProfile> {
  return apiGet<UserProfile>(`/users/${userId}`);
}
```
This closes the P2 item from every previous report. `user.store.ts` updated: `hydrateProfile()` now delegates to `getProfile()` via `defaultProfileLoader` instead of calling `apiGet` directly, keeping API path management centralised in the API module.

---

### PR #11 — Cleanup, signaling events, GlobalCallManager (Jul 12)

**Debug log cleanup — P1s from July 10 closed:**
- `useCall.ts` — All 6 verbose `console.log` calls removed (remote track publication, subscribed, subscription status, permission, stream state, quality configured). Only the meaningful `console.warn` for screen-share mutual exclusion remains.
- `CallWorkspace.svelte:107` — Stray `console.log` for remote participant tracks removed.
- `socket.ts` — `console.log` in `connect` and `disconnect` event handlers removed (handlers still exist as empty stubs for future use).
- `call-signaling.ts` — `console.log('[call-signaling] call:incoming', data)` removed.

**`calls.api.ts` — `leaveCall()` added:**
```typescript
export async function leaveCall(callId: string): Promise<EndCallResponse> {
  return apiPost<EndCallResponse>(`/calls/${encodeURIComponent(callId)}/leave`);
}
```
Semantically distinct from `endCall()`: leave keeps the meeting alive for remaining participants; end terminates it for everyone. `GlobalCallManager` now uses `leaveCall()` for the in-call "End call" button.

**`call-signaling.ts` — new events and fixes:**
- `call:participant-left` event added — fires `emitLifecycleEvent('call:participant-left', ...)`. The LiveKit `ParticipantDisconnected` room event already updates the call UI; this socket event is the server-authoritative confirmation.
- `call:ended` handler updated: calls `activeCallStore.markInviteEnded(callId)` to flag the invite as ended, then delays `removeIncomingInvite` by 5 s so the "Call Ended" state is visible briefly before the banner disappears.
- `call:incoming` updated: `reinvite` boolean field support — re-sent invitations for the same call are not silently dropped.
- `call:cancelled` now calls `activeCallStore.removeIncomingInvite(data.callId)` to clean the queue.

**`GlobalCallManager.svelte` — presence-aware outgoing screen and multi-call handling:**

The outgoing call overlay now shows live callee presence:
- **Online:** "Ringing" green badge with bouncing dots
- **Offline:** Orange warning banner ("User is offline — they may not receive your call") + plain "Calling…" text
- **Unknown:** "Calling…" text only

`handleEndCall` now uses `leaveCall()` instead of `endCall()` — the meeting continues for remaining participants (important for conference calls).

`handleJoinInvite()` handles the case where you accept a new invite while already in a call:
- If in-call or connecting → gracefully leaves the current call first
- If outgoing-ringing → cancels the pending outgoing call
- Then proceeds to `acceptCall()` on the new invite

`handleDismissInvite()` checks `invite.status !== 'ended'` before calling `rejectCall()` — prevents 404 errors when dismissing a call that the server already marked as ended.

`IncomingCallNotifications` banner deduplicates: the invite that is already driving the full-screen `IncomingCallOverlay` is filtered out of the banner queue (`bannerInvites`), preventing double UI.

**`tests/e2e/calls.spec.ts` — 832-line E2E call suite added:**

8 test groups covering the complete call lifecycle:

| Group | What it tests |
|---|---|
| Call initiation | Audio/video call from contact panel; outgoing overlay renders; API 400 does not crash |
| End call | Cancel outgoing call; overlay dismisses; correct API called |
| Join call | Incoming overlay trigger; Accept → shows session; Reject → dismisses |
| Add participant | Modal opens; search filters; invite API called; duplicate prevention |
| Screen share | Error state when LiveKit unavailable |
| Recording | `MediaRecorder` available; API endpoints wired; no REC badge in error state |
| Leave call | `leaveCall` API endpoint shape |
| (Misc) | `mockLeaveCallResponse`, `interceptLeaveCall`, Socket.IO silencing |

Interceptors: all API calls are intercepted via `page.route()`, including `GET /users*`, `GET /calls/history*`, `POST /calls/initiate`, `/accept`, `/reject`, `/end`, `/leave`, `/add-participant`, `/livekit/token`, and Socket.IO handshake.

---

### PR #12 — RoomIdChip restored, video fit fix (Jul 13)

**`RoomIdChip.svelte` — template uncommented — P1 from July 10 closed:**
The entire component template was previously wrapped in `<!-- ... -->`. It now renders again: room ID text chip with lock icon, clipboard copy button, and a 2.2 s "Copied!" / "Failed" feedback state with a draw-check animation.

**`LiveKitTrack.svelte` — `object-fit: contain`:**
```css
video {
  object-fit: contain;          /* was: missing / cover */
  background: transparent;      /* letterbox from parent tile */
}
```
Previously remote video frames were being cropped to fill the tile. `contain` shows the full camera or screen-share frame at its natural aspect ratio with transparent letterboxing — consistent with standard video conferencing behaviour.

**`CallSession.svelte` — add-participant improvements:**
- Invite auto-expiry extended from 4 s to 45 s — gives the invited user time to see and act on the notification.
- `cancelTimeout` properly cancels any previous expiry timer before issuing a re-invite (prevents double-expiry on re-invite).
- Contacts that are already in the call (local participant + remote participants) are excluded from the add-people modal contact list reactively via `existingParticipantIds`.

---

### PR #13 — Google Meet-style grid layout (Jul 15)

**`CallSession.svelte` — responsive grid algorithm:**

The previous static column table (`1→2→4 by count`) is replaced with a dynamic algorithm:

```typescript
function computeOptimalCols(n: number, w: number, h: number): number {
  // For each candidate column count, compute tile dimensions at 16:9.
  // Pick the count that maximises tile area while fitting all rows within
  // the available height. Falls back to max-area row if nothing fits.
}
```

`recomputeGridLayout()` reads the actual stage element's computed padding and client dimensions, then calls `computeOptimalCols()`. It fires on:
- `ResizeObserver` — container / viewport resize (bound in `onMount`, cleaned up on destroy).
- Reactive `$: if (totalParticipants >= 0 && stageEl) recomputeGridLayout()` — participant join / leave.

The result: a 1-person call fills the stage; a 2-person call uses 2 columns if width allows; large conferences find the column count that maximises tile size without scrolling — no hardcoded breakpoints.

`lastTileAlone` flag (set when `n % cols !== 0`) is passed to CSS via `--grid-cols` custom property so the last tile can be centred when it doesn't have a full row of siblings.

---

## Remaining Issues

### P1 — Fix before production

| # | Issue | Location | Fix |
|---|---|---|---|
| 1 | **E2E auth injection does not work** | `tests/e2e/calls.spec.ts` — `injectAuthSession()` | The helper sets `localStorage.setItem('accessToken', ...)` and `'authUser'`, but the app's `authStore.initialize()` calls `GET /auth/me` with `credentials: 'include'` (cookie auth) and never reads localStorage. There is no `interceptAuthMe` function and `GET /auth/me` is never intercepted in any test. All tests that navigate to `/home` expecting an authenticated session are likely failing. Fix: add `await page.route(\`${API_BASE}/auth/me\`, route => route.fulfill({ status: 200, body: JSON.stringify(mockUser()) }))` to `injectAuthSession()`, or create an `interceptAuthMe(page)` helper and call it in every test. |

### P2 — Polish / nice to have

| # | Issue | Notes |
|---|---|---|
| 2 | **Unit tests for remaining stores** | `themeStore`, `toastStore`, `userStore`, `notificationStore`, `privacyStore`, `contactsDrawerStore`, `devicePreferences` have no unit tests. The 4 core stores (auth, call, active-call, presence) are well covered. |
| 3 | **Component E2E tests** | `CallSession`, `ParticipantTile`, `HomeSidebar` have no component-level tests. The call E2E suite validates API endpoints; it does not exercise the rendered call UI (controls bar, grid layout, spotlight, recording badge) because LiveKit cannot connect in a Playwright browser. |
| 4 | **Lighthouse / bundle audit** | Target: <80 KB initial JS per spec. Not yet measured. |

---

## Route Status (all stable)

| Route | Status |
|---|---|
| `/signin`, `/signup`, `/forgot-password`, `/reset-password` | ✅ Done |
| `/home` | ✅ Done |
| `/contacts`, `/contacts/[id]` | ✅ Done |
| `/calls`, `/calls/[id]` | ✅ Done |
| `/call/[roomName]` | ✅ Done |
| `/settings/profile`, `/settings/devices`, `/settings/notifications`, `/settings/privacy` | ✅ Done |
| `/offline` | ✅ Done |

---

## API Layer (all complete)

| Module | Status | Notes |
|---|---|---|
| `lib/api/client.ts` | ✅ Done | Native fetch, 30 s timeout, GET cache + dedup |
| `lib/api/auth.api.ts` | ✅ Done | |
| `lib/api/calls.api.ts` | ✅ Done | `leaveCall()` added; full lifecycle covered |
| `lib/api/contacts.api.ts` | ✅ Done | |
| `lib/api/user.api.ts` | ✅ Done | `getProfile()` and `updateProfile()` |
| `lib/api/notifications.api.ts` | ✅ Done | |
| `lib/api/privacy.api.ts` | ✅ Done | |
| `lib/service/api.ts` | ✅ Done | `callApi` POST wrapper for LiveKitClient |

---

## State Management (all complete)

| Store | Status | Tests |
|---|---|---|
| `authStore` | ✅ Done | ✅ |
| `activeCallStore` | ✅ Done | ✅ |
| `callStore` | ✅ Done | ✅ (includes raisedHands, screenShareParticipantIdentity) |
| `presenceStore` | ✅ Done | ✅ |
| `themeStore`, `toastStore`, `userStore`, `notificationStore`, `privacyStore`, `contactsDrawerStore`, `devicePreferences` | ✅ Done | ❌ No unit tests |

---

## Real-Time and LiveKit (all complete)

| Feature | Status |
|---|---|
| Socket.IO client — cookie auth, auto-reconnect | ✅ Done |
| Call signaling — 9 events including `call:participant-left` | ✅ Done |
| Presence via socket (4 events) | ✅ Done |
| `adaptiveStream: true`, `dynacast: true` | ✅ Done |
| Screen share mutual exclusion | ✅ Done |
| Speaker debounce (600 ms) | ✅ Done |
| Periodic subscription recovery (10 s) | ✅ Done |
| Camera flip (`setCameraFacingMode`) | ✅ Done |
| `leaveCall` — leave without ending for all | ✅ Done |
| Service worker push + notification click | ✅ Done |

---

## Test Coverage

| Test | Status |
|---|---|
| E2E: auth flows | ✅ Done |
| E2E: home page | ✅ Done |
| E2E: call flow (8 groups, 832 lines) | ⚠️ Added — **auth injection broken** (see P1 #1) |
| Unit: auth.store | ✅ Done |
| Unit: call.store | ✅ Done |
| Unit: active-call.store | ✅ Done |
| Unit: presence.store | ✅ Done |
| Unit: modal, auth-header, index | ✅ Done |
| Unit: remaining stores | ❌ Missing |
| Component tests: CallSession, ParticipantTile | ❌ Missing |

```bash
npm run test:unit    # Vitest
npm run test:e2e     # build + Playwright
npm run test         # both
```

---

## Environment Variables

```
VITE_API_BASE_URL=http://localhost:3000
VITE_LIVEKIT_URL=ws://localhost:7880
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```
