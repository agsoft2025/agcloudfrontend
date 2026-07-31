import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/api/client', () => ({ apiGet: vi.fn() }));

import {
  presenceStore,
  DEFAULT_POLL_INTERVAL_MS,
  type PresenceState,
} from '../../src/lib/stores/presence.store';
import { apiGet } from '../../src/lib/api/client';

const mockApiGet = vi.mocked(apiGet);

function readState(): PresenceState {
  return get(presenceStore);
}

// Captured before any test mutates the store — reflects true initial state.
const initialSnapshot = readState();

// ── Initial state ─────────────────────────────────────────────────────────────

describe('presenceStore — initial state', () => {
  it('presences map is empty', () => expect(initialSnapshot.presences.size).toBe(0));
  it('isLoading is false', () => expect(initialSnapshot.isLoading).toBe(false));
  it('error is null', () => expect(initialSnapshot.error).toBeNull());
  it('lastUpdated is null', () => expect(initialSnapshot.lastUpdated).toBeNull());
});

// ── fetchPresence() — response shape parsing ──────────────────────────────────

describe('presenceStore — fetchPresence() response shapes', () => {
  beforeEach(() => {
    presenceStore.clear();
    vi.clearAllMocks();
  });

  it('parses an array of presence objects', async () => {
    mockApiGet.mockResolvedValueOnce([
      { userId: 'u1', status: 'online', lastSeen: '2024-06-01T00:00:00Z' },
      { userId: 'u2', status: 'offline' },
    ]);
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('online');
    expect(readState().presences.get('u1')?.lastSeen).toBe('2024-06-01T00:00:00Z');
    expect(readState().presences.get('u2')?.status).toBe('offline');
  });

  it('parses a single presence object with a userId field', async () => {
    mockApiGet.mockResolvedValueOnce({ userId: 'u1', status: 'away' });
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('away');
  });

  it('parses a userId-keyed dictionary', async () => {
    mockApiGet.mockResolvedValueOnce({
      u1: { status: 'online' },
      u2: { status: 'away', lastSeen: '2024-01-01T00:00:00Z' },
    });
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('online');
    expect(readState().presences.get('u2')?.lastSeen).toBe('2024-01-01T00:00:00Z');
  });

  it('unwraps a { data: [...] } envelope', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: [{ userId: 'u1', status: 'online' }],
    });
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('online');
  });

  it('unwraps a { presences: [...] } envelope', async () => {
    mockApiGet.mockResolvedValueOnce({
      presences: [{ userId: 'u2', status: 'away' }],
    });
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u2')?.status).toBe('away');
  });

  it('unwraps a { users: [...] } envelope', async () => {
    mockApiGet.mockResolvedValueOnce({
      users: [{ userId: 'u3', status: 'offline' }],
    });
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u3')?.status).toBe('offline');
  });

  it('unwraps a { results: [...] } envelope', async () => {
    mockApiGet.mockResolvedValueOnce({
      results: [{ userId: 'u4', status: 'online' }],
    });
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u4')?.status).toBe('online');
  });

  it('skips array entries missing userId', async () => {
    mockApiGet.mockResolvedValueOnce([
      { status: 'online' },           // no userId — should be skipped
      { userId: 'u1', status: 'online' },
    ]);
    await presenceStore.fetchPresence();
    expect(readState().presences.size).toBe(1);
    expect(readState().presences.get('u1')).toBeDefined();
  });

  it('handles null response without throwing', async () => {
    mockApiGet.mockResolvedValueOnce(null);
    await presenceStore.fetchPresence();
    expect(readState().presences.size).toBe(0);
    expect(readState().error).toBeNull();
  });

  it('handles empty array without throwing', async () => {
    mockApiGet.mockResolvedValueOnce([]);
    await presenceStore.fetchPresence();
    expect(readState().presences.size).toBe(0);
  });
});

// ── fetchPresence() — status normalisation ────────────────────────────────────

