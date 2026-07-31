/**
 * src/lib/stores/notification.store.ts
 *
 * Tracks push-notification preference + permission state.
 * Persists `enabled` to localStorage so the UI is consistent across page loads.
 * Fully SSR-safe: localStorage is only accessed inside `browser` guards.
 */

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'agcloud:notifications-enabled';

// ── Types ──────────────────────────────────────────────────────────────────────

export type NotificationPermission = 'granted' | 'denied' | 'default';

export interface NotificationState {
  /** Whether the user has opted in to push notifications in this app. */
  enabled: boolean;
  /** Current browser Notification.permission value. */
  permission: NotificationPermission;
  /** Active FCM registration token, null when not registered. */
  token: string | null;
  /** True while an enable/disable operation is in flight. */
  loading: boolean;
  /** Last error message, cleared on each new operation. */
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function readEnabledFromStorage(): boolean {
  if (!browser) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readPermissionFromBrowser(): NotificationPermission {
  if (!browser || !('Notification' in window)) return 'default';
  return window.Notification.permission as NotificationPermission;
}

function persistEnabled(value: boolean): void {
  if (!browser) return;
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

// ── Store factory ──────────────────────────────────────────────────────────────

function createNotificationStore() {
  const initial: NotificationState = {
    enabled: readEnabledFromStorage(),
    permission: readPermissionFromBrowser(),
    token: null,
    loading: false,
    error: null,
  };

  const { subscribe, update, set } = writable<NotificationState>(initial);

  return {
    subscribe,

    /** Refresh the permission field from the live browser value. */
    syncPermission() {
      const permission = readPermissionFromBrowser();
      update((s) => ({ ...s, permission }));
    },

    /** Called when the enable flow succeeds. */
    setEnabled(token: string) {
      persistEnabled(true);
      update((s) => ({
        ...s,
        enabled: true,
        token,
        permission: 'granted',
        loading: false,
        error: null,
      }));
    },

    /** Called when the disable flow succeeds (or on logout cleanup). */
    setDisabled() {
      persistEnabled(false);
      update((s) => ({
        ...s,
        enabled: false,
        token: null,
        loading: false,
        error: null,
      }));
    },

    setLoading(loading: boolean) {
      update((s) => ({ ...s, loading, error: loading ? null : s.error }));
    },

    setError(error: string) {
      update((s) => ({ ...s, loading: false, error }));
    },

    setPermission(permission: NotificationPermission) {
      update((s) => ({ ...s, permission }));
    },

    /** Set the FCM token without changing enabled/loading state. */
    setToken(token: string | null) {
      update((s) => ({ ...s, token }));
    },

    /** Full reset — called on logout. */
    reset() {
      persistEnabled(false);
      set({
        enabled: false,
        permission: readPermissionFromBrowser(),
        token: null,
        loading: false,
        error: null,
      });
    },
  };
}

export const notificationStore = createNotificationStore();
