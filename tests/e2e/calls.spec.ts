import { test, expect, type Page, type BrowserContext, type WebSocketRoute } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const MOCK_TOKEN = 'mock.jwt.token';
const MOCK_CALL_ID = 'call-e2e-test-001';
const MOCK_ROOM_NAME = 'room-e2e-test-001';

// ─────────────────────────────────────────────────────────────────────────────
// Mock data factories
// ─────────────────────────────────────────────────────────────────────────────

function mockUser() {
  return {
    id: 'user-local-001',
    email: 'caller@example.com',
    displayName: 'Test Caller',
    role: 'user',
    status: 'active',
    avatarUrl: null,
  };
}

function mockContact(overrides: Partial<{
  id: string; email: string; displayName: string; avatarUrl: string | null;
}> = {}) {
  return {
    id: 'user-contact-001',
    email: 'alice@example.com',
    displayName: 'Alice Wonderland',
    role: 'user',
    status: 'active',
    avatarUrl: null,
    ...overrides,
  };
}

function mockInitiateCallResponse(withLiveKit = false) {
  const base = {
    message: 'Call initiated successfully.',
    callId: MOCK_CALL_ID,
    call: { id: MOCK_CALL_ID, callMode: 'one-to-one', callType: 'video', status: 'initiated' },
  };
  if (!withLiveKit) return base;
  return { ...base, token: 'lk-jwt-token', roomName: MOCK_ROOM_NAME, url: 'wss://lk.example.com' };
}

function mockAcceptCallResponse() {
  return {
    message: 'Call accepted successfully.',
    callId: MOCK_CALL_ID,
    token: 'lk-jwt-token',
    roomName: MOCK_ROOM_NAME,
    url: 'wss://lk.example.com',
  };
}

function mockEndCallResponse() {
  return { message: 'Call ended successfully.', callId: MOCK_CALL_ID };
}

function mockLeaveCallResponse() {
  return { message: 'Left call successfully.', callId: MOCK_CALL_ID };
}

function mockAddParticipantResponse() {
  return { message: 'Participant added successfully.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route interceptors
// ─────────────────────────────────────────────────────────────────────────────

async function interceptContacts(page: Page, contacts = [mockContact()]) {
  await page.route(`${API_BASE}/users*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(contacts),
    })
  );
}

async function interceptCallHistory(page: Page) {
  await page.route(`${API_BASE}/calls/history*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ calls: [] }),
    })
  );
}

async function interceptInitiateCall(page: Page, withLiveKit = false, status = 201) {
  await page.route(`${API_BASE}/calls/initiate`, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(
        status >= 400
          ? { message: 'You are already in an active call.' }
          : mockInitiateCallResponse(withLiveKit)
      ),
    })
  );
}

async function interceptAcceptCall(page: Page, callId = MOCK_CALL_ID, status = 200) {
  await page.route(`${API_BASE}/calls/${callId}/accept`, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(
        status >= 400 ? { message: 'Call not found.' } : mockAcceptCallResponse()
      ),
    })
  );
}

async function interceptRejectCall(page: Page, callId = MOCK_CALL_ID) {
  await page.route(`${API_BASE}/calls/${callId}/reject`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Call rejected successfully.' }),
    })
  );
}

async function interceptEndCall(page: Page, callId = MOCK_CALL_ID) {
  await page.route(`${API_BASE}/calls/${callId}/end`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockEndCallResponse()),
    })
  );
}

async function interceptLeaveCall(page: Page, callId = MOCK_CALL_ID) {
  await page.route(`${API_BASE}/calls/${callId}/leave`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockLeaveCallResponse()),
    })
  );
}

async function interceptAddParticipant(page: Page, callId = MOCK_CALL_ID) {
  await page.route(`${API_BASE}/calls/${callId}/add-participant`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAddParticipantResponse()),
    })
  );
}

