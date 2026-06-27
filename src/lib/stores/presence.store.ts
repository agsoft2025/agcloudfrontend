/**
 * presence.store.ts — N-10
 *
 * Tracks online / offline / away status for all users.
 * Polls GET /users/presence at a configurable interval and exposes
 * a reactive Svelte store so any component can subscribe.
 *
 * API response shapes supported:
 *   Single object : { userId, status, lastSeen? }
 *   Array         : [{ userId, status, lastSeen? }, ...]
 *   Object map    : { [userId]: { status, lastSeen? } }
 *   Envelope      : { data|presences|users|results: <any of the above> }
 *
 * Status values are normalised to lowercase so "Online" === "online".
 *
 * Usage:
 *   presenceStore.startPolling();           // start auto-refresh
 *   presenceStore.stopPolling();            // stop (e.g. on logout)
 *   $presenceStore.presences.get(userId);   // reactive read
 *   presenceStore.setPresence(entry);       // manual update (e.g. WebSocket)
 */
import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import { apiGet } from '$lib/api/client';

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
  /** Date.now() of the last successful fetch, or null if never fetched. */
  lastUpdated: number | null;
}

// ── Constants ─────────────────────────────────────────────────────

export const DEFAULT_POLL_INTERVAL_MS = 15_000; // 15 s

// ── Status normalisation ──────────────────────────────────────────

const VALID_STATUSES: ReadonlySet<string> = new Set(['online', 'offline', 'away']);

/**
 * Coerce any server-supplied status string to a valid PresenceStatus.
 * Handles mixed/uppercase values such as "Online", "OFFLINE", "Away".
 * Falls back to 'offline' for anything unrecognised.
 */
function normalizeStatus(raw: unknown): PresenceStatus {
  if (typeof raw !== 'string') return 'offline';
  const lower = raw.trim().toLowerCase();
  return VALID_STATUSES.has(lower) ? (lower as PresenceStatus) : 'offline';
}

// ── Parser ────────────────────────────────────────────────────────

/**
 * Parse ANY shape the /users/presence endpoint might return and produce
 * a unified Map<userId, UserPresence>.
 *
 * Handled shapes (in order of detection):
 *   1. Envelope wrapper: { data|presences|users|results: <inner> }
 *      -> recurse into the unwrapped inner value
 *   2. Array: [{ userId, status, lastSeen? }, ...]
 *   3. Single presence object: { userId, status, lastSeen? }
 *   4. Dictionary: { [userId]: { status, lastSeen? } }
 */
function parsePresenceResponse(data: unknown): Map<string, UserPresence> {
  const map = new Map<string, UserPresence>();

  if (data == null) return map;

  // ── 1. Unwrap common envelope shapes ──────────────────────────
  // e.g. { data: [...] }, { presences: [...] }, { users: [...] }, { results: [...] }
  if (!Array.isArray(data) && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const inner = obj.data ?? obj.presences ?? obj.users ?? obj.results;
    if (inner != null) {
      // Recurse with the unwrapped payload
      return parsePresenceResponse(inner);
    }
  }

  // ── 2. Array: [{ userId, status, lastSeen? }, ...] ────────────
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item == null || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      if (typeof entry.userId !== 'string') continue;

      console.debug('[presence] array item:', entry.userId, entry.status);
      map.set(entry.userId, {
        userId: entry.userId,
        status: normalizeStatus(entry.status),
        lastSeen: typeof entry.lastSeen === 'string' ? entry.lastSeen : undefined,
      });
    }
    return map;
  }

  // ── 3 & 4. Object: single presence OR userId-keyed dict ───────
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // Single presence object: { userId: "...", status: "online", ... }
    // Detected by the presence of a string "userId" field at the root.
    if (typeof obj.userId === 'string') {
      console.debug('[presence] single object:', obj.userId, obj.status);
      map.set(obj.userId, {
        userId: obj.userId,
        status: normalizeStatus(obj.status),
        lastSeen: typeof obj.lastSeen === 'string' ? obj.lastSeen : undefined,
      });
      return map;
    }

    // Dictionary: { "someUserId": { status, lastSeen? }, ... }
    for (const [userId, value] of Object.entries(obj)) {
      if (value == null || typeof value !== 'object') continue;
      const entry = value as Record<string, unknown>;
      console.debug('[presence] dict entry:', userId, entry.status);
      map.set(userId, {
        userId,
        status: normalizeStatus(entry.status),
        lastSeen: typeof entry.lastSeen === 'string' ? entry.lastSeen : undefined,
      });
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
      const data = await apiGet<unknown>('/users/presence');
      console.debug('[presence] raw API response:', data);

      const presences = parsePresenceResponse(data);
      console.debug('[presence] parsed entries:', presences.size);

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
      console.error('[presence] fetch error:', message);
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

  /**
   * Apply a single presence update (typically from a WebSocket event).
   * The status is normalised so "Online" and "online" are treated the same.
   */
  function setPresence(presence: { userId: string; status: unknown; lastSeen?: string }): void {
    const normalised: UserPresence = {
      userId: presence.userId,
      status: normalizeStatus(presence.status),
      lastSeen: presence.lastSeen,
    };
    console.debug('[presence] setPresence (socket):', normalised.userId, normalised.status);
    update((s) => {
      const presences = new Map(s.presences);
      presences.set(normalised.userId, normalised);
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
