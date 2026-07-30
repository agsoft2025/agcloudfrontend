import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

/** The three user-selectable modes. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Resolved value written to <html data-theme="…"> */
export type ResolvedTheme = 'light' | 'dark';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ag-cloud-theme';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function getSystemPreference(): ResolvedTheme {
  if (!browser) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? getSystemPreference() : mode;
}

function readPersistedMode(): ThemeMode {
  if (!browser) return 'system';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system'; // default: follow OS
}

function persistMode(mode: ThemeMode) {
  if (!browser) return;
  if (mode === 'system') {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, mode);
  }
}

function applyToDOM(resolved: ResolvedTheme) {
  if (!browser) return;
  document.documentElement.setAttribute('data-theme', resolved);
}

// ─────────────────────────────────────────────────────────────────
// Store factory
// ─────────────────────────────────────────────────────────────────

function createThemeStore() {
  const _mode = writable<ThemeMode>('system');

  /** The effective theme applied to the DOM ('light' | 'dark'). */
  const resolved = derived(_mode, ($mode) => resolveMode($mode));

  let _mediaQuery: MediaQueryList | null = null;
  let _unsubResolved: (() => void) | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────

  /**
   * Call once in the root +layout.svelte onMount.
   * Reads localStorage, applies theme, subscribes to OS changes.
   */
  function initialize() {
    if (!browser) return;

    const initial = readPersistedMode();
    _mode.set(initial);
    applyToDOM(resolveMode(initial));

    // Apply to DOM on every mode change
    _unsubResolved = resolved.subscribe(applyToDOM);

    // React to OS preference changes in real time
    _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    _mediaQuery.addEventListener('change', _onSystemChange);
  }

  /** Call in onDestroy if you ever unmount the root layout. */
  function destroy() {
    _unsubResolved?.();
    _mediaQuery?.removeEventListener('change', _onSystemChange);
  }

  // ── Event handlers ──────────────────────────────────────────────

  function _onSystemChange() {
    // Only re-apply when the user is following system preference
    if (get(_mode) === 'system') {
      applyToDOM(getSystemPreference());
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Explicitly set the theme mode.
   * 'system' removes the localStorage entry and follows the OS.
   */
  function setMode(mode: ThemeMode) {
    persistMode(mode);
    _mode.set(mode);
  }

  /**
   * Toggle between light and dark.
   * If currently following system, resolves first then flips.
   */
  function toggle() {
    const current = resolveMode(get(_mode));
    const next: ResolvedTheme = current === 'dark' ? 'light' : 'dark';
    setMode(next);
  }

  return {
    /** Subscribe to the raw ThemeMode ('light' | 'dark' | 'system'). */
    subscribe: _mode.subscribe,
    /** Derived store: the resolved 'light' | 'dark' value. */
    resolved,
    initialize,
    destroy,
    setMode,
    toggle,
  };
}

export const themeStore = createThemeStore();