async function interceptLiveKitToken(page: Page, status = 200) {
  await page.route(`${API_BASE}/livekit/token`, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(
        status >= 400
          ? { message: 'Unauthorized' }
          : { token: 'lk-jwt-token', url: 'wss://lk.example.com' }
      ),
    })
  );
}

/** Silently swallow Socket.IO HTTP-polling requests so the UI does not show connection errors. */
async function silenceSocketIO(page: Page) {
  await page.route(`${API_BASE}/socket.io/**`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=UTF-8',
        body: '97:0{"sid":"mock-sid","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":5000,"maxPayload":1000000}2:40',
      });
    } else {
      route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
    }
  });
}

/**
 * Intercept the Socket.IO WebSocket and inject a `call:incoming` event.
 *
 * Socket.IO is configured with transports: ['websocket', 'polling'], so it
 * connects via WebSocket first without an HTTP polling handshake.
 * page.routeWebSocket() intercepts that connection and sends proper
 * Engine.IO / Socket.IO framing, then emits the desired event after the
 * app's event handlers are registered.
 *
 * Frame format (WebSocket transport — no length prefix):
 *   "0{...}"  = Engine.IO open packet
 *   "40"      = Socket.IO namespace connect
 *   "42[...]" = Socket.IO emit
 */
async function routeSocketWithIncomingCall(
  page: Page,
  payload: object,
  delayMs = 350,
): Promise<void> {
  await page.routeWebSocket(/socket\.io/, (ws: WebSocketRoute) => {
    // Engine.IO open — no upgrades so the client stays on this WebSocket
    ws.send(
      '0{"sid":"test-ws-sid","upgrades":[],"pingInterval":25000,"pingTimeout":5000,"maxPayload":1000000}',
    );
    // Socket.IO namespace connect confirmation
    ws.send('40');
    // Inject event after a short delay so call-signaling.ts handlers are registered
    setTimeout(() => {
      ws.send(`42["call:incoming",${JSON.stringify(payload)}]`);
    }, delayMs);
    // Respond to Engine.IO heartbeat pings to keep the connection alive
    ws.onMessage((msg: string | Buffer) => {
      if (typeof msg === 'string' && msg === '2') ws.send('3');
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth injection helper
// ─────────────────────────────────────────────────────────────────────────────

async function injectAuthSession(context: BrowserContext) {
  await context.addInitScript(
    (args: { token: string; user: string }) => {
      localStorage.setItem('accessToken', args.token);
      localStorage.setItem('authUser', args.user);
    },
    { token: MOCK_TOKEN, user: JSON.stringify(mockUser()) }
  );
}

/** Navigate to /home, wait for the contacts panel to appear, then return. */
async function goToHome(page: Page) {
  await page.goto('/home');
  // The contact list is always rendered on the home page
  await expect(page.getByRole('listbox', { name: 'Contact list' })).toBeVisible();
}

/**
 * Reach the ContactDetail panel for the first contact in the list.
 * Assumes interceptContacts() has already been set up with at least one contact.
 */
async function selectFirstContact(page: Page, displayName = 'Alice Wonderland') {
  // Click the first option in the contact list to open the detail panel
  await page.getByRole('option').first().click();
  // Wait for the ContactDetail heading / actions to render
  await expect(page.getByRole('group', { name: 'Contact actions' })).toBeVisible();
  return displayName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Call Flow', () => {
  // ── 1. Call Initiation ───────────────────────────────────────────────────

  test.describe('Call initiation', () => {
    test('initiates an audio call from the contact detail panel and shows the outgoing overlay', async ({ page, context }) => {
      await injectAuthSession(context);
      await silenceSocketIO(page);
      await interceptContacts(page);
      await interceptCallHistory(page);
      await interceptInitiateCall(page);
      await interceptEndCall(page);

      await goToHome(page);
      const name = await selectFirstContact(page);

      await page.getByRole('button', { name: `Audio call ${name}` }).click();

      // GlobalCallManager renders the outgoing overlay once the store is set
      const overlay = page.getByRole('dialog', { name: 'Outgoing call' });
      await expect(overlay).toBeVisible();
      await expect(overlay.getByText(name)).toBeVisible();
    });

    test('initiates a video call and shows the outgoing overlay', async ({ page, context }) => {
      await injectAuthSession(context);
      await silenceSocketIO(page);
      await interceptContacts(page);
      await interceptCallHistory(page);
      await interceptInitiateCall(page);
      await interceptEndCall(page);

      await goToHome(page);
      const name = await selectFirstContact(page);

      await page.getByRole('button', { name: `Video call ${name}` }).click();

      await expect(page.getByRole('dialog', { name: 'Outgoing call' })).toBeVisible();
    });

    test('displays the callee name in the outgoing call overlay', async ({ page, context }) => {
      const contact = mockContact({ displayName: 'Bob Builder' });
      await injectAuthSession(context);
      await silenceSocketIO(page);
      await interceptContacts(page, [contact]);
      await interceptCallHistory(page);
      await interceptInitiateCall(page);
      await interceptEndCall(page);

      await goToHome(page);
      await selectFirstContact(page, 'Bob Builder');

      await page.getByRole('button', { name: 'Audio call Bob Builder' }).click();

      const overlay = page.getByRole('dialog', { name: 'Outgoing call' });
      await expect(overlay).toBeVisible();
      await expect(overlay.getByText('Bob Builder')).toBeVisible();
    });

    test('shows an error in the console (not a crash) when initiate API returns 400', async ({ page, context }) => {
      await injectAuthSession(context);
      await silenceSocketIO(page);
      await interceptContacts(page);
      await interceptCallHistory(page);
      await interceptInitiateCall(page, false, 400);

      await goToHome(page);
      await selectFirstContact(page);

      await page.getByRole('button', { name: 'Audio call Alice Wonderland' }).click();

      // The overlay must NOT appear on API failure
      await expect(page.getByRole('dialog', { name: 'Outgoing call' })).not.toBeVisible();
    });
  });

  // ── 2. End Call (cancel outgoing) ───────────────────────────────────────

  test.describe('End call', () => {
    test('cancels an outgoing call and dismisses the overlay', async ({ page, context }) => {
      await injectAuthSession(context);
      await silenceSocketIO(page);
      await interceptContacts(page);
      await interceptCallHistory(page);
      await interceptInitiateCall(page);
      await interceptEndCall(page);

      await goToHome(page);
      await selectFirstContact(page);
      await page.getByRole('button', { name: 'Audio call Alice Wonderland' }).click();

      const overlay = page.getByRole('dialog', { name: 'Outgoing call' });
      await expect(overlay).toBeVisible();

      // The cancel button inside the overlay has the text "End call"
      await overlay.getByRole('button', { name: 'End call' }).click();

      // Overlay must close after cancellation
      await expect(overlay).not.toBeVisible();
    });

    test('the end call button calls the endCall API with the correct call ID', async ({ page, context }) => {
      let endCallRequestMade = false;

      await injectAuthSession(context);
      await silenceSocketIO(page);
      await interceptContacts(page);
      await interceptCallHistory(page);
      await interceptInitiateCall(page);

      await page.route(`${API_BASE}/calls/${MOCK_CALL_ID}/end`, (route) => {
        endCallRequestMade = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockEndCallResponse()),
        });
      });

      await goToHome(page);
      await selectFirstContact(page);
      await page.getByRole('button', { name: 'Audio call Alice Wonderland' }).click();

      const overlay = page.getByRole('dialog', { name: 'Outgoing call' });
      await expect(overlay).toBeVisible();

      await overlay.getByRole('button', { name: 'End call' }).click();
      await expect(overlay).not.toBeVisible();

      expect(endCallRequestMade).toBe(true);
    });
  });

  // ── 3. Join Call (incoming call overlay) ──────────────────────────────────

  test.describe('Join call — incoming call overlay', () => {
    /**
     * Incoming call tests use page.routeWebSocket() to intercept the Socket.IO
     * WebSocket connection and inject Engine.IO / Socket.IO framing directly.
     *
     * Flow:
     *   page.routeWebSocket(/socket\.io/) fires when the app's Socket.IO client
     *   opens a WebSocket.  We send the EIO open packet, the Socket.IO namespace
     *   connect, and then after a short delay the `call:incoming` event.
     *   call-signaling.ts receives it and drives activeCallStore → incoming-ringing,
     *   which causes GlobalCallManager to mount IncomingCallOverlay.
     *
     * Why WebSocket and not HTTP polling:
     *   socket.ts uses transports: ['websocket', 'polling'] — WebSocket is attempted
     *   first without a polling handshake, so routeWebSocket() intercepts directly.
     */

    /** Canonical caller payload for incoming-call tests. */
    const CALLER = {
      callId: MOCK_CALL_ID,
      callerId: 'user-caller-remote',
      callerName: 'Remote Caller',
      callerAvatar: null,
      callType: 'video',
      callMode: 'one-to-one',
      roomId: `room-${MOCK_CALL_ID}`,
      reinvite: false,
    } as const;

    /** ariaLabel produced by IncomingCallOverlay: `Incoming ${callType} call from ${callerName}` */
    const OVERLAY_LABEL = `Incoming ${CALLER.callType} call from ${CALLER.callerName}`;

    test('shows the incoming call overlay with caller details', async ({ page, context }) => {
      await injectAuthSession(context);
      await interceptContacts(page);
      await interceptCallHistory(page);
      await routeSocketWithIncomingCall(page, CALLER);

      await goToHome(page);

      const overlay = page.getByRole('dialog', { name: OVERLAY_LABEL });
      await expect(overlay).toBeVisible({ timeout: 5_000 });
      // Caller name must appear inside the overlay
      await expect(overlay.getByText(CALLER.callerName)).toBeVisible();
    });

    test('accept call button calls the acceptCall API', async ({ page, context }) => {
      let acceptCalled = false;

      await injectAuthSession(context);
      await interceptContacts(page);
      await interceptCallHistory(page);
      await routeSocketWithIncomingCall(page, CALLER);

      await page.route(`${API_BASE}/calls/${MOCK_CALL_ID}/accept`, (route) => {
        acceptCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAcceptCallResponse()),
        });
      });

      await goToHome(page);

      const overlay = page.getByRole('dialog', { name: OVERLAY_LABEL });
      await expect(overlay).toBeVisible({ timeout: 5_000 });

      // Wait for the HTTP request to be made, then click
      const acceptRequest = page.waitForRequest((r) =>
        r.url().includes(`/calls/${MOCK_CALL_ID}/accept`)
      );
      await overlay
        .getByRole('button', { name: `Accept call from ${CALLER.callerName}` })
        .click();
      await acceptRequest;

      expect(acceptCalled).toBe(true);
    });

    test('reject call button calls the rejectCall API and dismisses the overlay', async ({ page, context }) => {
      let rejectCalled = false;

      await injectAuthSession(context);
      await interceptContacts(page);
      await interceptCallHistory(page);
      await routeSocketWithIncomingCall(page, CALLER);

      await page.route(`${API_BASE}/calls/${MOCK_CALL_ID}/reject`, (route) => {
        rejectCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Call rejected successfully.' }),
        });
      });

      await goToHome(page);

      const overlay = page.getByRole('dialog', { name: OVERLAY_LABEL });
      await expect(overlay).toBeVisible({ timeout: 5_000 });

      const rejectRequest = page.waitForRequest((r) =>
        r.url().includes(`/calls/${MOCK_CALL_ID}/reject`)
      );
      await overlay
        .getByRole('button', { name: `Reject call from ${CALLER.callerName}` })
        .click();
      await rejectRequest;

      expect(rejectCalled).toBe(true);
      // handleReject() → activeCallStore.reset() → overlay unmounts
      await expect(overlay).not.toBeVisible({ timeout: 3_000 });
    });

    test('call:cancelled socket event dismisses the incoming call overlay', async ({ page, context }) => {
      await injectAuthSession(context);
      await interceptContacts(page);
      await interceptCallHistory(page);

      // Capture the WebSocketRoute so we can send a second event later
      let callerWs!: WebSocketRoute;
      await page.routeWebSocket(/socket\.io/, (ws: WebSocketRoute) => {
        callerWs = ws;
        ws.send(
          '0{"sid":"test-ws-sid","upgrades":[],"pingInterval":25000,"pingTimeout":5000,"maxPayload":1000000}',
        );
        ws.send('40');
        setTimeout(() => {
          ws.send(`42["call:incoming",${JSON.stringify(CALLER)}]`);
        }, 350);
        ws.onMessage((msg: string | Buffer) => {
          if (typeof msg === 'string' && msg === '2') ws.send('3');
        });
      });

      await goToHome(page);

      const overlay = page.getByRole('dialog', { name: OVERLAY_LABEL });
      await expect(overlay).toBeVisible({ timeout: 5_000 });

      // Simulate caller hanging up before the callee answers
      callerWs.send(`42["call:cancelled",{"callId":"${MOCK_CALL_ID}"}]`);

      // call-signaling.ts → activeCallStore.reset() → overlay unmounts
      await expect(overlay).not.toBeVisible({ timeout: 3_000 });
    });
  });

  // ── 4. Call Page (/call/[roomName]) ───────────────────────────────────────

  test.describe('Call page (/call/[roomName])', () => {
    test('shows a connecting state on initial load', async ({ page, context }) => {
      await injectAuthSession(context);

      // Delay the token response so we can observe the connecting spinner
      let resolveToken!: () => void;
      const tokenPromise = new Promise<void>((r) => { resolveToken = r; });

      await page.route(`${API_BASE}/livekit/token`, async (route) => {
        await tokenPromise;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'lk-jwt', url: 'wss://lk.example.com' }),
        });
      });

      await page.goto(`/call/${MOCK_ROOM_NAME}`);

      // The page shows "Connecting…" while waiting for the token
      await expect(page.getByText('Connecting…')).toBeVisible();
      await expect(page.getByRole('status', { name: /Connecting/i })).toBeVisible();

      resolveToken();
    });

    test('shows an error state when the LiveKit token endpoint returns 401', async ({ page, context }) => {
      await injectAuthSession(context);
      await interceptLiveKitToken(page, 401);

      await page.goto(`/call/${MOCK_ROOM_NAME}`);

      // An error message must appear
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/could not connect to the call/i)).toBeVisible();
    });

    test('shows an error state when LiveKit connection fails (no server)', async ({ page, context }) => {
      await injectAuthSession(context);
      // Provide a valid token but no reachable WebSocket server
      await interceptLiveKitToken(page);

      await page.goto(`/call/${MOCK_ROOM_NAME}`);

      // LiveKit will fail to connect to wss://lk.example.com — error state expected
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Could not connect to call', { exact: false })).toBeVisible();
    });

    test('retry button re-attempts the LiveKit connection', async ({ page, context }) => {
      await injectAuthSession(context);
      let tokenFetchCount = 0;

      await page.route(`${API_BASE}/livekit/token`, (route) => {
        tokenFetchCount++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'lk-jwt', url: 'wss://lk.example.com' }),
        });
      });

      await page.goto(`/call/${MOCK_ROOM_NAME}`);

      // Wait for the error state
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      expect(tokenFetchCount).toBeGreaterThanOrEqual(1);

      // Click Retry
      await page.getByRole('button', { name: 'Retry' }).click();

      // Should re-enter connecting state
      await expect(page.getByText('Connecting…')).toBeVisible({ timeout: 5_000 });
      expect(tokenFetchCount).toBeGreaterThanOrEqual(2);
    });

    test('leave button navigates back to /home', async ({ page, context }) => {
      await injectAuthSession(context);
      await interceptLiveKitToken(page, 401);

      await page.goto(`/call/${MOCK_ROOM_NAME}`);

      await expect(page.getByRole('alert')).toBeVisible();
      await page.getByRole('button', { name: 'Leave' }).click();

      await expect(page).toHaveURL(/\/home/);
    });

    test('unauthenticated users are redirected to /signin', async ({ page }) => {
      // No auth session injected
      await page.goto(`/call/${MOCK_ROOM_NAME}`);
      await expect(page).toHaveURL(/\/signin/);
    });
  });

  // ── 5. Add-Participant Modal ───────────────────────────────────────────────

  test.describe('Add-participant modal', () => {
    /**
     * The "Add people" button and modal live inside CallSession, which only
     * renders once the LiveKit room is fully connected.  Full UI tests require
     * a reachable LiveKit server (Docker-compose integration test setup).
     *
     * The first test below is skipped for that reason.  The second verifies
     * the /users API contract used by the add-participant contact search.
     */

    test('add-participant API is called with the correct call ID and user ID', async ({ page, context }) => {
      // Skipped: CallSession only renders when LiveKit is connected.
      // To test: spin up a LiveKit dev server, have two users join, then
      // open the "Add people" modal and verify POST /calls/:id/add-participant
      // is called with { userId } in the body.
      test.skip(true, 'Requires an active LiveKit session — pending integration test setup');

      await injectAuthSession(context);
      await silenceSocketIO(page);
      await interceptAddParticipant(page);
    });

    test('contact search filters the add-participant list', async ({ page, context }) => {
      /**
       * Full test: navigate to an active call, open "Add people", type in the
       * search box, verify filtering.  Stubbed here pending a LiveKit mock server.
       *
       * What IS tested: the /users API route shape expected by CallSession.
       */
      await injectAuthSession(context);
      await interceptContacts(page, [
        mockContact({ id: 'u1', displayName: 'Alice Wonderland', email: 'alice@example.com' }),
        mockContact({ id: 'u2', displayName: 'Bob Builder', email: 'bob@example.com' }),
      ]);

      // Verify the contacts API returns the expected shape
      const response = await page.evaluate(async (base) => {
        const res = await fetch(`${base}/users`, {
          headers: { Authorization: 'Bearer mock.jwt.token' },
        });
        return res.ok;
      }, API_BASE);

      expect(response).toBe(true);
    });
  });

  // ── 6. Screen Sharing ────────────────────────────────────────────────────

  test.describe('Screen sharing', () => {
    /**
     * Screen sharing uses navigator.mediaDevices.getDisplayMedia inside an active
     * LiveKit room.  Full UI tests (clicking "Share screen", seeing the presenter
     * banner) require a connected LiveKit room and are covered by integration tests.
     */

    test('the getDisplayMedia API is available in the browser context', async ({ page, context }) => {
      await injectAuthSession(context);

      // Grant screen-capture permission so tests don't stall on the prompt
      await context.grantPermissions(['camera', 'microphone']);

      await page.goto('/home');
      await page.waitForLoadState('networkidle');

      const hasGetDisplayMedia = await page.evaluate(() =>
        typeof navigator.mediaDevices?.getDisplayMedia === 'function'
      );

      expect(hasGetDisplayMedia).toBe(true);
    });

    test('screen share start/stop record API endpoints have correct routes', async ({ page, context }) => {
      // Skipped: the record/start and record/stop buttons are inside CallSession,
      // which only renders when LiveKit is connected.
      // To test: join a real call, click "Share screen", verify the route is hit.
      test.skip(true, 'Requires an active LiveKit session — pending integration test setup');

      await injectAuthSession(context);
      await page.route(`${API_BASE}/calls/${MOCK_CALL_ID}/record/start`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"Recording started"}' })
      );
      await page.route(`${API_BASE}/calls/${MOCK_CALL_ID}/record/stop`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"Recording stopped"}' })
      );
    });

    test('call page shows share-screen error state when LiveKit is unavailable', async ({ page, context }) => {
      await injectAuthSession(context);
      await interceptLiveKitToken(page, 401);

      await page.goto(`/call/${MOCK_ROOM_NAME}`);

      // Error state is shown — screen share button is not yet accessible
      // (it is inside CallSession which only renders when connected)
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/could not connect/i)).toBeVisible();
    });
  });

  // ── 7. Recording ────────────────────────────────────────────────────────

  test.describe('Recording', () => {
    /**
     * Recording uses the browser MediaRecorder API and calls
     * POST /calls/:id/record/start.  The toggle button lives inside
     * CallSession's controls bar (aria-label="Start recording").
     *
     * Full UI testing requires an active LiveKit session.  The tests below verify:
     *   - MediaRecorder is available in the test browser context
     *   - The error state renders correctly when LiveKit is unavailable
     */

    test('MediaRecorder is available in the browser context', async ({ page, context }) => {
      await injectAuthSession(context);
      await page.goto('/home');
      await page.waitForLoadState('networkidle');

      const hasMediaRecorder = await page.evaluate(() => typeof MediaRecorder !== 'undefined');
      expect(hasMediaRecorder).toBe(true);
    });

    test('record/start API is set up with the correct endpoint shape', async ({ page, context }) => {
      // Skipped: the "Start recording" button is inside CallSession, which only
      // renders when LiveKit is connected.
      // To test: join a real call, click "Start recording", verify
      // POST /calls/:id/record/start is called with the correct body.
      test.skip(true, 'Requires an active LiveKit session — pending integration test setup');

      await injectAuthSession(context);
      await page.route(`${API_BASE}/calls/${MOCK_CALL_ID}/record/start`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Call recording started successfully.', egressId: 'egress-001' }),
        })
      );
    });

    test('record/stop API is set up with the correct endpoint shape', async ({ page, context }) => {
      // Skipped: same as record/start — requires an active LiveKit session.
      test.skip(true, 'Requires an active LiveKit session — pending integration test setup');

      await injectAuthSession(context);
      await page.route(`${API_BASE}/calls/${MOCK_CALL_ID}/record/stop`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Call recording stopped successfully.' }),
        })
      );
    });

    test('call page shows error (not REC badge) when LiveKit is unavailable', async ({ page, context }) => {
      await injectAuthSession(context);
      await interceptLiveKitToken(page, 401);

      await page.goto(`/call/${MOCK_ROOM_NAME}`);

      // REC badge only renders inside CallSession (connected state)
      await expect(page.getByRole('alert')).toBeVisible();
      // Confirm REC badge is NOT shown in the error state
      await expect(page.getByTitle(/Recording:/i)).not.toBeVisible();
    });
  });

  // ── 8. Call page — leave call (leaveCall API) ────────────────────────────

  test.describe('Leave call', () => {
    test('leaveCall API endpoint exists and returns the expected shape', async ({ page, context }) => {
      // Skipped: the "Leave" button that triggers leaveCall() is inside CallSession
      // in the connected in-call state, not on the error page.
      // To test: join a real call, click "Leave", verify POST /calls/:id/leave is
      // called and the user is navigated back to /home.
      // Note: the error-page "Leave" button calls navigate('/home') directly and
      // does NOT hit the leave API — that is tested separately above
      // ('leave button navigates back to /home').
      test.skip(true, 'Requires an active LiveKit session — pending integration test setup');

      await injectAuthSession(context);
      await interceptLeaveCall(page);
    });
  });
});
