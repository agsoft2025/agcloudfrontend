import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { privacyStore, type BlockedUser } from '../../src/lib/stores/privacy.store';

const alice: BlockedUser = { id: 'u1', username: 'alice' };
const bob: BlockedUser = { id: 'u2', username: 'bob' };
const carol: BlockedUser = { id: 'u3', username: 'carol' };

beforeEach(() => {
  privacyStore.reset();
});

// ── Initial state ────────────────────────────────────────────────────────────

describe('privacyStore — initial state (after reset())', () => {
  it('has an empty blocked list', () => {
    expect(get(privacyStore).blockedUsers).toEqual([]);
  });

  it('is not loading', () => {
    expect(get(privacyStore).loading).toBe(false);
  });

  it('has no error', () => {
    expect(get(privacyStore).error).toBeNull();
  });

  it('has no in-flight unblock operations', () => {
    expect(get(privacyStore).unblockingIds.size).toBe(0);
  });
});

// ── setLoading() / setUsers() / setFetchError() ─────────────────────────────

describe('privacyStore — fetch lifecycle', () => {
  it('setLoading() sets loading true and clears any error', () => {
    privacyStore.setFetchError('previous failure');
    privacyStore.setLoading();
    const s = get(privacyStore);
    expect(s.loading).toBe(true);
    expect(s.error).toBeNull();
  });

  it('setUsers() populates the list and clears loading/error', () => {
    privacyStore.setLoading();
    privacyStore.setUsers([alice, bob]);
    const s = get(privacyStore);
    expect(s.blockedUsers).toEqual([alice, bob]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('setFetchError() records the error and clears loading', () => {
    privacyStore.setLoading();
    privacyStore.setFetchError('network error');
    const s = get(privacyStore);
    expect(s.error).toBe('network error');
    expect(s.loading).toBe(false);
  });
});

// ── beginUnblock() ───────────────────────────────────────────────────────────

describe('privacyStore — beginUnblock()', () => {
  beforeEach(() => {
    privacyStore.setUsers([alice, bob, carol]);
  });

  it('removes the user from the visible list', () => {
    privacyStore.beginUnblock('u2');
    expect(get(privacyStore).blockedUsers.map((u) => u.id)).toEqual(['u1', 'u3']);
  });

  it('marks the user id as in-flight', () => {
    privacyStore.beginUnblock('u2');
    expect(get(privacyStore).unblockingIds.has('u2')).toBe(true);
  });

  it('returns the removed user and its original index', () => {
    const result = privacyStore.beginUnblock('u2');
    expect(result).toEqual({ user: bob, index: 1 });
  });

  it('returns null for an id that is not in the list', () => {
    const result = privacyStore.beginUnblock('does-not-exist');
    expect(result).toBeNull();
  });

  it('returns null and is a no-op when already unblocking that id', () => {
    privacyStore.beginUnblock('u2');
    const before = get(privacyStore).blockedUsers;
    const result = privacyStore.beginUnblock('u2');
    expect(result).toBeNull();
    expect(get(privacyStore).blockedUsers).toBe(before);
  });
});

// ── commitUnblock() ──────────────────────────────────────────────────────────

describe('privacyStore — commitUnblock()', () => {
  it('clears the in-flight marker without restoring the user', () => {
    privacyStore.setUsers([alice, bob]);
    privacyStore.beginUnblock('u1');
    privacyStore.commitUnblock('u1');
    const s = get(privacyStore);
    expect(s.unblockingIds.has('u1')).toBe(false);
    expect(s.blockedUsers.map((u) => u.id)).toEqual(['u2']);
  });

  it('is safe to call for an id that was never unblocking', () => {
    privacyStore.setUsers([alice]);
    expect(() => privacyStore.commitUnblock('unknown')).not.toThrow();
  });
});

// ── rollbackUnblock() ────────────────────────────────────────────────────────

describe('privacyStore — rollbackUnblock()', () => {
  it('re-inserts the user at their original index', () => {
    privacyStore.setUsers([alice, bob, carol]);
    const removed = privacyStore.beginUnblock('u2')!;
    privacyStore.rollbackUnblock('u2', removed.user, removed.index);
    expect(get(privacyStore).blockedUsers.map((u) => u.id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('clears the in-flight marker', () => {
    privacyStore.setUsers([alice, bob]);
    const removed = privacyStore.beginUnblock('u1')!;
    privacyStore.rollbackUnblock('u1', removed.user, removed.index);
    expect(get(privacyStore).unblockingIds.has('u1')).toBe(false);
  });

  it('clamps the index and appends when the list has since shrunk', () => {
    privacyStore.setUsers([alice, bob, carol]);
    const removed = privacyStore.beginUnblock('u1')!; // index 0
    // Simulate the list shrinking further (e.g. another unblock completed) before rollback.
    privacyStore.beginUnblock('u2');
    privacyStore.commitUnblock('u2');
    privacyStore.rollbackUnblock('u1', removed.user, removed.index);
    expect(get(privacyStore).blockedUsers.map((u) => u.id)).toEqual(['u1', 'u3']);
  });
});

// ── Full optimistic-unblock round trip ──────────────────────────────────────

describe('privacyStore — optimistic unblock flow', () => {
  it('success path: begin then commit leaves the user removed', () => {
    privacyStore.setUsers([alice, bob]);
    const removed = privacyStore.beginUnblock('u1')!;
    privacyStore.commitUnblock('u1');
    expect(get(privacyStore).blockedUsers.map((u) => u.id)).toEqual(['u2']);
    expect(removed.user).toEqual(alice);
  });

  it('failure path: begin then rollback restores the user', () => {
    privacyStore.setUsers([alice, bob]);
    const removed = privacyStore.beginUnblock('u1')!;
    privacyStore.rollbackUnblock('u1', removed.user, removed.index);
    expect(get(privacyStore).blockedUsers).toEqual([alice, bob]);
  });
});

// ── reset() ──────────────────────────────────────────────────────────────────

describe('privacyStore — reset()', () => {
  it('clears the list, loading, error, and in-flight ids', () => {
    privacyStore.setUsers([alice]);
    privacyStore.beginUnblock('u1');
    privacyStore.setFetchError('x');
    privacyStore.reset();
    const s = get(privacyStore);
    expect(s.blockedUsers).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.unblockingIds.size).toBe(0);
  });
});
