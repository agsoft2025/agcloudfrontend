# Testing & performance — P2 work summary

This documents the P2 improvements completed in this pass: unit/component
test coverage, the 5 previously-skipped LiveKit E2E tests, and the bundle
size / Lighthouse audit. It also records what could not be executed in this
sandbox and exactly what's needed to finish verifying it.

## 1. New unit tests — stores (7 files, all passing)

`tests/unit/theme.store.test.ts`, `toast.store.test.ts`, `user.store.test.ts`,
`notification.store.test.ts`, `privacy.store.test.ts`,
`contacts-drawer.store.test.ts`, `device-preferences.test.ts`.

Together these cover: SSR-safe `browser` guards, `localStorage`
persistence/hydration (including malformed-JSON and missing-field fallback
paths, tested via `vi.resetModules()` + dynamic re-import so the module-load
hydration logic actually re-runs), optimistic-update rollback (privacy
store's unblock flow), timer-driven auto-dismiss (toast store, using
`vi.useFakeTimers()`), and plain derived/writable store contracts.

## 2. New component tests (3 files, all passing)

- `tests/unit/HomeSidebar.test.ts` (20 tests) — navigation active-states,
  the Contacts-drawer toggle-vs-navigate branching, logout (including the
  "API fails but we still sign out locally" path), user-info fallbacks, and
  the mobile drawer.
- `tests/unit/ParticipantTile.test.ts` (25 tests) — avatar-initial
  generation, deterministic avatar-hue, aria-label composition
  (speaking/pinned suffixes), the pin button (including
  `stopPropagation`), status badges, and the video-track-present path.
  `ParticipantTileHarness.svelte` exists solely because Svelte 5 removed
  `component.$on(...)` — the harness re-exposes the `togglePin` event as a
  plain callback prop so it can be asserted on directly.
- `tests/unit/CallSession.test.ts` (24 tests) — the largest and most
  involved of the three (CallSession.svelte is ~2,500 lines). Covers the
  disconnected-vs-connected UI (waiting overlay, connection badge,
  participant counts, grid layout), mic/camera/screen-share toggles via a
  mocked `liveKitClient`, the control-error banner and its dismissal, raise
  hand, the "no active tracks" guard on the record button (real
  `MediaRecorder`/`getUserMedia` aren't available in jsdom — see
  limitations below), the full add-people flow (load/error/invite/close),
  and the rejection-via-`callLifecycleEvents` real-time path. `callStore`
  is mocked as a bare writable (see the file's top comment) because the
  real store only exposes mutation methods shaped around a live LiveKit
  `Room`, not a plain "set this state" API — mocking it is what makes
  arbitrary connected/disconnected/multi-participant fixtures possible
  without a real Room object. `CallSessionHarness.svelte` mirrors the
  `ParticipantTileHarness` pattern for asserting on the dispatched
  `endCall` event.

**Full suite result:** `368 / 373` unit+component tests pass. The other 5
were already failing before this pass and are unrelated to this work — see
§4.

## 3. The 5 previously-skipped LiveKit Playwright tests

**Short version: these cannot be executed from this sandbox, for the same
underlying reason identified in the prior E2E-auth-fix pass — no Docker
daemon, and no network egress to the provisioned LiveKit Cloud project. That
constraint hasn't changed. What's new in this pass is that the tests
themselves are now fully written, not just stubbed, so they're ready to run
the moment they're pointed at a reachable LiveKit deployment.**

Why they can't be faked instead: all 5 (add participant, screen-share
start/stop, recording start/stop, leave call) only render once
`CallSession` has mounted, which only happens after a **real** LiveKit room
connection succeeds. That's a genuine WebRTC handshake — ICE candidate
exchange, DTLS, SRTP — over an actual signaling + media server. Playwright's
`page.route()` and `page.routeWebSocket()` (already used elsewhere in this
suite to mock Socket.IO) can fake plain HTTP/WebSocket traffic, but they
cannot stand in for a WebRTC media server; faking one properly would mean
building a mock LiveKit server, which is a different (and much larger)
project than "write the test."

