# AG Cloud Frontend — Development Status Report

**Date:** September 4, 2026
**Branch:** `dev` (HEAD `8dec064` — merge of `4fa4961` "video call issue ressolved")
**Prepared by:** Claude Code (code review of actual source files + git history)
**Previous report:** `documents/Frontend-Status-Report-2026-07-29.md`

---

## What Changed Since July 29

Four commits landed (`b0336c1..8dec064`), touching 32 files. This is the most substantial cycle since the initial build-out — it clears **every P1 and P2 item** carried forward from the last three reports.

| Commit | Date | Summary |
|---|---|---|
| `362f921` | Jul 30 | "e2e testing added" — 7 new store unit-test files, 3 new component test files, the 5 previously-skipped LiveKit E2E tests written in full (`calls.livekit.spec.ts`), lazy-loading of `GlobalCallManager` in both app layouts, image `width`/`height` attributes, `TESTING_AND_PERFORMANCE.md` |
| `e76fa93` / PR #16 | Jul 31 | "deployment issue resolved" — `firebase` promoted from a transitive `@firebase/app` import to a direct `dependencies` entry; `messaging.ts` import path fixed to match |
| `4fa4961` | Jul 31 | "video call issue ressolved" — guards against contacts with a missing/null `email` (`getDisplayName()` in 4 files, plus a search-filter guard in `ContactList.svelte`) |
| `8dec064` | Jul 31 | Merge of the above into `dev` |

---

## Overall Progress

| Area | Progress | Status |
|---|---|---|
| Auth screens | ✅ 100% | Stable |
| Call flow (initiate / accept / end / leave) | ✅ 100% | Stable; null-email crash fixed |
| LiveKit integration | ✅ 99% | Unchanged |
| Component library | ✅ 100% | Unchanged |
| Routing | ✅ 100% | All 14 spec routes |
| State management | ✅ 100% | **All 11 stores now have unit tests** (was 4/11) |
| API layer | ✅ 100% | Unchanged |
| Theme system | ✅ 100% | |
| PWA / Service Worker | ✅ 95% | Unchanged |
| Real-time / Socket.IO | ✅ 100% | Unchanged |
| Firebase FCM | ✅ 90% | Import-path bug fixed (see P1 history below) |
| Bundle size | ✅ 100% | `/home` initial JS cut from 206.5 kB → 68.5 kB gzip (both routes now under the 80 kB spec target) |
| Lighthouse | ✅ 100% | `/signin` 99/100, `/home` 99/100 — first real authenticated `/home` measurement |
| Testing | ✅ ~95% | 368/373 unit+component tests passing; **the E2E auth-mock blocker (P1, three prior reports) is now fixed across all specs**; 5 LiveKit E2E tests fully written but gated behind `RUN_LIVEKIT_E2E=1` (needs real LiveKit Cloud egress — not runnable in a sandboxed CI, but is on a real dev machine) |

---

## What Was Fixed This Cycle

### 1. E2E auth-mock blocker — resolved (was P1 for three consecutive reports)

The July 17/29 reports identified that `injectAuthSession()` only seeded `localStorage`, while `authStore.initialize()` (called from root `+layout.svelte` on every mount) actually verifies the session via a cookie-based `GET /auth/me`. Since nothing mocked that endpoint, every test relying on an authenticated view was silently redirected to `/signin`.

This is now fixed with a shared `tests/e2e/helpers/auth.ts`, used consistently across `auth.spec.ts`, `calls.spec.ts`, and `home.spec.ts` (previously each file had its own copy-pasted, broken `injectAuthSession`). It routes `GET ${API_BASE}/auth/me` to return a mock user *and* seeds the legacy `localStorage` keys for the handful of assertions that still check them directly. The stale comment on `src/routes/+layout.svelte:9` ("Re-read auth session from localStorage") — flagged as misleading in the last report — was also corrected to describe what the code actually does.

**Net effect:** the ~20 previously-blocked tests in `calls.spec.ts` should now reach their authenticated assertions instead of timing out at the sign-in redirect. This was not re-executed in this review (see Testing section below for why), but the fix is structurally correct and applied uniformly.

### 2. Full unit/component test coverage for previously-untested stores and components

7 new store test files close every gap listed in the last three reports' P2 #2: `theme.store`, `toast.store`, `user.store`, `notification.store`, `privacy.store`, `contacts-drawer.store`, `device-preferences`. 3 new component test files close P2 #3: `HomeSidebar.test.ts` (20 tests), `ParticipantTile.test.ts` (25 tests), `CallSession.test.ts` (24 tests, the largest — covers mic/camera/screen-share toggles, the control-error banner, raise-hand, add-people flow, and the real-time rejection path via `callLifecycleEvents`).

