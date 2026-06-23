import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { apiFetch } from '$lib/api/client';

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  status?: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface AuthSession {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const emptySession: AuthSession = {
  user: null,
  isAuthenticated: false,
  isInitialized: false
};

function createAuthStore() {
  const store = writable<AuthSession>(emptySession);
  const { subscribe, set, update } = store;

  /**
   * Verify session with the server via GET /auth/me (cookie sent automatically).
   * Uses apiFetch so URL construction goes through joinUrl — no double-slash
   * issues regardless of whether VITE_API_BASE_URL has a trailing slash.
   */
  async function initialize() {
    if (!browser) return;
    try {
      const response = await apiFetch('/auth/me');
      if (response.ok) {
        const user = (await response.json()) as AuthUser;
        set({ user, isAuthenticated: true, isInitialized: true });
      } else {
        set({ user: null, isAuthenticated: false, isInitialized: true });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isInitialized: true });
    }
  }

  function setUser(user: AuthUser | null) {
    update((current) => ({
      ...current,
      user,
      isAuthenticated: Boolean(user),
      isInitialized: true
    }));
  }

  function clear() {
    set({ user: null, isAuthenticated: false, isInitialized: true });
  }

  return {
    subscribe,
    initialize,
    setUser,
    clear,
    getUser: () => get(store).user,
    getSession: () => get(store)
  };
}

export const authStore = createAuthStore();
