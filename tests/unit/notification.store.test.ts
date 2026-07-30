import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

import { notificationStore, type NotificationPermission } from '../../src/lib/stores/notification.store';

function setBrowserPermission(permission: NotificationPermission | undefined) {
  if (permission === undefined) {
    // @ts-expect-error simulate Notification API not existing
    delete window.Notification;
    return;
  }
  // jsdom does not implement the Notification API by default.
  // @ts-expect-error minimal stub sufficient for reading .permission
  window.Notification = { permission };
}

beforeEach(() => {
  localStorage.clear();
  setBrowserPermission('default');
  notificationStore.reset();
});

// ── Initial state ────────────────────────────────────────────────────────────

describe('notificationStore — initial state (after reset())', () => {
  it('is disabled', () => {
    expect(get(notificationStore).enabled).toBe(false);
  });

  it('has no token', () => {
    expect(get(notificationStore).token).toBeNull();
  });

  it('is not loading', () => {
    expect(get(notificationStore).loading).toBe(false);
  });

  it('has no error', () => {
    expect(get(notificationStore).error).toBeNull();
  });
});

// ── setEnabled() ─────────────────────────────────────────────────────────────

describe('notificationStore — setEnabled()', () => {
  it('marks the store enabled with the given token', () => {
    notificationStore.setEnabled('fcm-token-123');
    const s = get(notificationStore);
    expect(s.enabled).toBe(true);
    expect(s.token).toBe('fcm-token-123');
  });

  it('sets permission to "granted"', () => {
    notificationStore.setEnabled('tok');
    expect(get(notificationStore).permission).toBe('granted');
  });

  it('clears loading and error', () => {
    notificationStore.setLoading(true);
    notificationStore.setError('oops');
    notificationStore.setEnabled('tok');
    const s = get(notificationStore);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('persists the enabled flag to localStorage', () => {
    notificationStore.setEnabled('tok');
    expect(localStorage.getItem('agcloud:notifications-enabled')).toBe('true');
  });
});

// ── setDisabled() ────────────────────────────────────────────────────────────

describe('notificationStore — setDisabled()', () => {
  it('marks the store disabled and clears the token', () => {
    notificationStore.setEnabled('tok');
    notificationStore.setDisabled();
    const s = get(notificationStore);
    expect(s.enabled).toBe(false);
    expect(s.token).toBeNull();
  });

  it('removes the persisted flag from localStorage', () => {
    notificationStore.setEnabled('tok');
    notificationStore.setDisabled();
    expect(localStorage.getItem('agcloud:notifications-enabled')).toBeNull();
  });
});

// ── setLoading() ─────────────────────────────────────────────────────────────

describe('notificationStore — setLoading()', () => {
  it('sets the loading flag', () => {
    notificationStore.setLoading(true);
    expect(get(notificationStore).loading).toBe(true);
  });

  it('clears any existing error when loading starts', () => {
    notificationStore.setError('prior error');
    notificationStore.setLoading(true);
    expect(get(notificationStore).error).toBeNull();
  });

  it('preserves the error when loading is set to false', () => {
    notificationStore.setLoading(true);
    notificationStore.setError('failed');
    notificationStore.setLoading(false);
    expect(get(notificationStore).error).toBe('failed');
  });
});

// ── setError() ───────────────────────────────────────────────────────────────

describe('notificationStore — setError()', () => {
  it('sets the error message', () => {
    notificationStore.setError('permission denied');
    expect(get(notificationStore).error).toBe('permission denied');
  });

  it('clears the loading flag', () => {
    notificationStore.setLoading(true);
    notificationStore.setError('failed');
    expect(get(notificationStore).loading).toBe(false);
  });
});

// ── setPermission() / syncPermission() ──────────────────────────────────────

describe('notificationStore — permission tracking', () => {
  it('setPermission() updates the permission field directly', () => {
    notificationStore.setPermission('denied');
    expect(get(notificationStore).permission).toBe('denied');
  });

  it('syncPermission() reads the live browser Notification.permission', () => {
    setBrowserPermission('granted');
    notificationStore.syncPermission();
    expect(get(notificationStore).permission).toBe('granted');
  });

  it('defaults to "default" when the Notification API is unavailable', () => {
    setBrowserPermission(undefined);
    notificationStore.syncPermission();
    expect(get(notificationStore).permission).toBe('default');
  });
});

// ── setToken() ───────────────────────────────────────────────────────────────

describe('notificationStore — setToken()', () => {
  it('updates the token without changing enabled/loading', () => {
    notificationStore.setLoading(true);
    notificationStore.setToken('new-token');
    const s = get(notificationStore);
    expect(s.token).toBe('new-token');
    expect(s.enabled).toBe(false);
    expect(s.loading).toBe(true);
  });

  it('can clear the token by passing null', () => {
    notificationStore.setToken('tok');
    notificationStore.setToken(null);
    expect(get(notificationStore).token).toBeNull();
  });
});

// ── reset() ──────────────────────────────────────────────────────────────────

describe('notificationStore — reset()', () => {
  it('returns to the disabled default state', () => {
    notificationStore.setEnabled('tok');
    notificationStore.setError('x');
    notificationStore.reset();
    const s = get(notificationStore);
    expect(s.enabled).toBe(false);
    expect(s.token).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('removes the persisted enabled flag', () => {
    notificationStore.setEnabled('tok');
    notificationStore.reset();
    expect(localStorage.getItem('agcloud:notifications-enabled')).toBeNull();
  });

  it('re-reads the live permission value', () => {
    setBrowserPermission('denied');
    notificationStore.reset();
    expect(get(notificationStore).permission).toBe('denied');
  });
});
