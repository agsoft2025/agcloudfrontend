import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Must be declared before imports so vi.mock hoisting takes effect
vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/api/user.api', () => ({ getProfile: vi.fn() }));

import { userStore, type UserProfile } from '../../src/lib/stores/user.store';
import { getProfile } from '$lib/api/user.api';

const mockGetProfile = vi.mocked(getProfile);

const alice: UserProfile = {
  id: 'u1',
  email: 'alice@example.com',
  displayName: 'Alice',
};

const bob: UserProfile = {
  id: 'u2',
  email: 'bob@example.com',
  displayName: 'Bob',
};

beforeEach(() => {
  userStore.clear();
  localStorage.clear();
  vi.clearAllMocks();
});

// ── Initial state ────────────────────────────────────────────────────────────

describe('userStore — initial state (after clear())', () => {
  it('has no cached profiles', () => {
    expect(get(userStore).profiles.size).toBe(0);
  });

  it('is marked initialized', () => {
    expect(get(userStore).isInitialized).toBe(true);
  });
});

// ── setProfile() ─────────────────────────────────────────────────────────────

describe('userStore — setProfile()', () => {
  it('adds the profile to the cache', () => {
    userStore.setProfile(alice);
    expect(userStore.getProfile('u1')).toEqual(alice);
  });

  it('overwrites an existing profile with the same id', () => {
    userStore.setProfile(alice);
    userStore.setProfile({ ...alice, displayName: 'Alice Updated' });
    expect(userStore.getProfile('u1')?.displayName).toBe('Alice Updated');
  });

  it('clears a prior error for that user', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('boom'));
    await expect(userStore.hydrateProfile('u1', loader)).rejects.toThrow();
    expect(userStore.getError('u1')).toBe('boom');

    userStore.setProfile(alice);
    expect(userStore.getError('u1')).toBeNull();
  });

  it('persists the cache to localStorage', () => {
    userStore.setProfile(alice);
    const raw = localStorage.getItem('userProfileCache');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toContainEqual(alice);
  });
});

// ── setProfiles() ────────────────────────────────────────────────────────────

describe('userStore — setProfiles()', () => {
  it('adds multiple profiles at once', () => {
    userStore.setProfiles([alice, bob]);
    expect(userStore.getProfile('u1')).toEqual(alice);
    expect(userStore.getProfile('u2')).toEqual(bob);
  });

  it('merges with previously cached profiles rather than replacing them', () => {
    userStore.setProfile(alice);
    userStore.setProfiles([bob]);
    expect(userStore.getProfile('u1')).toEqual(alice);
    expect(userStore.getProfile('u2')).toEqual(bob);
  });
});

// ── removeProfile() ──────────────────────────────────────────────────────────

describe('userStore — removeProfile()', () => {
  it('removes a cached profile', () => {
    userStore.setProfile(alice);
    userStore.removeProfile('u1');
    expect(userStore.getProfile('u1')).toBeNull();
  });

  it('is a no-op for an unknown id', () => {
    userStore.setProfile(alice);
    userStore.removeProfile('does-not-exist');
    expect(userStore.getProfile('u1')).toEqual(alice);
  });
});

// ── hydrateProfile() ─────────────────────────────────────────────────────────

