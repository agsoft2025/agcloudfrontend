# AG Cloud Frontend — Development Status Report

**Date:** July 29, 2026
**Branch:** `dev` (HEAD `ae38e26` — Merge PR #14 from `feature/videotemplate`, "e2e test added")
**Prepared by:** Claude Code (code review of actual source files + git history)
**Previous report:** `documents/Frontend-Status-Report-2026-07-17.md`

---

## What Changed Since July 17

Only one commit landed in this cycle, and it touches exactly one file:

| Commit / PR | Date | Summary |
|---|---|---|
| `0605f08` / PR #14 (`ae38e26`) | Jul 28 | `tests/e2e/calls.spec.ts` rewritten (188 insertions / 189 deletions) — incoming-call tests now use `page.routeWebSocket()` instead of a non-functional custom-event bridge |

`git diff d300665..HEAD --stat -- . ':!tests/e2e/calls.spec.ts'` returns empty — **no application source, component, store, API, or route code changed.** Everything reported on July 17 (auth cookie/localStorage mismatch, LiveKit flags, toast mounting, routes, stores, API layer) is unchanged; see that report for the full baseline. This report focuses on what the test rewrite actually fixed and what it didn't.

---

## Overall Progress

| Area | Progress | Status |
|---|---|---|
| Auth screens | ✅ 100% | Stable |
| Call flow (initiate / accept / end / leave) | ✅ 100% | Unchanged |
| LiveKit integration | ✅ 99% | Unchanged |
| Component library | ✅ 100% | Unchanged |
| Routing | ✅ 100% | All 14 spec routes |
| State management | ✅ 100% | Unchanged |
| API layer | ✅ 100% | Unchanged |
| Theme system | ✅ 100% | |
| PWA / Service Worker | ✅ 95% | Unchanged |
| Real-time / Socket.IO | ✅ 100% | Unchanged |
| Firebase FCM | ✅ 85% | Unchanged |
| Testing | ⚠️ 78% | Incoming-call socket mocking now genuinely works; **the E2E suite as a whole still cannot authenticate against a real run** (see P1 below) — a real regression in confidence versus last report's optimistic "80%," since closer reading shows most of the 21 non-skipped tests share this blocker |

---

## What Was Fixed in This Cycle

### `0605f08` — `calls.spec.ts` rewritten with real WebSocket mocking (Jul 28)

**The good part — this is a genuine fix for a real gap:**

The July 17 report's `simulateIncomingCall()` helper never worked: it dispatched a browser `CustomEvent` and hoped a bridge script could forward it onto "the global socket," with a commented-out fallback if that global didn't exist. There was no code path in `socket.ts` or `call-signaling.ts` that ever listened for it, so the incoming-call tests were assertion-free theater (they checked that the *home page* rendered, not that the *overlay* appeared).

The rewrite replaces this with `page.routeWebSocket(/socket\.io/, ...)`, which intercepts the real Socket.IO WebSocket connection the app opens (confirmed against `socket.ts`'s `transports: ['websocket', 'polling']` config — WebSocket is attempted first, so no HTTP polling handshake needs to be faked). It sends proper Engine.IO / Socket.IO frames:

```
"0{...}"        Engine.IO open packet
"40"            Socket.IO namespace connect ack
"42[\"call:incoming\",{...}]"   Socket.IO event emission
```

and responds to ping (`"2"` → `"3"`) to keep the connection alive. This now drives `call-signaling.ts` for real, which puts `activeCallStore` into `incoming-ringing`, which mounts `IncomingCallOverlay` through `GlobalCallManager` — the actual production code path, not a simulated shortcut.

Four tests now assert against the real overlay (`getByRole('dialog', { name: 'Incoming ... call from ...' })`) instead of the home page's contact list:
- Overlay renders with caller name
- Accept button → `POST /calls/:id/accept`
- Reject button → `POST /calls/:id/reject` + overlay dismissal
- A new test: `call:cancelled` socket event (caller hangs up before answer) dismisses the overlay

Several previously-fake "verifies the route is registered but never calls it" tests (add-participant, screen-share record endpoints, leave-call) were turned into explicit `test.skip(true, 'Requires an active LiveKit session — pending integration test setup')` with a comment explaining exactly what a real integration test would need to do. This is honest — the July 17 versions asserted `expect(x).toBeNull()`/`toBe(false)` as a "pre-condition," which is a test that can never fail and proves nothing. Skipping and documenting the gap is strictly more useful than a green checkmark that means nothing.

---

## Remaining Issues

### P1 — Fix before production (carried forward, unchanged, and now shown to have broader blast radius)

| # | Issue | Location | Fix |
|---|---|---|---|
| 1 | **E2E auth injection still does not work — this cycle's rewrite did not touch it** | `tests/e2e/calls.spec.ts:233` `injectAuthSession()` | `injectAuthSession()` still only does `localStorage.setItem('accessToken', ...)` / `'authUser'`. `authStore.initialize()` (`src/lib/stores/auth.store.ts:35`) calls `GET /auth/me` via `apiGet`, which is cookie-based (`client.ts:246` hardcodes `credentials: 'include'`) — it never reads `localStorage`. No file under `tests/e2e/` intercepts `/auth/me` (verified via repo-wide grep). Root `+layout.svelte:11` calls `authStore.initialize()` on mount for **every route**, and both `(app)/+layout.svelte` and `call/[roomName]/+layout.svelte` redirect to `/signin` once `isInitialized && !isAuthenticated`. In a real test run, `GET /auth/me` hits the unmocked `VITE_API_BASE_URL` (`localhost:3000`, nothing listening in CI/local test runs) → request fails → `authStore` settles as unauthenticated → every test that calls `injectAuthSession()` and then expects an authenticated view (`goToHome()`, or direct navigation to `/call/[roomName]`) gets redirected to `/signin` instead and times out waiting for the contact list / overlay / connecting spinner. Fix: add `await page.route(\`${API_BASE}/auth/me\`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser()) }))` inside `injectAuthSession()` (or a sibling `interceptAuthMe(page)` called alongside it in every test). |

**Why this matters more than last report implied:** by count, roughly 21 of the 26 tests in `calls.spec.ts` call `injectAuthSession()` and then require an authenticated view to render (10 via `goToHome()`, several more via direct navigation to `/call/[roomName]`, which carries the identical auth guard). Only one test (`unauthenticated users are redirected to /signin`, line 639) is unaffected — and only because it *doesn't* call `injectAuthSession()`, so the unmocked-`/auth/me` failure happens to produce the behavior it's asserting anyway. The other ~20 are very likely failing (or would fail) in an actual CI run. This was not verified by executing the suite in this review — Playwright's browser binaries are not installed in this environment and installing them was out of scope for a code review — but it follows directly and unambiguously from reading `auth.store.ts`, `client.ts`, both `+layout.svelte` guards, and confirming (via grep) that no `/auth/me` route interception exists anywhere in `tests/e2e/`. Running `npm run test:e2e` locally would confirm this in under two minutes and should be the first thing done next cycle.

**Minor, related:** `src/routes/+layout.svelte:10` has a comment — `// Re-read auth session from localStorage (handles hard refresh)` — directly above the call to `authStore.initialize()`, which actually does a cookie-based `/auth/me` fetch. The comment describes the old (or intended-but-never-built) localStorage design, not what the code does. Worth fixing when someone is next in that file, since it's the kind of stale comment that misleads whoever debugs this auth issue next.

### P2 — Polish / nice to have (unchanged from July 17)

| # | Issue | Notes |
|---|---|---|
| 2 | **Unit tests for remaining stores** | `themeStore`, `toastStore`, `userStore`, `notificationStore`, `privacyStore`, `contactsDrawerStore`, `devicePreferences` still have no unit tests. No change this cycle. |
| 3 | **Component E2E tests** | `CallSession`, `ParticipantTile`, `HomeSidebar` still have no component-level tests; 5 tests in `calls.spec.ts` are now explicitly `test.skip()`-ed pending a LiveKit dev-server integration setup (add-participant, screen-share record start/stop, record start/stop, leave-call). |
| 4 | **Lighthouse / bundle audit** | Target: <80 KB initial JS per spec. Still not measured. |

---

## Route Status (all stable — unchanged)

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

## API Layer (all complete — unchanged)

| Module | Status | Notes |
|---|---|---|
| `lib/api/client.ts` | ✅ Done | Native fetch, cookie auth (`credentials: 'include'`), 30 s timeout, GET cache + dedup |
| `lib/api/auth.api.ts` | ✅ Done | |
| `lib/api/calls.api.ts` | ✅ Done | Full lifecycle incl. `leaveCall()` |
| `lib/api/contacts.api.ts` | ✅ Done | |
| `lib/api/user.api.ts` | ✅ Done | `getProfile()` and `updateProfile()` |
| `lib/api/notifications.api.ts` | ✅ Done | |
| `lib/api/privacy.api.ts` | ✅ Done | |
| `lib/service/api.ts` | ✅ Done | `callApi` POST wrapper for LiveKitClient |

---

## State Management (all complete — unchanged)

| Store | Status | Tests |
|---|---|---|
| `authStore` | ✅ Done | ✅ |
| `activeCallStore` | ✅ Done | ✅ |
| `callStore` | ✅ Done | ✅ |
| `presenceStore` | ✅ Done | ✅ |
| `themeStore`, `toastStore`, `userStore`, `notificationStore`, `privacyStore`, `contactsDrawerStore`, `devicePreferences` | ✅ Done | ❌ No unit tests |

---

## Real-Time and LiveKit (all complete — unchanged)

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
| E2E: call flow (`calls.spec.ts`, 26 tests) | ⚠️ Incoming-call socket mocking is now real (4 tests genuinely fixed) — **but ~20 tests that call `injectAuthSession()` and expect an authenticated view are still blocked by the unfixed auth mock (P1 #1)**; 5 tests explicitly `test.skip()`-ed pending LiveKit integration setup; 1 test (unauthenticated redirect) passes independent of the bug |
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

**Recommendation for next cycle:** fix P1 #1 (one function, ~5 lines) before adding any more E2E tests — every new test that relies on `injectAuthSession()` inherits the same silent failure mode until the `/auth/me` route is mocked.

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
