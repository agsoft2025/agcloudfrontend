import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Must be declared before imports so vi.mock hoisting takes effect
vi.mock('$app/environment', () => ({ browser: true }));

import { themeStore } from '../../src/lib/stores/theme.store';

/** Minimal MediaQueryList mock supporting addEventListener/removeEventListener. */
function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_event: string, cb: (e: { matches: boolean }) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_event: string, cb: (e: { matches: boolean }) => void) => {
      listeners.delete(cb);
    }),
    // Test helper: simulate the OS preference changing.
    _trigger(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return mql;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  mockMatchMedia(false);
});

afterEach(() => {
  themeStore.destroy();
  vi.restoreAllMocks();
});

// ── Initial state ────────────────────────────────────────────────────────────

describe('themeStore — initial state', () => {
  it('defaults to "system" mode before initialize() is called', () => {
    expect(get(themeStore)).toBe('system');
  });
});

// ── initialize() ─────────────────────────────────────────────────────────────

describe('themeStore — initialize()', () => {
  it('defaults to "system" when nothing is persisted', () => {
    themeStore.initialize();
    expect(get(themeStore)).toBe('system');
  });

  it('reads a persisted "light" mode from localStorage', () => {
    localStorage.setItem('ag-cloud-theme', 'light');
    themeStore.initialize();
    expect(get(themeStore)).toBe('light');
  });

  it('reads a persisted "dark" mode from localStorage', () => {
    localStorage.setItem('ag-cloud-theme', 'dark');
    themeStore.initialize();
    expect(get(themeStore)).toBe('dark');
  });

  it('ignores an invalid persisted value and falls back to "system"', () => {
    localStorage.setItem('ag-cloud-theme', 'purple');
    themeStore.initialize();
    expect(get(themeStore)).toBe('system');
  });

  it('applies the resolved theme to <html data-theme>', () => {
    localStorage.setItem('ag-cloud-theme', 'dark');
    themeStore.initialize();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves "system" using the OS preference (dark)', () => {
    mockMatchMedia(true);
    themeStore.initialize();
    expect(get(themeStore.resolved)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves "system" using the OS preference (light)', () => {
    mockMatchMedia(false);
    themeStore.initialize();
    expect(get(themeStore.resolved)).toBe('light');
  });

  it('subscribes to OS preference changes', () => {
    const mql = mockMatchMedia(false);
    themeStore.initialize();
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('re-applies the resolved theme when the OS preference changes while following system', () => {
    const mql = mockMatchMedia(false);
    themeStore.initialize();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    mql._trigger(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does not react to OS changes when an explicit mode is set', () => {
    const mql = mockMatchMedia(false);
    localStorage.setItem('ag-cloud-theme', 'light');
    themeStore.initialize();

    mql._trigger(true);
    // Explicit "light" mode should not flip just because the OS changed.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

// ── destroy() ────────────────────────────────────────────────────────────────

describe('themeStore — destroy()', () => {
  it('unsubscribes from OS preference changes', () => {
    const mql = mockMatchMedia(false);
    themeStore.initialize();
    themeStore.destroy();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('is safe to call before initialize()', () => {
    expect(() => themeStore.destroy()).not.toThrow();
  });
});

// ── setMode() ────────────────────────────────────────────────────────────────

describe('themeStore — setMode()', () => {
  it('updates the store value', () => {
    themeStore.setMode('dark');
    expect(get(themeStore)).toBe('dark');
  });

  it('persists an explicit mode to localStorage', () => {
    themeStore.setMode('dark');
    expect(localStorage.getItem('ag-cloud-theme')).toBe('dark');
  });

  it('removes the localStorage entry when set back to "system"', () => {
    themeStore.setMode('dark');
    themeStore.setMode('system');
    expect(localStorage.getItem('ag-cloud-theme')).toBeNull();
  });

  it('updates the resolved derived store', () => {
    themeStore.setMode('dark');
    expect(get(themeStore.resolved)).toBe('dark');
    themeStore.setMode('light');
    expect(get(themeStore.resolved)).toBe('light');
  });
});

// ── toggle() ─────────────────────────────────────────────────────────────────

describe('themeStore — toggle()', () => {
  it('flips light to dark', () => {
    themeStore.setMode('light');
    themeStore.toggle();
    expect(get(themeStore)).toBe('dark');
  });

  it('flips dark to light', () => {
    themeStore.setMode('dark');
    themeStore.toggle();
    expect(get(themeStore)).toBe('light');
  });

  it('resolves "system" before flipping', () => {
    mockMatchMedia(true); // system resolves to dark
    themeStore.setMode('system');
    themeStore.toggle();
    // dark resolved -> toggle flips to light, and persists an explicit mode
    expect(get(themeStore)).toBe('light');
  });

  it('persists the toggled mode', () => {
    themeStore.setMode('light');
    themeStore.toggle();
    expect(localStorage.getItem('ag-cloud-theme')).toBe('dark');
  });
});

// ── resolved derived store ───────────────────────────────────────────────────

describe('themeStore — resolved', () => {
  it('mirrors the mode when explicit', () => {
    themeStore.setMode('dark');
    expect(get(themeStore.resolved)).toBe('dark');
  });

  it('tracks the OS preference when mode is "system"', () => {
    mockMatchMedia(true);
    themeStore.setMode('system');
    expect(get(themeStore.resolved)).toBe('dark');
  });
});