describe('userStore — hydrateProfile()', () => {
  it('returns the cached profile without calling the loader', async () => {
    userStore.setProfile(alice);
    const loader = vi.fn();
    const result = await userStore.hydrateProfile('u1', loader);
    expect(result).toEqual(alice);
    expect(loader).not.toHaveBeenCalled();
  });

  it('calls the default loader (getProfile) when not cached', async () => {
    mockGetProfile.mockResolvedValueOnce(alice);
    const result = await userStore.hydrateProfile('u1');
    expect(mockGetProfile).toHaveBeenCalledWith('u1');
    expect(result).toEqual(alice);
  });

  it('uses a custom loader when provided', async () => {
    const loader = vi.fn().mockResolvedValueOnce(bob);
    const result = await userStore.hydrateProfile('u2', loader);
    expect(loader).toHaveBeenCalledWith('u2');
    expect(result).toEqual(bob);
  });

  it('caches the fetched profile for subsequent calls', async () => {
    const loader = vi.fn().mockResolvedValueOnce(alice);
    await userStore.hydrateProfile('u1', loader);
    await userStore.hydrateProfile('u1', loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('marks the user as loading while the fetch is in flight', async () => {
    let resolveLoader: (p: UserProfile) => void;
    const pending = new Promise<UserProfile>((resolve) => { resolveLoader = resolve; });
    const loader = vi.fn().mockReturnValueOnce(pending);

    const promise = userStore.hydrateProfile('u1', loader);
    expect(userStore.isLoading('u1')).toBe(true);

    resolveLoader!(alice);
    await promise;
    expect(userStore.isLoading('u1')).toBe(false);
  });

  it('records an error message and clears the loading flag on failure', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('network down'));
    await expect(userStore.hydrateProfile('u1', loader)).rejects.toThrow('network down');
    expect(userStore.isLoading('u1')).toBe(false);
    expect(userStore.getError('u1')).toBe('network down');
  });

  it('falls back to a generic message for non-Error rejections', async () => {
    const loader = vi.fn().mockRejectedValueOnce('boom');
    await expect(userStore.hydrateProfile('u1', loader)).rejects.toBe('boom');
    expect(userStore.getError('u1')).toBe('Unable to load user profile.');
  });

  it('re-throws so callers can handle the failure', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('fail'));
    await expect(userStore.hydrateProfile('u1', loader)).rejects.toThrow('fail');
  });
});

// ── clear() ──────────────────────────────────────────────────────────────────

describe('userStore — clear()', () => {
  it('empties the profile cache', () => {
    userStore.setProfile(alice);
    userStore.clear();
    expect(userStore.getProfiles().size).toBe(0);
  });

  it('clears loading and error state', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('x'));
    await expect(userStore.hydrateProfile('u1', loader)).rejects.toThrow();
    userStore.clear();
    expect(userStore.getError('u1')).toBeNull();
    expect(userStore.isLoading('u1')).toBe(false);
  });
});

// ── getProfiles() / isLoading() / getError() ────────────────────────────────

describe('userStore — read accessors', () => {
  it('getProfiles() returns the full profile map', () => {
    userStore.setProfiles([alice, bob]);
    const all = userStore.getProfiles();
    expect(all.size).toBe(2);
    expect(all.get('u1')).toEqual(alice);
  });

  it('isLoading() is false for a user never fetched', () => {
    expect(userStore.isLoading('unknown')).toBe(false);
  });

  it('getError() is null for a user with no error', () => {
    expect(userStore.getError('unknown')).toBeNull();
  });
});

// ── Persisted cache (module load) ───────────────────────────────────────────

describe('userStore — persisted cache on load', () => {
  it('hydrates the initial state from localStorage on module load', async () => {
    localStorage.setItem('userProfileCache', JSON.stringify([alice, bob]));
    vi.resetModules();
    const { userStore: freshStore } = await import('../../src/lib/stores/user.store');
    expect(freshStore.getProfile('u1')).toEqual(alice);
    expect(freshStore.getProfile('u2')).toEqual(bob);
  });

  it('ignores malformed JSON and starts empty', async () => {
    localStorage.setItem('userProfileCache', '{not valid json');
    vi.resetModules();
    const { userStore: freshStore } = await import('../../src/lib/stores/user.store');
    expect(freshStore.getProfiles().size).toBe(0);
  });

  it('ignores a non-array payload and starts empty', async () => {
    localStorage.setItem('userProfileCache', JSON.stringify({ not: 'an array' }));
    vi.resetModules();
    const { userStore: freshStore } = await import('../../src/lib/stores/user.store');
    expect(freshStore.getProfiles().size).toBe(0);
  });
});

// ── initialize() ─────────────────────────────────────────────────────────────

describe('userStore — initialize()', () => {
  it('re-reads the persisted cache from localStorage', () => {
    userStore.setProfile(alice);
    localStorage.setItem('userProfileCache', JSON.stringify([bob]));
    userStore.initialize();
    expect(userStore.getProfile('u2')).toEqual(bob);
  });
});
