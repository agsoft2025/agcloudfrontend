import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Live-LiveKit integration tests
// ─────────────────────────────────────────────────────────────────────────────
//
// The 5 features below only render once CallSession has actually mounted,
// which only happens after a REAL LiveKit room connection succeeds — a
// WebRTC handshake (ICE candidate exchange, DTLS, SRTP) that cannot be
// faked with Playwright's page.route()/page.routeWebSocket(). Those tools
// mock plain HTTP/WebSocket traffic; they cannot stand in for a WebRTC
// media server. That is why calls.spec.ts stubs these 5 with test.skip().
//
// This file contains the FULL implementations, ready to run as soon as a
// real LiveKit deployment is reachable. It is gated behind an env var and
// skipped by default everywhere else (CI, this sandbox) so it never
// silently fails for lack of infrastructure.
//
// ── Why no self-hosted LiveKit server is needed ─────────────────────────────
// backend/.env already has a provisioned LiveKit Cloud project:
//   LIVEKIT_URL=wss://ag-cloud-7afkjq3g.livekit.cloud
//   LIVEKIT_API_KEY=...
//   LIVEKIT_API_SECRET=...
// frontend/.env's VITE_LIVEKIT_URL points at the same project. Any machine
// with normal internet egress (i.e. not this sandbox, which sits behind an
// allowlist proxy that blocks *.livekit.cloud) can run these against that
// real project with zero extra setup — no Docker, no local livekit-server.
//
// ── Prerequisites to actually run this file ─────────────────────────────────
//   1. Two seeded backend accounts that are already contacts of each other
//      (the add-participant/contacts flow depends on that relationship).
//      Provide their credentials via env vars (see below) — this file does
//      not know what accounts exist in your database.
//   2. The real backend running and reachable at VITE_API_BASE_URL (default
//      http://localhost:3000), configured with real LiveKit Cloud creds.
//   3. The real frontend dev server (this is a normal Playwright E2E run —
//      see playwright.config.ts for baseURL / webServer wiring).
//   4. Network egress from the test runner to *.livekit.cloud (or your own
//      self-hosted livekit-server, if you point LIVEKIT_URL at one instead).
//
// ── Run ──────────────────────────────────────────────────────────────────────
//   RUN_LIVEKIT_E2E=1 \
//   LIVEKIT_E2E_USER_A_EMAIL=alice@example.com LIVEKIT_E2E_USER_A_PASSWORD=... \
//   LIVEKIT_E2E_USER_B_EMAIL=bob@example.com   LIVEKIT_E2E_USER_B_PASSWORD=... \
//   LIVEKIT_E2E_USER_C_EMAIL=carol@example.com \
//     npx playwright test --project=chromium-livekit
//
// (User C is a third, not-yet-in-the-call contact of User A, used only by
// the "Add participant" test — omit it and that one test alone will skip.)
//
// This file has NOT been executed in this environment (no Docker daemon and
// no network egress to LiveKit Cloud from this sandbox — see the project's
// test-limitations notes). It has been written and reviewed against the
// actual CallSession.svelte markup (aria-labels, button states) so the
// selectors below are correct as of this codebase, but the flows themselves
// are unverified end-to-end pending a run against real infrastructure.

const RUN = Boolean(process.env.RUN_LIVEKIT_E2E);
const API_BASE = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const USER_A = {
  email: process.env.LIVEKIT_E2E_USER_A_EMAIL ?? '',
  password: process.env.LIVEKIT_E2E_USER_A_PASSWORD ?? '',
};
const USER_B = {
  email: process.env.LIVEKIT_E2E_USER_B_EMAIL ?? '',
  password: process.env.LIVEKIT_E2E_USER_B_PASSWORD ?? '',
};
const USER_C_EMAIL = process.env.LIVEKIT_E2E_USER_C_EMAIL ?? '';

test.skip(
  !RUN,
  'Requires a reachable LiveKit deployment + seeded test accounts — set RUN_LIVEKIT_E2E=1 ' +
    'and the LIVEKIT_E2E_USER_* env vars documented at the top of this file to enable.',
);

// ── Real sign-in (no auth mocking — a genuine session cookie is required for
// the backend to accept the /calls/initiate and /livekit/token requests) ────

async function realSignIn(page: Page, email: string, password: string) {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
}

/** Wait until CallSession has mounted and the real LiveKit room reports Connected. */
async function waitForConnected(page: Page) {
  await expect(page.locator('.connection-badge')).toHaveText('Connected', { timeout: 20_000 });
}

