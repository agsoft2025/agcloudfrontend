import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';

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
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

export interface SetSessionInput {
  user?: AuthUser | null;
  accessToken?: string | null;
  refreshToken?: string | null;
}

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'authUser';

const emptySession: AuthSession = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isInitialized: false
};

function readJson<T>(key: string) {
  if (!browser) return null;

  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function readPersistedSession(): AuthSession {
  if (!browser) return emptySession;

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const user = readJson<AuthUser>(USER_KEY);

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: Boolean(accessToken || refreshToken),
    isInitialized: true
  };
}

function persistSession(session: AuthSession) {
  if (!browser) return;

  if (session.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  if (session.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  if (session.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

function normalizeSession(session: Omit<AuthSession, 'isAuthenticated' | 'isInitialized'>): AuthSession {
  return {
    ...session,
    isAuthenticated: Boolean(session.accessToken || session.refreshToken),
    isInitialized: true
  };
}

function createAuthStore() {
  const store = writable<AuthSession>(readPersistedSession());
  const { subscribe, set, update } = store;

  if (browser) {
    subscribe((session) => {
      if (session.isInitialized) {
        persistSession(session);
      }
    });
  }

  function setSession(input: SetSessionInput) {
    update((current) => {
      return normalizeSession({
        user: input.user === undefined ? current.user : input.user,
        accessToken: input.accessToken === undefined ? current.accessToken : input.accessToken,
        refreshToken: input.refreshToken === undefined ? current.refreshToken : input.refreshToken
      });
    });
  }

  function setAccessToken(accessToken: string | null) {
    setSession({ accessToken });
  }

  function setRefreshToken(refreshToken: string | null) {
    setSession({ refreshToken });
  }

  function setUser(user: AuthUser | null) {
    setSession({ user });
  }

  function clear() {
    set({ ...emptySession, isInitialized: true });
  }

  return {
    subscribe,
    initialize: () => set(readPersistedSession()),
    setSession,
    setAccessToken,
    setRefreshToken,
    setUser,
    clear,
    getAccessToken: () => get(store).accessToken,
    getRefreshToken: () => get(store).refreshToken,
    getUser: () => get(store).user,
    getSession: () => get(store)
  };
}

export const authStore = createAuthStore();