**What was built instead:** `tests/e2e/calls.livekit.spec.ts` — full
implementations of all 5 flows, gated behind `RUN_LIVEKIT_E2E=1` so they
never run (and never silently fail) anywhere this isn't explicitly opted
into. A matching `chromium-livekit` Playwright project was added to
`playwright.config.ts` (fake media devices + auto-granted camera/mic/screen
permissions, so `getUserMedia`/`getDisplayMedia` resolve immediately in a
headless run instead of blocking on an OS picker). The default `chromium`
project explicitly ignores this file, so none of the existing 60 tests are
affected — verified with `npx playwright test --list`.

Good news on infrastructure: **no self-hosted LiveKit server is needed.**
`backend/.env` already has a provisioned LiveKit Cloud project
(`LIVEKIT_URL=wss://ag-cloud-7afkjq3g.livekit.cloud` + API key/secret), and
`frontend/.env`'s `VITE_LIVEKIT_URL` points at the same project. Any machine
with normal internet egress — a developer laptop or CI runner, just not this
sandbox — can run these tests against that real project with zero extra
setup.

To actually run them, you'll need to fill in three env vars this file
can't know on its own — two seeded backend accounts that are already
contacts of each other, plus a third contact used only by the add-participant
test:

```
RUN_LIVEKIT_E2E=1 \
LIVEKIT_E2E_USER_A_EMAIL=... LIVEKIT_E2E_USER_A_PASSWORD=... \
LIVEKIT_E2E_USER_B_EMAIL=... LIVEKIT_E2E_USER_B_PASSWORD=... \
LIVEKIT_E2E_USER_C_EMAIL=... \
  npx playwright test --project=chromium-livekit
```

**Honesty check:** this file has been reviewed against the real
`CallSession.svelte` markup (exact aria-labels, button disabled-states,
event flow) and against the real API call graph (`GlobalCallManager` →
`leaveCall()` → `POST /calls/:id/leave`, confirmed by reading the source —
notably, the in-app "End call" button reachable from Home calls
`leaveCall()`, not `endCall()`; that distinction matters and is called out
in the file). It has **not** been executed end-to-end, because no reachable
LiveKit deployment exists in this environment. Treat it as reviewed-but-
unverified until it's run once against real infrastructure.

## 4. Two pre-existing, unrelated test failures (found, not introduced)

While running the full suite, 5 tests across 2 files were already failing,
predating this session entirely (file timestamps: `index.test.ts` — Jun 3;
`auth-header.test.ts` — Jul 2; every file added in this pass is timestamped
Jul 29). Left as-is since fixing them wasn't in scope, but documented so
they aren't mistaken for a regression introduced here:

- `tests/unit/auth-header.test.ts` (3 tests) — `vi.stubGlobal('fetch', ...)`
  doesn't intercept the request; `apiFetch()` fails with a real
  `ECONNREFUSED` to `127.0.0.1:3000`, suggesting the client module holds a
  reference to `fetch` that isn't picked up by the global stub.
- `tests/unit/index.test.ts` (2 tests) — assertions no longer match the
  current markup (e.g. expects a "Sign in" heading and a "One-to-One Call"
  button that aren't in the rendered output), i.e. a stale test versus
  current component markup.

## 5. Bundle size audit

Built with `vite build` (SvelteKit + adapter-auto) and measured by walking
the Vite manifest's **static** import graph per route (dynamic imports are
correctly excluded — they're fetched on demand, not part of the initial
payload) and gzip-measuring every file in that graph. Script used is
reproducible — see the shell history pattern: load
`.svelte-kit/output/client/.vite/manifest.json`, resolve each route's
`app.js` + layout node(s) + page node, recurse only through `.imports`
(never `.dynamicImports`), gzip each resulting file with Node's `zlib`.

**Before:**

| Route | Initial JS (gzip) | Initial CSS (gzip) |
|---|---|---|
| `/signin` | 59.0 kB | 26.1 kB |
| `/home` | **206.5 kB** | 37.7 kB |

**Root cause:** `home/+layout.svelte` (and the currently-unused
`(app)/+layout.svelte`) statically imported `GlobalCallManager.svelte`,
which statically imports `CallSession.svelte`, which statically imports
`livekit-client` — putting the *entire* LiveKit SDK (~118 kB gzipped, by far
the single largest dependency in the app) on the critical path for every
visit to `/home`, even for a user who never places a call.

