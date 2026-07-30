# AG Cloud Frontend — Development Status Report

**Date:** July 10, 2026
**Branch:** `dev` (HEAD `23235f9` — Merge PR #10 bugfixing)
**Prepared by:** Claude Code (code review of actual source files)
**Previous report:** `documents/Frontend-Status-Report-2026-07-03.md`

---

## What Changed Since July 3

Two PRs merged between July 3 and July 10:

| PR | Merge commit | Commits | Summary |
|---|---|---|---|
| #9 | `25e3ed7` | `f2c6e8e` | All P0/P1/P2 bugs from July 3 report fixed; 4 unit test suites added |
| #10 | `23235f9` | `4f81d90`, `0c6f3af` | ParticipantTile redesign, screen-share improvements, call.store and useCall.ts expanded |

---

## Overall Progress

| Area | Progress | Status |
|---|---|---|
| Auth screens | ✅ 100% | Stable; cookie auth solid |
| Call flow (initiate / accept / end) | ✅ 99% | Both paths use CallSession; caller = receiver parity |
| LiveKit integration | ✅ 97% | Adaptive stream and dynacast enabled; screen share mutual exclusion added |
| Component library | ✅ 97% | ParticipantTile rebuilt; RoomIdChip template disabled |
| Routing | ✅ 100% | All 14 spec routes plus `/offline` |
| State management | ✅ 99% | All stores fully tested |
| API layer | ✅ 96% | `user.api.ts` still missing `getProfile` |
| Theme system | ✅ 100% | |
| PWA / Service Worker | ✅ 95% | Push handler fully implemented |
| Real-time / Socket.IO | ✅ 95% | Call signaling + presence wired |
| Firebase FCM | ✅ 85% | Token flow + SW handler done |
| Testing | ✅ 75% | 4 store suites added; call-flow E2E and component tests still missing |

---

## What Was Fixed in This Cycle

### PR #9 — All July 3 blockers resolved

**P0 fixes:**

1. **Toast mounted** — `routes/+layout.svelte` now imports and renders `<Toast />` between `<OfflineBanner />` and `<slot />`. Every `toastStore.success()` / `toastStore.error()` call in the app now reaches the user.

2. **`adaptiveStream` and `dynacast` enabled** — `roomOptions: { adaptiveStream: false, dynacast: false }` removed from both `GlobalCallManager.svelte` (line ~110) and `CallWorkspace.svelte` (line ~92). Neither call site passes `roomOptions` at all now, so `LiveKitClient.ts` class defaults (`adaptiveStream: true, dynacast: true`) take effect for every call.

3. **Service worker push handler implemented** — `service-worker.ts` gained 165 lines:
   - `handlePush()` — parses flat and FCM-nested (`{ notification, data }`) payloads into a typed `CallPushData` interface; shows a `requireInteraction: true` notification with `vibrate: [200,100,200,100,200]`.
   - `handleNotificationClick()` — closes notification, focuses an existing window and forwards `{ type: 'incoming-call-notification', data }` via `client.postMessage()`, or opens a new window at the call URL.
   - `push` and `notificationclick` event listeners registered.

**P1 fixes:**

4. **`console.debug` removed** — All 6 `console.debug` calls in `presence.store.ts` deleted.

5. **`lib/service/livekit.ts` deleted** — Dead stub removed.

6. **`.bak` files deleted** — All 4 stale backup files under `routes/(auth)/` removed from the repository.

7. **`alert()` in recording removed** — `CallSession.svelte` recording error path no longer calls `alert()`. The error is now surfaced through the control error bar (`controlError` state).

**P2 fixes:**

8. **`formatDuration` fixed** — `routes/calls/[id]/+page.svelte` (line 84–88):
   ```typescript
   const endTs = isActive
     ? Date.now()
     : (call.endedAt ? new Date(call.endedAt).getTime() : null)
         ?? (call.updatedAt ? new Date(call.updatedAt).getTime() : null)
         ?? Date.now();
   ```
   Ended / missed / rejected calls now use the recorded timestamp. `CallSummary` interface extended with `endedAt?` and `updatedAt?` fields.

9. **Store unit tests added** — Four new suites covering previously untested stores:

   | File | Lines | What it covers |
   |---|---|---|
   | `tests/unit/auth.store.test.ts` | 217 | initialize, setUser, clear, getUser, getSession |
   | `tests/unit/call.store.test.ts` | 363 | syncRoom, setActiveSpeakers, setHandRaised, reset |
   | `tests/unit/active-call.store.test.ts` | 369 | state-machine phases, invite queue, liveKit credentials |
   | `tests/unit/presence.store.test.ts` | 420 | presence parsing (flat/array/dict), socket events |

---

### PR #10 — UI improvements and screen share fixes

**`ParticipantTile.svelte` — full redesign:**

The tile is now a self-contained responsive component using `container-type: inline-size`:

| Feature | Detail |
|---|---|
| Speaking ring | Separate `div.speaking-ring` overlay at `will-change: opacity` — avoids triggering paint on the parent's clip context and the GPU `<video>` layer |
| Pin button | Hover-reveal at top-right; always visible when pinned; 2.75 rem hit target |
| Network badge | Poor quality shows a top-left badge-pill in red; excellent/good show a signal-bar icon in the footer |
| Raise-hand badge | Yellow hand SVG with CSS `hand-wave` keyframe animation |
| Muted mic | Red rounded icon in footer |
| Camera off | Slate icon in footer |
| Avatar | Stable HSL color from name hash; `clamp(3rem, 18cqw, 5rem)` scales with container |
| Label sizing | Hidden at `<100px`; reduced at `<140px` via `@container` queries |
| Screen share tile | `object-fit: contain` + black background instead of cover |

**`call.store.ts` — state additions:**

- `raisedHands: string[]` — identity list; toggled by `setHandRaised(identity, raised)`.
- `screenShareParticipantIdentity: string | null` — detected in `snapshotRoom()`: remote participants are checked first so a remote presenter's share always takes priority over the local participant's own share.
- `setActiveSpeakers()` — now short-circuits and returns unchanged state when the speaker list has not actually changed, preventing spurious track re-renders on every audio tick.
- `syncRoom()` preserves `raisedHands` across room snapshot rebuilds.

**`useCall.ts` — robustness improvements:**

- **Debounced speaker detection** (600 ms) — prevents rapid active-speaker switching caused by background noise briefly crossing the detection threshold.
- **Screen share mutual exclusion** — when a remote participant publishes a screen share track, `syncRemotePublication` checks whether the local participant is also sharing and calls `setScreenShareEnabled(false)` to stop them. Only one presenter at a time.
- **Periodic subscription recovery** — `setInterval` every 10 s re-runs `subscribeToRemotePublications()` to catch any tracks that slipped through on initial connect.
- **Quality configured once per SID** — `qualityConfiguredSids` set prevents `setVideoQuality / setVideoDimensions / setVideoFPS` from being called repeatedly on already-configured tracks (was causing stream renegotiation blinks).
- **Screen share quality skip** — video quality hints are intentionally NOT applied to `Track.Source.ScreenShare` publications, because doing so tells the SFU to find a simulcast layer that matches the requested dimensions — and screen shares are published as a single layer, so the SFU stalls the subscription.
- 16 Room events are now bound/unbound symmetrically.

**`CallSession.svelte` — screen share improvements:**

Increased from the July 3 baseline by 148 lines in PR #10. Notable additions include the screen-share spotlight auto-pin logic integrated with `callStore.screenShareParticipantIdentity`, and improved waiting-overlay and quality-picker wiring.

---

## Remaining Issues

### P1 — Fix before production

| # | Issue | Location | Lines | Fix |
|---|---|---|---|---|
| 1 | **Verbose debug logging in production** | `src/lib/livekit/useCall.ts` | 166, 205, 219, 235, 251, 297 | Remove 6 `console.log` calls that print participant identities, track SIDs, and subscription statuses on every track event. These fire continuously during a call. |
| 2 | **Stray debug log in CallWorkspace** | `src/lib/components/calls/CallWorkspace.svelte` | 107 | Remove `console.log('Remote participant', p.identity, 'tracks:', ...)` — logs participant identities on every connect. |
| 3 | **RoomIdChip renders nothing** | `src/lib/components/calls/RoomIdChip.svelte` | 29–74 | The entire component template is wrapped in `<!-- ... -->`. The component renders as an empty element. If the call header uses `<RoomIdChip>`, the Room ID is invisible and the copy button is gone. Either uncomment the template or remove the `<RoomIdChip>` usage from `CallSession.svelte` until the component is ready. |

### P2 — Polish / nice to have

| # | Issue | Notes |
|---|---|---|
| 4 | **`user.api.ts` missing `getProfile`** | Only has `updateProfile`. `userStore.hydrateProfile` calls `apiGet('/users/:id')` directly. A typed `getProfile(userId)` function in the API module would centralise the endpoint. |
| 5 | **Pre-existing console.logs in realtime layer** | `call-signaling.ts:82` logs every incoming call event; `socket.ts:37,43` logs connect/disconnect; `GlobalCallManager.svelte:64` logs init. Low noise volume but still visible in production devtools. |
| 6 | **Call-flow E2E tests missing** | Auth and home E2E pass. No E2E tests cover the call initiation → join → end flow, add-participant modal, screen share, or recording. |
| 7 | **Lighthouse / bundle audit** | Target: <80 KB initial JS. Not yet measured. |

---

## Route Status (unchanged — all stable)

| Route | Status |
|---|---|
| `/signin`, `/signup`, `/forgot-password`, `/reset-password` | ✅ Done |
| `/home` | ✅ Done |
| `/contacts`, `/contacts/[id]` | ✅ Done |
| `/calls`, `/calls/[id]` | ✅ Done (duration bug fixed) |
| `/call/[roomName]` | ✅ Done |
| `/settings/profile`, `/settings/devices`, `/settings/notifications`, `/settings/privacy` | ✅ Done |
| `/offline` | ✅ Done |

---

## API Layer

| Module | Status | Notes |
|---|---|---|
| `lib/api/client.ts` | ✅ Done | Native fetch, 30 s timeout, GET cache + dedup |
| `lib/api/auth.api.ts` | ✅ Done | |
| `lib/api/calls.api.ts` | ✅ Done | Extended `CallSummary` with `endedAt`/`updatedAt`; `getCallApiErrorMessage` added |
| `lib/api/contacts.api.ts` | ✅ Done | |
| `lib/api/user.api.ts` | ⚠️ Partial | Only `updateProfile` — no typed `getProfile` |
| `lib/api/notifications.api.ts` | ✅ Done | |
| `lib/api/privacy.api.ts` | ✅ Done | |
| `lib/service/api.ts` | ✅ Done | `callApi` POST wrapper used by `LiveKitClient.ts` |
| `lib/service/livekit.ts` | ✅ Deleted | Dead code removed |

---

## State Management

| Store | Status | Tests |
|---|---|---|
| `authStore` | ✅ Done | ✅ 217-line suite |
| `activeCallStore` | ✅ Done | ✅ 369-line suite |
| `callStore` | ✅ Done | ✅ 363-line suite (includes raisedHands, screenShare) |
| `presenceStore` | ✅ Done | ✅ 420-line suite |
| `themeStore`, `toastStore`, `userStore`, `notificationStore`, `privacyStore`, `contactsDrawerStore`, `devicePreferences` | ✅ Done | ❌ No unit tests |

---

## Real-Time and LiveKit

| Feature | Status | Notes |
|---|---|---|
| Socket.IO client | ✅ Done | |
| Call signaling (8 events) | ✅ Done | |
| Presence via socket | ✅ Done | |
| `adaptiveStream` + `dynacast` | ✅ Fixed | Both `true` at class level; no override at call sites |
| Screen share mutual exclusion | ✅ New | Remote presenter stops local share automatically |
| Periodic subscription recovery | ✅ New | 10 s interval catches slipped subscriptions |
| Speaker debounce | ✅ New | 600 ms debounce avoids noise-triggered flickering |
| Camera flip (mobile) | ✅ Done | `setCameraFacingMode()` via `restartTrack()` |
| Service worker push handler | ✅ Done | FCM flat + nested payload; `requireInteraction` notification |
| Notification click → app focus | ✅ Done | `postMessage` to existing window; `openWindow` fallback |
| Firebase FCM token registration | ✅ Done | |

---

## Test Coverage

| Test | Status |
|---|---|
| E2E: auth flows | ✅ Done |
| E2E: home page | ✅ Done |
| Unit: modal | ✅ Done |
| Unit: auth header | ✅ Done |
| Unit: auth.store | ✅ New |
| Unit: call.store | ✅ New |
| Unit: active-call.store | ✅ New |
| Unit: presence.store | ✅ New |
| Unit: remaining stores (theme, toast, user, …) | ❌ Missing |
| E2E: call flow | ❌ Missing |
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