describe('presenceStore — fetchPresence() status normalisation', () => {
  beforeEach(() => {
    presenceStore.clear();
    vi.clearAllMocks();
  });

  it('accepts lowercase online', async () => {
    mockApiGet.mockResolvedValueOnce([{ userId: 'u1', status: 'online' }]);
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('online');
  });

  it('normalises "Online" to online', async () => {
    mockApiGet.mockResolvedValueOnce([{ userId: 'u1', status: 'Online' }]);
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('online');
  });

  it('normalises "OFFLINE" to offline', async () => {
    mockApiGet.mockResolvedValueOnce([{ userId: 'u1', status: 'OFFLINE' }]);
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('offline');
  });

  it('normalises "Away" to away', async () => {
    mockApiGet.mockResolvedValueOnce([{ userId: 'u1', status: 'Away' }]);
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('away');
  });

  it('falls back to offline for an unrecognised status', async () => {
    mockApiGet.mockResolvedValueOnce([{ userId: 'u1', status: 'busy' }]);
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('offline');
  });

  it('falls back to offline for a non-string status', async () => {
    mockApiGet.mockResolvedValueOnce([{ userId: 'u1', status: 42 }]);
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('offline');
  });

  it('falls back to offline for missing status field', async () => {
    mockApiGet.mockResolvedValueOnce([{ userId: 'u1' }]);
    await presenceStore.fetchPresence();
    expect(readState().presences.get('u1')?.status).toBe('offline');
  });
});

// ── fetchPresence() — store state side-effects ────────────────────────────────

describe('presenceStore — fetchPresence() store state', () => {
  beforeEach(() => {
    presenceStore.clear();
    vi.clearAllMocks();
  });

  it('calls GET /users/presence', async () => {
    mockApiGet.mockResolvedValueOnce([]);
    await presenceStore.fetchPresence();
    expect(mockApiGet).toHaveBeenCalledWith('/users/presence');
  });

  it('sets isLoading to false after a successful fetch', async () => {
    mockApiGet.mockResolvedValueOnce([]);
    await presenceStore.fetchPresence();
    expect(readState().isLoading).toBe(false);
  });

  it('sets lastUpdated to a non-null value after success', async () => {
    mockApiGet.mockResolvedValueOnce([]);
    const before = Date.now();
    await presenceStore.fetchPresence();
    const after = Date.now();
    const { lastUpdated } = readState();
    expect(lastUpdated).not.toBeNull();
    expect(lastUpdated!).toBeGreaterThanOrEqual(before);
    expect(lastUpdated!).toBeLessThanOrEqual(after);
  });

  it('sets error to null after a successful fetch', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('network'));
    await presenceStore.fetchPresence(); // sets error
    mockApiGet.mockResolvedValueOnce([]);
    await presenceStore.fetchPresence(); // should clear error
    expect(readState().error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('timeout'));
    await presenceStore.fetchPresence();
    expect(readState().error).toBe('timeout');
  });

  it('sets isLoading to false even after a failure', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('net error'));
    await presenceStore.fetchPresence();
    expect(readState().isLoading).toBe(false);
  });

  it('uses fallback message for non-Error rejections', async () => {
    mockApiGet.mockRejectedValueOnce('raw string');
    await presenceStore.fetchPresence();
    expect(readState().error).toBe('Unable to fetch presence data.');
  });

  it('preserves existing presences after a failed fetch', async () => {
    mockApiGet.mockResolvedValueOnce([{ userId: 'u1', status: 'online' }]);
    await presenceStore.fetchPresence();
    mockApiGet.mockRejectedValueOnce(new Error('net'));
    await presenceStore.fetchPresence();
    // presences are NOT cleared on error — store keeps last known-good data
    expect(readState().presences.get('u1')?.status).toBe('online');
  });
});

// ── setPresence() ─────────────────────────────────────────────────────────────

describe('presenceStore — setPresence()', () => {
  beforeEach(() => presenceStore.clear());

  it('adds a new presence entry', () => {
    presenceStore.setPresence({ userId: 'u1', status: 'online' });
    expect(readState().presences.get('u1')?.status).toBe('online');
  });

  it('updates an existing entry', () => {
    presenceStore.setPresence({ userId: 'u1', status: 'online' });
    presenceStore.setPresence({ userId: 'u1', status: 'away' });
    expect(readState().presences.get('u1')?.status).toBe('away');
  });

  it('stores lastSeen when provided', () => {
    presenceStore.setPresence({ userId: 'u1', status: 'online', lastSeen: '2024-01-01T00:00:00Z' });
    expect(readState().presences.get('u1')?.lastSeen).toBe('2024-01-01T00:00:00Z');
  });

  it('normalises status — "ONLINE" becomes "online"', () => {
    presenceStore.setPresence({ userId: 'u1', status: 'ONLINE' });
    expect(readState().presences.get('u1')?.status).toBe('online');
  });

  it('normalises status — numeric falls back to offline', () => {
    presenceStore.setPresence({ userId: 'u1', status: 99 });
    expect(readState().presences.get('u1')?.status).toBe('offline');
  });

  it('does not affect other presence entries', () => {
    presenceStore.setPresence({ userId: 'u1', status: 'online' });
    presenceStore.setPresence({ userId: 'u2', status: 'away' });
    presenceStore.setPresence({ userId: 'u1', status: 'offline' });
    expect(readState().presences.get('u2')?.status).toBe('away');
  });
});

