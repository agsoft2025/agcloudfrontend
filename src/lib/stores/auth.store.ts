import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { apiGet } from '$lib/api/client';

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
   * apiGet throws ApiError on non-2xx (401, 500, etc.) and AbortError on timeout,
   * all of which land in the catch block and result in the unauthenticated state.
   */
  async function initialize() {
    if (!browser) return;
    try {
      const user = await apiGet<AuthUser>('/auth/me');
      set({ user, isAuthenticated: true, isInitialized: true });
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
