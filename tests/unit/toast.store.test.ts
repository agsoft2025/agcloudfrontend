import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toastStore, type Toast } from '../../src/lib/stores/toast.store';

beforeEach(() => {
  toastStore.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Initial state ────────────────────────────────────────────────────────────

describe('toastStore — initial state', () => {
  it('starts with an empty list', () => {
    expect(get(toastStore)).toEqual([]);
  });
});

// ── show() ───────────────────────────────────────────────────────────────────

describe('toastStore — show()', () => {
  it('adds a toast to the list', () => {
    toastStore.show({ message: 'Hello' });
    const toasts = get(toastStore);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello');
  });

  it('defaults variant to "info"', () => {
    toastStore.show({ message: 'Hi' });
    expect(get(toastStore)[0].variant).toBe('info');
  });

  it('defaults duration to 4000ms', () => {
    toastStore.show({ message: 'Hi' });
    expect(get(toastStore)[0].duration).toBe(4000);
  });

  it('respects an explicit variant and duration', () => {
    toastStore.show({ message: 'Custom', variant: 'error', duration: 1000 });
    const toast = get(toastStore)[0];
    expect(toast.variant).toBe('error');
    expect(toast.duration).toBe(1000);
  });

  it('returns a unique id for each toast', () => {
    const id1 = toastStore.show({ message: 'One' });
    const id2 = toastStore.show({ message: 'Two' });
    expect(id1).not.toBe(id2);
  });

  it('appends multiple toasts in order', () => {
    toastStore.show({ message: 'First' });
    toastStore.show({ message: 'Second' });
    const toasts = get(toastStore);
    expect(toasts.map((t) => t.message)).toEqual(['First', 'Second']);
  });

  it('auto-dismisses after the given duration', () => {
    vi.useFakeTimers();
    toastStore.show({ message: 'Bye', duration: 1000 });
    expect(get(toastStore)).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(get(toastStore)).toHaveLength(0);
  });

  it('does not auto-dismiss when duration is 0', () => {
    vi.useFakeTimers();
    toastStore.show({ message: 'Sticky', duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(get(toastStore)).toHaveLength(1);
  });
});

// ── success() / error() / info() convenience methods ─────────────────────────

describe('toastStore — variant helpers', () => {
  it('success() sets variant to "success"', () => {
    toastStore.success('Saved!');
    const toast = get(toastStore)[0];
    expect(toast.variant).toBe('success');
    expect(toast.message).toBe('Saved!');
  });

  it('error() sets variant to "error"', () => {
    toastStore.error('Failed!');
    expect(get(toastStore)[0].variant).toBe('error');
  });

  it('info() sets variant to "info"', () => {
    toastStore.info('FYI');
    expect(get(toastStore)[0].variant).toBe('info');
  });

  it('accepts a custom duration', () => {
    toastStore.success('Saved!', 500);
    expect(get(toastStore)[0].duration).toBe(500);
  });
});

// ── dismiss() ────────────────────────────────────────────────────────────────

describe('toastStore — dismiss()', () => {
  it('removes the toast with the matching id', () => {
    const id = toastStore.show({ message: 'Removable' });
    toastStore.show({ message: 'Stays' });
    toastStore.dismiss(id);
    const toasts = get(toastStore);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Stays');
  });

  it('is a no-op for an unknown id', () => {
    toastStore.show({ message: 'Stays' });
    toastStore.dismiss('does-not-exist');
    expect(get(toastStore)).toHaveLength(1);
  });

  it('cancels the pending auto-dismiss timer', () => {
    vi.useFakeTimers();
    const id = toastStore.show({ message: 'Manual close', duration: 1000 });
    toastStore.dismiss(id);
    // Advancing time must not throw or affect an already-empty list.
    vi.advanceTimersByTime(1000);
    expect(get(toastStore)).toHaveLength(0);
  });
});

// ── clear() ──────────────────────────────────────────────────────────────────

describe('toastStore — clear()', () => {
  it('removes all toasts', () => {
    toastStore.show({ message: 'One' });
    toastStore.show({ message: 'Two' });
    toastStore.clear();
    expect(get(toastStore)).toEqual([]);
  });

  it('cancels all pending timers so they cannot fire later', () => {
    vi.useFakeTimers();
    toastStore.show({ message: 'One', duration: 1000 });
    toastStore.show({ message: 'Two', duration: 2000 });
    toastStore.clear();
    vi.advanceTimersByTime(5000);
    expect(get(toastStore)).toHaveLength(0);
  });

  it('is safe to call when already empty', () => {
    expect(() => toastStore.clear()).not.toThrow();
  });
});

// ── Toast type shape ─────────────────────────────────────────────────────────

describe('toastStore — toast shape', () => {
  it('produces objects matching the Toast interface', () => {
    toastStore.show({ message: 'Shape check', variant: 'success', duration: 100 });
    const toast: Toast = get(toastStore)[0];
    expect(toast).toMatchObject({
      message: 'Shape check',
      variant: 'success',
      duration: 100,
    });
    expect(typeof toast.id).toBe('string');
  });
});