Per `TESTING_AND_PERFORMANCE.md`, the full suite reports 368/373 passing. The 5 failures (`auth-header.test.ts` ×3, `index.test.ts` ×2) predate this cycle and are documented as pre-existing, unrelated to the work here (stale `fetch` stubbing and stale markup assertions, respectively) — **not independently re-verified in this review**.

### 3. Bundle size — LiveKit SDK no longer blocks `/home`'s initial load

Both `home/+layout.svelte` and `(app)/+layout.svelte` statically imported `GlobalCallManager` → `CallSession` → `livekit-client` (~118 kB gzipped, the largest single dependency), meaning every visit to `/home` downloaded the entire LiveKit SDK before a user could even open the contacts list. Both layouts now `import()` `GlobalCallManager` lazily inside `onMount` and render it via `<svelte:component>` once resolved — it's still ready within a tick or two, well before a user could click "Call," but is off the critical path. Measured result: `/home` initial JS gzip dropped from 206.5 kB to 68.5 kB (a 66% cut), bringing both `/signin` and `/home` under the spec's 80 kB target. `/call/[roomName]/+page.svelte` deliberately keeps its static import, since that route *is* the call screen.

### 4. Lighthouse audit completed for both routes

Previously only `/signin` was measurable — Lighthouse's headless Chrome has no session cookie, so the client-side auth guard bounced it straight back from `/home`. This cycle drove the audit through Puppeteer instead, mocking the four network calls `/home` needs on mount (`/auth/me`, `/users`, `/calls/history`, Socket.IO handshake) and handing the already-authenticated page to Lighthouse's Node API. Result: **99/100 on both `/signin` and `/home`**, all Core Web Vitals well inside "good" thresholds. One real fix came out of this: `/logo.png` and `/authimg1.png` lacked explicit `width`/`height`, costing the `unsized-images` sub-audit — fixed across `HomeSidebar.svelte`, `AuthShell.svelte` (×2), and `CallSession.svelte`, purely additive since layout was already CSS-constrained.

A CORS gap surfaced during this work — Puppeteer's mocked `/auth/me` response needed explicit `Access-Control-Allow-Origin`/`-Credentials` headers to be accepted by a cross-origin `credentials: 'include'` fetch — is flagged in `TESTING_AND_PERFORMANCE.md` as a plausible contributor to E2E flakiness if a dev server's `VITE_API_BASE_URL` doesn't match its own origin. Worth checking if E2E failures resurface.

### 5. Firebase import path — real deployment bug fixed

`messaging.ts` imported from the scoped subpackage `@firebase/app` without `firebase` itself ever being declared as a direct dependency — it happened to resolve locally via some other package's transitive install, which is exactly the kind of thing that breaks in a clean CI/production install. Fixed by adding `firebase: ^12.17.0` to `dependencies` and switching the import to `firebase/app`.

### 6. Null-email crash in contact display — real bug fixed

`getDisplayName()` (duplicated across `ContactDetail.svelte`, `ContactList.svelte`, `calls/[id]/+page.svelte`, `contacts/[id]/+page.svelte`) called `c.email.split('@')` unconditionally — a contact record with no `email` (e.g. depending on how the backend populates some user types) would throw and break rendering. All four call sites now short-circuit to `'Unknown'` when `email` is falsy; `ContactList.svelte`'s search filter got the matching `(c.email ?? '')` guard.

---

## Remaining Issues

### P2 — Polish / nice to have