// ── getPresence() ─────────────────────────────────────────────────────────────

describe('presenceStore — getPresence()', () => {
  beforeEach(() => presenceStore.clear());

  it('returns the presence entry for a known userId', () => {
    presenceStore.setPresence({ userId: 'u1', status: 'online' });
    const p = presenceStore.getPresence('u1');
    expect(p).toBeDefined();
    expect(p?.status).toBe('online');
  });

  it('returns undefined for an unknown userId', () => {
    expect(presenceStore.getPresence('unknown')).toBeUndefined();
  });

  it('reflects the latest update', () => {
    presenceStore.setPresence({ userId: 'u1', status: 'online' });
    presenceStore.setPresence({ userId: 'u1', status: 'away' });
    expect(presenceStore.getPresence('u1')?.status).toBe('away');
  });
});

// ── startPolling() / stopPolling() ────────────────────────────────────────────

describe('presenceStore — startPolling() / stopPolling()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    presenceStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    presenceStore.stopPolling();
    vi.useRealTimers();
  });

  it('fetches immediately when polling starts', async () => {
    mockApiGet.mockResolvedValue([]);
    presenceStore.startPolling();
    await vi.advanceTimersByTimeAsync(0); // flush immediate fetchPresence + microtasks
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/users/presence');
  });

  it('fetches again after each interval', async () => {
    mockApiGet.mockResolvedValue([]);
    presenceStore.startPolling();
    await vi.advanceTimersByTimeAsync(0);                    // initial fetch
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS); // interval tick
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it('does not fetch a third time before the second interval elapses', async () => {
    mockApiGet.mockResolvedValue([]);
    presenceStore.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS - 1);
    expect(mockApiGet).toHaveBeenCalledTimes(1);
  });

  it('stopPolling() prevents further interval fetches', async () => {
    mockApiGet.mockResolvedValue([]);
    presenceStore.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    presenceStore.stopPolling();
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS * 3);
    expect(mockApiGet).toHaveBeenCalledTimes(1); // only the initial fetch
  });

  it('calling startPolling() again replaces the previous timer', async () => {
    mockApiGet.mockResolvedValue([]);
    presenceStore.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    presenceStore.startPolling(); // restart — should clear old timer and re-fetch immediately
    await vi.advanceTimersByTimeAsync(0);
    // Both starts trigger an immediate fetch → 2 total so far
    expect(mockApiGet).toHaveBeenCalledTimes(2);
    // Advance one interval — only ONE new fetch should fire (not two)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS);
    expect(mockApiGet).toHaveBeenCalledTimes(3);
  });

  it('stopPolling() is safe to call when not polling', () => {
    expect(() => presenceStore.stopPolling()).not.toThrow();
  });
});

// ── clear() ───────────────────────────────────────────────────────────────────

describe('presenceStore — clear()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    presenceStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('empties the presences map', () => {
    presenceStore.setPresence({ userId: 'u1', status: 'online' });
    presenceStore.clear();
    expect(readState().presences.size).toBe(0);
  });

  it('resets isLoading to false', async () => {
    // Start a pending fetch, then clear before it resolves
    let resolve!: (v: unknown) => void;
    mockApiGet.mockReturnValue(new Promise((r) => { resolve = r; }));
    presenceStore.startPolling();
    presenceStore.clear();
    resolve([]);
    expect(readState().isLoading).toBe(false);
  });

  it('resets error to null', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('boom'));
    await presenceStore.fetchPresence();
    presenceStore.clear();
    expect(readState().error).toBeNull();
  });

  it('resets lastUpdated to null', async () => {
    mockApiGet.mockResolvedValueOnce([]);
    await presenceStore.fetchPresence();
    presenceStore.clear();
    expect(readState().lastUpdated).toBeNull();
  });

  it('stops any active polling timer', async () => {
    mockApiGet.mockResolvedValue([]);
    presenceStore.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    presenceStore.clear();
    vi.clearAllMocks();
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS * 2);
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
