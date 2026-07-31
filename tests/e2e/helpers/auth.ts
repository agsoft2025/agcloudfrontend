import type { BrowserContext } from '@playwright/test';

/**
 * Base API URL the frontend's fetch client talks to (see src/lib/api/client.ts).
 * Must match the app's `VITE_API_BASE_URL` so route mocks intercept the
 * right origin.
 */
const API_BASE = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Token written to the legacy `accessToken` localStorage key. See note below. */
export const MOCK_ACCESS_TOKEN = 'mock.jwt.token';

export interface MockAuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  avatarUrl: string | null;
}

/** Build a mock authenticated user, overriding any fields a test needs. */
export function mockAuthUser(overrides: Partial<MockAuthUser> = {}): MockAuthUser {
  return {
    id: 'mock-user-001',
    email: 'test-user@example.com',
    displayName: 'Test User',
    role: 'user',
    status: 'active',
    avatarUrl: null,
    ...overrides,
  };
}

/**
 * Inject a fully authenticated session into a browser context, bypassing the
 * sign-in UI.
 *
 * `authStore.initialize()` (invoked from the root `+layout.svelte` on mount)
 * verifies the session by calling `GET /auth/me` with `credentials: 'include'`
 * — it does not read `localStorage`. So skipping the sign-in form requires
 * mocking that endpoint; seeding `localStorage` alone leaves the app treating
 * the visitor as signed out and every route guard redirects to `/signin`.
 *
 * We still seed the `accessToken` / `authUser` localStorage keys for tests
 * that assert against them directly (a holdover from an earlier
 * localStorage-based auth model that some specs still exercise).
 *
 * Must be called before `page.goto(...)` so the route mock and init script
 * are both in place before the app boots.
 */
export async function injectAuthSession(
  context: BrowserContext,
  overrides: Partial<MockAuthUser> = {}
): Promise<MockAuthUser> {
  const user = mockAuthUser(overrides);

  await context.route(`${API_BASE}/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    })
  );

  await context.addInitScript(
    (args: { token: string; user: string }) => {
      localStorage.setItem('accessToken', args.token);
      localStorage.setItem('authUser', args.user);
    },
    { token: MOCK_ACCESS_TOKEN, user: JSON.stringify(user) }
  );

  return user;
}