**Fix:** both layouts now lazy-load `GlobalCallManager` via a dynamic
`import()` inside `onMount`, rendered with `<svelte:component>` once
resolved, instead of a static top-level import. The call overlay is still
ready within a tick or two of the page becoming interactive (well before a
user could plausibly click "Call"), but it's no longer blocking the initial
bundle. `/call/[roomName]/+page.svelte` was deliberately left as a static
import — that route *is* the call screen, so eagerly loading `CallSession`
there is correct, not a regression.

**After:**

| Route | Initial JS (gzip) | Initial CSS (gzip) | Target (JS) |
|---|---|---|---|
| `/signin` | 59.0 kB | 26.1 kB | ✅ under 80 kB |
| `/home` | **68.5 kB** | 29.9 kB | ✅ under 80 kB |

Both routes' initial JavaScript now sit under the 80 KB target (`/home`
dropped ~138 kB gzipped, a 66% cut). `svelte-check` reports 0 errors after
the change, and the full unit/component suite (368 passing tests) shows no
regressions.

Further headroom exists if it's ever needed again: `socket.io-client` and
parts of the auth/API client are still in the eager graph for every route
(they're needed for the incoming-call banner and session check, so removing
them isn't free), but they're small relative to what was just cut.

## 6. Lighthouse audit — 100% complete

**Status update: this task is now fully complete.** Both `/signin` and
`/home` have real, verified Lighthouse performance runs. Previously only
`/signin` was measurable because Lighthouse's headless Chrome has no
session cookie and the app's client-side auth guard
(`+layout.svelte`'s `$authStore.isAuthenticated` check) redirected it
straight back to `/signin` — confirmed at the time via the report's
`finalDisplayedUrl`. That blocker is now resolved (see "How `/home` was
unblocked" below), giving a real authenticated run rather than a proxy.

Ran against the production build's preview server (`vite preview`, port
4173), built with `VITE_API_BASE_URL=http://localhost:3000` explicitly set
(see the note on origin mismatch below), using Lighthouse 13 with the
pre-installed sandbox Chromium (`--headless=new --no-sandbox`), performance
category only, desktop preset.

| Metric | `/signin` | `/home` | Required |
|---|---|---|---|
| Performance score | **99 / 100** | **99 / 100** | ≥ 90 ("good", Lighthouse's own threshold) |
| First Contentful Paint | 0.5 s | 0.6 s | < 1.8 s |
| Largest Contentful Paint | 1.0 s | 0.9 s | < 2.5 s |
| Total Blocking Time | 0 ms | 0 ms | < 200 ms |
| Cumulative Layout Shift | 0 | 0 | < 0.1 |
| Speed Index | 0.5 s | 0.6 s | < 3.4 s |
| Time to Interactive | 1.0 s | 0.9 s | — |

Both pages clear every Core Web Vitals threshold by a wide margin — this
was not a borderline pass. (`/signin`'s score moved from 98 to 99 between
runs purely from measurement noise plus the same image fix described
below; nothing else changed there.)

**How `/home` was unblocked:** rather than needing a live backend, I drove
the audit with Puppeteer (`puppeteer-core`, pointed at the sandbox's
pre-installed Chromium) instead of Lighthouse's bare CLI. Puppeteer's
`page.setRequestInterception()` mocks the same four network dependencies
the app's `/home` route needs on mount — `GET /auth/me` (session check),
`GET /users` (contact list), `GET /calls/history` (recent calls), and the
Socket.IO polling handshake — the same mocks already used in the Playwright
E2E suite. The mocked page is primed once to confirm real authenticated
rendering (title becomes "Contacts | AG Cloud", not "Sign in | AG Cloud"),
then handed directly to Lighthouse's Node API (`lighthouse(url, opts,
config, page)`), which reuses that already-authenticated page instead of
opening a fresh, unauthenticated tab.

**A real bug this surfaced, fixed along the way:** the first attempt at
this still failed — `/auth/me` was being mocked correctly but the browser
blocked it with a CORS error (`No 'Access-Control-Allow-Origin' header`).
The app (port 4173) and the mocked API (port 3000) are different origins
even though both are "localhost," and a `credentials: 'include'` fetch
across origins requires the response to carry
`Access-Control-Allow-Origin`/`Access-Control-Allow-Credentials` headers.
Puppeteer's mocked responses don't add these by default, so they had to be
set explicitly. **This is very likely the same root cause behind a chunk of
the 42 E2E test failures reported in the "testing confidence" discussion**
— `frontend/.env`'s `VITE_API_BASE_URL` points at a devtunnel host, and if
that suite's dev server wasn't started with an explicit
`VITE_API_BASE_URL=http://localhost:3000` override, its app origin and its
mocked API origin would mismatch the same way. That's flagged here as a
lead for whoever picks up the remaining E2E work — it wasn't re-verified
against the full suite as part of this Lighthouse task, since that's a
separate piece of work.

**One real, fixed issue — image dimensions:** the only sub-audit below a
perfect score on either page was "Image elements do not have explicit
`width` and `height`" (0.5/1), flagging `/logo.png` (used in
`HomeSidebar.svelte`, `AuthShell.svelte` ×2, and `CallSession.svelte`) and
`/authimg1.png` (`AuthShell.svelte`). Both were already fully constrained
by CSS (`object-fit: contain` inside a fixed-aspect-ratio or fixed-height
container), so adding `width`/`height` attributes matching each PNG's
actual pixel dimensions (477×312 and 2000×1505) is purely informational for
the browser's layout-reservation — it changes nothing visually, verified
against the existing `HomeSidebar.test.ts` (still 20/20) and
`CallSession.test.ts` (still 24/24) suites, plus a clean `svelte-check`.
After the fix, `unsized-images` scores 1/1 on both pages.

A few secondary "opportunity" audits remain below 1 on `/home`
(`unused-javascript`, `render-blocking-insight`, `forced-reflow-insight`,
`unused-css-rules`, `cache-insight`) but none of them pull the category
score down meaningfully, and two are not really app-code issues:
`cache-insight` is about HTTP cache headers, which `vite preview` doesn't
set the way a real production host/CDN would — that's a deployment config
concern, not something to fix in the app. `unused-javascript` flags the
lazily-loaded LiveKit chunk (still ~118 kB, per §5) as mostly unused during
a page load where no call happens — true, but it's loaded specifically so
`GlobalCallManager` can catch an *incoming* call promptly; delaying it
further would trade call-answering responsiveness for a metric that's
already not hurting the actual score. Documented here rather than chased,
since the required checks (Performance ≥ 90, all Core Web Vitals in the
"good" range) are already clearly met on both routes.

Given `/signin` and `/home` share almost the entire critical-path bundle
(per §5, both sit in the same ~60–70 kB JS band), it's unsurprising their
scores converged once `/home` was actually measurable — its own render
cost (contact list fetch, `ResizeObserver`-driven grid layout) turned out
not to add meaningful overhead on top of the shared bundle.

## 7. Everything that changed

New files:
- `tests/unit/theme.store.test.ts`
- `tests/unit/toast.store.test.ts`
- `tests/unit/user.store.test.ts`
- `tests/unit/notification.store.test.ts`
- `tests/unit/privacy.store.test.ts`
- `tests/unit/contacts-drawer.store.test.ts`
- `tests/unit/device-preferences.test.ts`
- `tests/unit/HomeSidebar.test.ts`
- `tests/unit/ParticipantTile.test.ts`
- `tests/unit/ParticipantTileHarness.svelte`
- `tests/unit/CallSession.test.ts`
- `tests/unit/CallSessionHarness.svelte`
- `tests/e2e/calls.livekit.spec.ts`

Modified files:
- `playwright.config.ts` — added the `chromium-livekit` project, scoped to
  the new spec file only.
- `src/routes/home/+layout.svelte` — lazy-load `GlobalCallManager`.
- `src/routes/(app)/+layout.svelte` — same fix, for consistency (this route
  group currently has no pages under it, so it doesn't affect the measured
  bundle today, but would reintroduce the same regression if adopted later
  without the fix).
- `src/lib/components/home/HomeSidebar.svelte` — added `width`/`height` to
  the `/logo.png` `<img>` (Lighthouse `unsized-images` fix, §6).
- `src/lib/components/auth/AuthShell.svelte` — same fix for its two
  `/logo.png` instances plus `/authimg1.png`.
- `src/lib/components/calls/CallSession.svelte` — same fix for its
  `/logo.png` instance.
