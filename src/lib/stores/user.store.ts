import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { getProfile } from '$lib/api/user.api';
import type { AuthUser } from './auth.store';

export interface UserProfile extends AuthUser {
  role?: string;
  status?: string;
  avatarUrl?: string | null;
}

export interface UserProfileCacheState {
  profiles: Map<string, UserProfile>;
  loadingIds: Set<string>;
  errorById: Map<string, string>;
  isInitialized: boolean;
}

export type UserProfileLoader = (userId: string) => Promise<UserProfile>;

const USER_PROFILE_CACHE_KEY = 'userProfileCache';

const emptyState: UserProfileCacheState = {
  profiles: new Map(),
  loadingIds: new Set(),
  errorById: new Map(),
  isInitialized: false
};

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const profile = value as { id?: unknown; email?: unknown };

  return typeof profile.id === 'string' && typeof profile.email === 'string';
}

function readPersistedProfiles() {
  if (!browser) return new Map<string, UserProfile>();

  const value = localStorage.getItem(USER_PROFILE_CACHE_KEY);
  if (!value) return new Map<string, UserProfile>();

  try {
    const profiles = JSON.parse(value) as unknown;

    if (!Array.isArray(profiles)) {
      localStorage.removeItem(USER_PROFILE_CACHE_KEY);
      return new Map<string, UserProfile>();
    }

    return new Map(
      profiles
        .filter(isUserProfile)
        .map((profile) => [profile.id, profile])
    );
  } catch {
    localStorage.removeItem(USER_PROFILE_CACHE_KEY);
    return new Map<string, UserProfile>();
  }
}

function readPersistedState(): UserProfileCacheState {
  if (!browser) return emptyState;

  return {
    profiles: readPersistedProfiles(),
    loadingIds: new Set(),
    errorById: new Map(),
    isInitialized: true
  };
}

function persistProfiles(profiles: Map<string, UserProfile>) {
  if (!browser) return;

  localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(Array.from(profiles.values())));
}

// Profile fetching is handled by getProfile() in lib/api/user.api.ts.
// Keeping this thin alias so hydrateProfile's loader parameter type is satisfied
// without spreading API-layer logic across store and API modules.
async function defaultProfileLoader(userId: string): Promise<UserProfile> {
  return getProfile(userId);
}

function createUserStore() {
  const store = writable<UserProfileCacheState>(readPersistedState());
  const { subscribe, set, update } = store;

  if (browser) {
    subscribe((state) => {
      if (state.isInitialized) {
        persistProfiles(state.profiles);
      }
    });
  }

  function setProfile(profile: UserProfile) {
    update((state) => {
      const profiles = new Map(state.profiles);
      profiles.set(profile.id, profile);

      const errorById = new Map(state.errorById);
      errorById.delete(profile.id);

      return {
        ...state,
        profiles,
        errorById,
        isInitialized: true
      };
    });
  }

  function setProfiles(profiles: UserProfile[]) {
    update((state) => {
      const nextProfiles = new Map(state.profiles);
      const errorById = new Map(state.errorById);

      profiles.forEach((profile) => {
        nextProfiles.set(profile.id, profile);
        errorById.delete(profile.id);
      });

      return {
        ...state,
        profiles: nextProfiles,
        errorById,
        isInitialized: true
      };
    });
  }

  function removeProfile(userId: string) {
    update((state) => {
      const profiles = new Map(state.profiles);
      const loadingIds = new Set(state.loadingIds);
      const errorById = new Map(state.errorById);

      profiles.delete(userId);
      loadingIds.delete(userId);
      errorById.delete(userId);

      return {
        ...state,
        profiles,
        loadingIds,
        errorById,
        isInitialized: true
      };
    });
  }

  async function hydrateProfile(userId: string, loader: UserProfileLoader = defaultProfileLoader) {
    const cached = get(store).profiles.get(userId);

    if (cached) {
      return cached;
    }

    update((state) => ({
      ...state,
      loadingIds: new Set(state.loadingIds).add(userId),
      isInitialized: true
    }));

    try {
      const profile = await loader(userId);
      setProfile(profile);
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load user profile.';

      update((state) => {
        const loadingIds = new Set(state.loadingIds);
        const errorById = new Map(state.errorById);

        loadingIds.delete(userId);
        errorById.set(userId, message);

        return {
          ...state,
          loadingIds,
          errorById,
          isInitialized: true
        };
      });

      throw error;
    } finally {
      update((state) => {
        const loadingIds = new Set(state.loadingIds);
        loadingIds.delete(userId);

        return {
          ...state,
          loadingIds,
          isInitialized: true
        };
      });
    }
  }

  function clear() {
    set({ ...emptyState, profiles: new Map(), loadingIds: new Set(), errorById: new Map(), isInitialized: true });
  }

  return {
    subscribe,
    initialize: () => set(readPersistedState()),
    setProfile,
    setProfiles,
    removeProfile,
    hydrateProfile,
    clear,
    getProfile: (userId: string) => get(store).profiles.get(userId) ?? null,
    getProfiles: () => get(store).profiles,
    isLoading: (userId: string) => get(store).loadingIds.has(userId),
    getError: (userId: string) => get(store).errorById.get(userId) ?? null
  };
}

export const userStore = createUserStore();