async function startVideoCall(callerPage: Page, calleeName: string) {
  await callerPage.goto('/home');
  await callerPage.getByRole('option', { name: new RegExp(calleeName, 'i') }).click();
  await callerPage.getByRole('button', { name: `Video call ${calleeName}` }).click();
}

async function acceptIncomingCall(calleePage: Page, callerName: string) {
  await expect(calleePage.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
  await calleePage.getByRole('button', { name: `Accept call from ${callerName}` }).click();
}

test.describe('Live LiveKit call features', () => {
  let calleeContext: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    calleeContext = await browser.newContext();
  });

  test.afterEach(async () => {
    await calleeContext.close();
  });

  test('Add participant: inviting a contact mid-call sends the invite and shows it as sent', async ({
    page,
  }) => {
    test.skip(!USER_C_EMAIL, 'Set LIVEKIT_E2E_USER_C_EMAIL to run this test.');

    const calleePage = await calleeContext.newPage();
    await realSignIn(page, USER_A.email, USER_A.password);
    await realSignIn(calleePage, USER_B.email, USER_B.password);

    await startVideoCall(page, 'User B');
    await acceptIncomingCall(calleePage, 'User A');

    await waitForConnected(page);
    await waitForConnected(calleePage);

    await page.getByRole('button', { name: 'Add people to this call' }).click();
    await expect(page.getByRole('dialog', { name: 'Add people to call' })).toBeVisible();

    const contactRow = page.locator('.add-people-row', { hasText: USER_C_EMAIL });
    await expect(contactRow).toBeVisible({ timeout: 10_000 });
    await contactRow.getByRole('button', { name: 'Add' }).click();

    await expect(contactRow.getByText('Invite Sent')).toBeVisible();
  });

  test('Screen share: starting and stopping updates the control and the presenter banner', async ({
    page,
  }) => {
    const calleePage = await calleeContext.newPage();
    await realSignIn(page, USER_A.email, USER_A.password);
    await realSignIn(calleePage, USER_B.email, USER_B.password);

    await startVideoCall(page, 'User B');
    await acceptIncomingCall(calleePage, 'User A');

    await waitForConnected(page);
    await waitForConnected(calleePage);

    // The chromium-livekit Playwright project (playwright.config.ts) passes
    // --auto-select-desktop-capture-source so getDisplayMedia() resolves
    // immediately instead of blocking on an OS picker that never appears
    // headlessly. Run this file with --project=chromium-livekit.
    await page.getByRole('button', { name: 'Share screen' }).click();
    await expect(page.getByRole('button', { name: 'Stop sharing screen' })).toBeVisible({
      timeout: 10_000,
    });

    // The callee should see the presenter banner naming the sharer.
    await expect(calleePage.getByText(/is presenting/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Stop sharing screen' }).click();
    await expect(page.getByRole('button', { name: 'Share screen' })).toBeVisible();
  });

  test('Recording: start and stop toggle the REC badge and call the record API', async ({ page }) => {
    const calleePage = await calleeContext.newPage();
    await realSignIn(page, USER_A.email, USER_A.password);
    await realSignIn(calleePage, USER_B.email, USER_B.password);

    await startVideoCall(page, 'User B');
    await acceptIncomingCall(calleePage, 'User A');

    await waitForConnected(page);
    await waitForConnected(calleePage);

    const recordRequest = page.waitForRequest(
      (req) => req.url().includes('/record/start') && req.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Start recording' }).click();
    await recordRequest;

    await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTitle(/Recording:/i)).toBeVisible();

    const stopRequest = page.waitForRequest(
      (req) => req.url().includes('/record/stop') && req.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await stopRequest;

    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible();
    await expect(page.getByTitle(/Recording:/i)).not.toBeVisible();
  });

  test('Leave call: leaving hits the leave API and returns the user to /home', async ({ page }) => {
    const calleePage = await calleeContext.newPage();
    await realSignIn(page, USER_A.email, USER_A.password);
    await realSignIn(calleePage, USER_B.email, USER_B.password);

    await startVideoCall(page, 'User B');
    await acceptIncomingCall(calleePage, 'User A');

    await waitForConnected(page);
    await waitForConnected(calleePage);

    const leaveRequest = page.waitForRequest(
      (req) => req.url().includes('/leave') && req.method() === 'POST',
    );
    // The in-call "leave" affordance is the End call control — it ends the
    // session for the local participant via calls.api#leaveCall(), distinct
    // from the error-page "Leave" button (tested in calls.spec.ts) which
    // navigates home directly without hitting the API at all.
    await page.getByRole('button', { name: 'End call' }).click();
    await leaveRequest;

    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });
});