| # | Issue | Notes |
|---|---|---|
| 1 | **`getDisplayName()` is duplicated in 4 files** | The null-email fix (item 6 above) had to be applied identically in `ContactDetail.svelte`, `ContactList.svelte`, `calls/[id]/+page.svelte`, and `contacts/[id]/+page.svelte`. Worth extracting to a shared `$lib` helper next time any of the four needs touching, so a similar bug can't be fixed in 3 of 4 places by accident. |
| 2 | **5 LiveKit E2E tests are written but unverified** | `tests/e2e/calls.livekit.spec.ts` (add-participant, screen-share start/stop, recording start/stop, leave-call) requires a real LiveKit Cloud connection (`RUN_LIVEKIT_E2E=1` + 3 seeded test accounts) and cannot run in a sandboxed environment. Reviewed against source for correctness but never executed end-to-end — should be run once on a dev machine or CI runner with real network egress before being trusted. |
| 3 | **Pre-existing test failures not investigated this cycle** | `auth-header.test.ts` (3 tests, stale `fetch` stub) and `index.test.ts` (2 tests, stale markup assertions) — flagged as pre-existing in `TESTING_AND_PERFORMANCE.md`, not fixed or re-verified in this review. |
| 4 | **Minor Lighthouse opportunity audits on `/home`** | `unused-javascript` (the lazy LiveKit chunk, expected — it's preloaded for incoming-call responsiveness), `render-blocking-insight`, `forced-reflow-insight`, `unused-css-rules`, `cache-insight` (HTTP cache headers — a deployment/CDN concern, not app code). None affect the category score meaningfully. |
| 5 | **No lint script configured** | `package.json` still has no `lint` script (noted in `CLAUDE.md`). Not a regression, just still open. |

No P1 (production-blocking) items are currently known.

---

## Methodology note — tests were not executed in this review

`node_modules` in this working copy is only partially installed (47 packages, no `vitest` binary present), so the "368/373 passing" and "5 LiveKit tests unverified" figures above are taken from `TESTING_AND_PERFORMANCE.md`'s account of the session that made these changes, not independently re-run here. This report is a source-diff review, consistent with the July 17/29 reports' methodology. **Recommendation for next cycle:** run `npm install && npm run test` once from a clean environment to confirm the 368/373 figure and check whether the auth-mock fix actually unblocks the ~20 previously-stuck `calls.spec.ts` tests as expected.

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

## State Management

| Store | Status | Tests |
|---|---|---|
| `authStore` | ✅ Done | ✅ |
| `activeCallStore` | ✅ Done | ✅ |
| `callStore` | ✅ Done | ✅ |
| `presenceStore` | ✅ Done | ✅ |
| `themeStore` | ✅ Done | ✅ **new this cycle** |
| `toastStore` | ✅ Done | ✅ **new this cycle** |
| `userStore` | ✅ Done | ✅ **new this cycle** |
| `notificationStore` | ✅ Done | ✅ **new this cycle** |
| `privacyStore` | ✅ Done | ✅ **new this cycle** |
| `contactsDrawerStore` | ✅ Done | ✅ **new this cycle** |
| `devicePreferences` | ✅ Done | ✅ **new this cycle** |

Every store in the app now has unit test coverage — this closes an item that had been carried forward as "missing" in every report since the codebase was first reviewed.

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
| Lazy-loaded on `/home` (new) | ✅ Done — `GlobalCallManager` deferred to `onMount` so LiveKit SDK isn't on the critical path for non-call pages |

---

## Test Coverage

| Test | Status |
|---|---|
| E2E: auth flows | ✅ Done — auth-mock helper shared and fixed |
| E2E: home page | ✅ Done — auth-mock helper shared and fixed |
| E2E: call flow (`calls.spec.ts`, 26 tests) | ✅ Auth-mock blocker (P1 for 3 reports) now fixed via shared `tests/e2e/helpers/auth.ts`; not re-executed in this review to confirm |
| E2E: LiveKit-dependent flows (`calls.livekit.spec.ts`, 5 tests) | ⚠️ Written, reviewed against source, gated behind `RUN_LIVEKIT_E2E=1` — needs a real LiveKit Cloud connection to actually run |
| Unit: all 11 stores | ✅ Done (7 added this cycle) |
| Unit: `HomeSidebar`, `ParticipantTile`, `CallSession` | ✅ Done (added this cycle, 69 tests total) |
| Unit: modal, auth-header, index | ⚠️ `auth-header` (3) and `index` (2) reportedly failing, pre-existing, not fixed this cycle |

```bash
npm run test:unit    # Vitest
npm run test:e2e     # build + Playwright (chromium project; chromium-livekit needs RUN_LIVEKIT_E2E=1)
npm run test         # both
```

**Recommendation for next cycle:** run the full suite from a clean install to confirm the auth-mock fix actually unblocks the previously-stuck `calls.spec.ts` tests, and to re-verify the 368/373 figure independently. If a LiveKit Cloud-reachable environment is available, also run `chromium-livekit` with the 3 seeded test accounts to validate the 5 new tests end-to-end for the first time.

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

`firebase` is now a direct `dependencies` entry (`^12.17.0`) rather than an implicit transitive import — see "What Was Fixed This Cycle" item 5.
