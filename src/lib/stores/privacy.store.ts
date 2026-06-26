/**
 * src/lib/stores/privacy.store.ts
 *
 * Manages the blocked-users list shown on /settings/privacy.
 * Optimistic unblock: removes the user from local state immediately,
 * then reverts (re-inserts at original index) if the API call fails.
 * SSR-safe: no browser APIs accessed at module evaluation time.
 */

import { writable } from 'svelte/store';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BlockedUser {
  id: string;
  username: string;
  avatar?: string;
}

export interface PrivacyState {
  blockedUsers: BlockedUser[];
  /** True while the initial list is being fetched. */
  loading: boolean;
  /** Fetch error message; null when no error. */
  error: string | null;
  /** Set of user IDs currently being unblocked (prevents duplicate requests). */
  unblockingIds: Set<string>;
}

// ── Store factory ──────────────────────────────────────────────────────────────

function createPrivacyStore() {
  const initial: PrivacyState = {
    blockedUsers: [],
    loading: false,
    error: null,
    unblockingIds: new Set(),
  };

  const { subscribe, update, set } = writable<PrivacyState>(initial);

  return {
    subscribe,

    // ── Fetch lifecycle ────────────────────────────────────────────────────────

    setLoading() {
      update((s) => ({ ...s, loading: true, error: null }));
    },

    setUsers(users: BlockedUser[]) {
      update((s) => ({ ...s, blockedUsers: users, loading: false, error: null }));
    },

    setFetchError(error: string) {
      update((s) => ({ ...s, loading: false, error }));
    },

    // ── Optimistic unblock ─────────────────────────────────────────────────────

    /**
     * Start an unblock operation for `userId`.
     * Removes the user from the list and marks the ID as in-flight.
     * Returns the removed user + its original index so the caller can roll back.
     */
    beginUnblock(userId: string): { user: BlockedUser; index: number } | null {
      let removed: { user: BlockedUser; index: number } | null = null;

      update((s) => {
        // Guard: already unblocking this user
        if (s.unblockingIds.has(userId)) return s;

        const index = s.blockedUsers.findIndex((u) => u.id === userId);
        if (index === -1) return s; // already removed

        const user = s.blockedUsers[index];
        removed = { user, index };

        const next = s.blockedUsers.filter((u) => u.id !== userId);
        const ids = new Set(s.unblockingIds);
        ids.add(userId);

        return { ...s, blockedUsers: next, unblockingIds: ids };
      });

      return removed;
    },

    /** Commit: just clear the in-flight marker (user already removed optimistically). */
    commitUnblock(userId: string) {
      update((s) => {
        const ids = new Set(s.unblockingIds);
        ids.delete(userId);
        return { ...s, unblockingIds: ids };
      });
    },

    /** Rollback: re-insert the user at their original position. */
    rollbackUnblock(userId: string, user: BlockedUser, originalIndex: number) {
      update((s) => {
        const ids = new Set(s.unblockingIds);
        ids.delete(userId);

        // Re-insert at the original position (or append if list shrank)
        const next = [...s.blockedUsers];
        const clampedIndex = Math.min(originalIndex, next.length);
        next.splice(clampedIndex, 0, user);

        return { ...s, blockedUsers: next, unblockingIds: ids };
      });
    },

    /** Full reset — useful for testing or logout. */
    reset() {
      set({ ...initial, unblockingIds: new Set() });
    },
  };
}

export const privacyStore = createPrivacyStore();
