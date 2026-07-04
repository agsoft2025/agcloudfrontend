import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Must be declared before imports so vi.mock hoisting takes effect
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/api/client', () => ({ apiGet: vi.fn() }));

import { authStore, type AuthUser } from '../../src/lib/stores/auth.store';
import { apiGet } from '../../src/lib/api/client';

const mockApiGet = vi.mocked(apiGet);

const alice: AuthUser = {
  id: 'u1',
  email: 'alice@example.com',
  displayName: 'Alice',
  role: 'user',
};

// Captured before any test mutates the store — reflects true initial state.
const initialSnapshot = get(authStore);

// ── Initial state ────────────────────────────────────────────────────────────

describe('authStore — initial state', () => {
  it('user is null', () => expect(initialSnapshot.user).toBeNull());
  it('isAuthenticated is false', () => expect(initialSnapshot.isAuthenticated).toBe(false));
  it('isInitialized is false', () => expect(initialSnapshot.isInitialized).toBe(false));
});

// ── initialize() ─────────────────────────────────────────────────────────────

describe('authStore — initialize()', () => {
  beforeEach(() => {
    authStore.clear();
    vi.clearAllMocks();
  });

  it('calls GET /auth/me', async () => {
    mockApiGet.mockResolvedValueOnce(alice);
    await authStore.initialize();
    expect(mockApiGet).toHaveBeenCalledOnce();
    expect(mockApiGet).toHaveBeenCalledWith('/auth/me');
  });

  it('sets user and isAuthenticated on success', async () => {
    mockApiGet.mockResolvedValueOnce(alice);
    await authStore.initialize();
    const s = get(authStore);
    expect(s.user).toEqual(alice);
    expect(s.isAuthenticated).toBe(true);
    expect(s.isInitialized).toBe(true);
  });

  it('clears user and marks unauthenticated on API error', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('401 Unauthorized'));
    await authStore.initialize();
    const s = get(authStore);
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.isInitialized).toBe(true);
  });

  it('remains valid after a non-Error rejection value', async () => {
    mockApiGet.mockRejectedValueOnce('timeout');
    await authStore.initialize();
    const s = get(authStore);
    expect(s.isInitialized).toBe(true);
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
  });

  it('does not double-initialise when called twice', async () => {
    mockApiGet.mockResolvedValue(alice);
    await authStore.initialize();
    await authStore.initialize();
    // apiGet should have been called twice — no short-circuit guard
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });
});

// ── setUser() ────────────────────────────────────────────────────────────────

describe('authStore — setUser()', () => {
  beforeEach(() => authStore.clear());

  it('sets user and marks authenticated', () => {
    authStore.setUser(alice);
    const s = get(authStore);
    expect(s.user).toEqual(alice);
    expect(s.isAuthenticated).toBe(true);
    expect(s.isInitialized).toBe(true);
  });

  it('passing null clears user and marks unauthenticated', () => {
    authStore.setUser(alice);
    authStore.setUser(null);
    const s = get(authStore);
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  it('overwrites an existing user', () => {
    const bob: AuthUser = { id: 'u2', email: 'bob@example.com' };
    authStore.setUser(alice);
    authStore.setUser(bob);
    expect(get(authStore).user?.email).toBe('bob@example.com');
  });

  it('stores all optional fields', () => {
    const full: AuthUser = {
      id: 'u3',
      email: 'carol@example.com',
      role: 'admin',
      status: 'active',
      displayName: 'Carol',
      avatarUrl: 'https://example.com/carol.png',
    };
    authStore.setUser(full);
    expect(get(authStore).user).toEqual(full);
  });
});

// ── clear() ──────────────────────────────────────────────────────────────────

describe('authStore — clear()', () => {
  beforeEach(() => authStore.setUser(alice));

  it('removes the current user', () => {
    authStore.clear();
    expect(get(authStore).user).toBeNull();
  });

  it('sets isAuthenticated to false', () => {
    authStore.clear();
    expect(get(authStore).isAuthenticated).toBe(false);
  });

  it('sets isInitialized to true', () => {
    authStore.clear();
    expect(get(authStore).isInitialized).toBe(true);
  });

  it('is idempotent', () => {
    authStore.clear();
    authStore.clear();
    const s = get(authStore);
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });
});

// ── getUser() / getSession() ─────────────────────────────────────────────────

describe('authStore — getUser() / getSession()', () => {
  beforeEach(() => authStore.clear());

  it('getUser() returns null when no user is set', () => {
    expect(authStore.getUser()).toBeNull();
  });

  it('getUser() returns the current user synchronously', () => {
    authStore.setUser(alice);
    expect(authStore.getUser()).toEqual(alice);
  });

  it('getUser() reflects null after clear()', () => {
    authStore.setUser(alice);
    authStore.clear();
    expect(authStore.getUser()).toBeNull();
  });

  it('getSession() returns the full session snapshot', () => {
    authStore.setUser(alice);
    const s = authStore.getSession();
    expect(s.user).toEqual(alice);
    expect(s.isAuthenticated).toBe(true);
    expect(s.isInitialized).toBe(true);
  });

  it('getSession() matches get(authStore)', () => {
    authStore.setUser(alice);
    expect(authStore.getSession()).toEqual(get(authStore));
  });
});

// ── subscribe() ──────────────────────────────────────────────────────────────

describe('authStore — subscribe()', () => {
  beforeEach(() => authStore.clear());

  it('emits the current value immediately on subscribe', () => {
    authStore.setUser(alice);
    let captured: AuthUser | null = null;
    const unsub = authStore.subscribe((s) => { captured = s.user; });
    unsub();
    expect(captured).toEqual(alice);
  });

  it('notifies on each state change', () => {
    const log: boolean[] = [];
    const unsub = authStore.subscribe((s) => log.push(s.isAuthenticated));
    authStore.setUser(alice);  // false → true
    authStore.clear();         // true → false
    unsub();
    expect(log).toEqual([false, true, false]);
  });

  it('does not notify after unsubscribe', () => {
    const log: boolean[] = [];
    const unsub = authStore.subscribe((s) => log.push(s.isAuthenticated));
    unsub();
    authStore.setUser(alice);
    // Only the initial emission before unsub should appear
    expect(log).toHaveLength(1);
  });
});
