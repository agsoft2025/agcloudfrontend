/**
 * presence.store.ts — N-10
 *
 * Tracks online / offline / away status for all users.
 * Polls GET /users/presence at a configurable interval and exposes
 * a reactive Svelte store so any component can subscribe.
 *
 * API response shapes supported:
 *   Array: [{ userId, status, lastSeen? }, ...]
 *   Object: { [userId]: { status, lastSeen? } }
 *
 * Usage:
 *   presenceStore.startPolling();           // start auto-refresh
 *   presenceStore.stopPolling();            // stop (e.g. on logout)
 *   $presenceStore.presences.get(userId);   // reactive read
 */
import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import { axiosClient } from '$lib/api/client';

// ── Types ─────────────────────────────────────────────────────────

export type PresenceStatus = 'online' | 'offline' | 'away';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  /** ISO-8601 timestamp of the last time the user was seen online. */
  lastSeen?: string;
}

export interface PresenceState {
  presences: Map<string, UserPresence>;
  isLoading: boolean;
  error: string | null;
  /** `Date.now()` of the last successful fetch, or null if never fetched. */
  lastUpdated: number | null;
}

// Shape returned by the /users/presence endpoint (either form)
type PresenceApiItem = { userId: string; status: PresenceStatus; lastSeen?: string };
type PresenceApiResponse =
  | PresenceApiItem[]
  | Record<string, { status: PresenceStatus; lastSeen?: string }>;

// ── Constants ─────────────────────────────────────────────────────

export const DEFAULT_POLL_INTERVAL_MS = 30_000; // 30 s

// ── Parser ────────────────────────────────────────────────────────

function parsePresenceResponse(data: PresenceApiResponse): Map<string, UserPresence> {
  const map = new Map<string, UserPresence>();

  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item.userId === 'string') {
        map.set(item.userId, {
          userId: item.userId,
          status: item.status ?? 'offline',
          lastSeen: item.lastSeen,
        });
      }
    }
  } else if (data && typeof data === 'object') {
    for (const [userId, value] of Object.entries(data)) {
      if (value && typeof value === 'object') {
        map.set(userId, {
          userId,
          status: value.status ?? 'offline',
          lastSeen: value.lastSeen,
        });
      }
    }
  }

  return map;
}

// ── Store factory ─────────────────────────────────────────────────

function createPresenceStore(defaultIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const initial: PresenceState = {
    presences: new Map(),
    isLoading: false,
    error: null,
    lastUpdated: null,
  };

  const { subscribe, update } = writable<PresenceState>(initial);

  let timer: ReturnType<typeof setInterval> | null = null;

  // ── Fetch ──────────────────────────────────────────────────────

  async function fetchPresence(): Promise<void> {
    if (!browser) return;

    update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const response = await axiosClient.get<PresenceApiResponse>('/users/presence');
      const presences = parsePresenceResponse(response.data);

      update((s) => ({
        ...s,
        presences,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to fetch presence data.';
      update((s) => ({ ...s, isLoading: false, error: message }));
    }
  }

  // ── Polling ────────────────────────────────────────────────────

  /** Start polling. Fetches immediately, then repeats at `intervalMs`. */
  function startPolling(intervalMs = defaultIntervalMs): void {
    if (!browser) return;
    stopPolling();
    void fetchPresence();
    timer = setInterval(() => void fetchPresence(), intervalMs);
  }

  function stopPolling(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  // ── Manual updates (e.g. from WebSocket events) ───────────────

  function setPresence(presence: UserPresence): void {
    update((s) => {
      const presences = new Map(s.presences);
      presences.set(presence.userId, presence);
      return { ...s, presences };
    });
  }

  /** Synchronous point-in-time read (bypasses reactivity). */
  function getPresence(userId: string): UserPresence | undefined {
    return get({ subscribe }).presences.get(userId);
  }

  function clear(): void {
    stopPolling();
    update(() => ({ ...initial, presences: new Map() }));
  }

  return {
    subscribe,
    fetchPresence,
    startPolling,
    stopPolling,
    setPresence,
    getPresence,
    clear,
  };
}

export const presenceStore = createPresenceStore();
