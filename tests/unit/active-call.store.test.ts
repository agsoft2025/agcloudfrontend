import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { activeCallStore, type ActiveCallState, type IncomingInvite } from '../../src/lib/stores/active-call.store';

// ── Helpers ───────────────────────────────────────────────────────────────────

function readState(): ActiveCallState {
  return get(activeCallStore);
}

/**
 * Full reset between tests: remove every pending invite, then reset phase/call
 * state. activeCallStore.reset() preserves invites by design, so we clear them
 * manually first.
 */
function fullReset() {
  const { incomingInvites } = readState();
  for (const invite of incomingInvites) {
    activeCallStore.removeIncomingInvite(invite.callId);
  }
  activeCallStore.reset();
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const peer = { id: 'peer-1', name: 'Bob', avatarUrl: null };
const liveKit = { token: 'tok-abc', roomName: 'room-1', url: 'wss://lk.example.com' };

const baseInvite: Omit<IncomingInvite, 'receivedAt' | 'status'> = {
  callId: 'call-1',
  peer,
  callType: 'audio',
  callMode: 'one-to-one',
  reinvite: false,
};

// Captured before any test mutates the store — reflects true initial state.
const initialSnapshot = readState();

// ── Initial state ─────────────────────────────────────────────────────────────

describe('activeCallStore — initial state', () => {
  it('phase is idle', () => expect(initialSnapshot.phase).toBe('idle'));
  it('callId is null', () => expect(initialSnapshot.callId).toBeNull());
  it('peer is null', () => expect(initialSnapshot.peer).toBeNull());
  it('liveKit is null', () => expect(initialSnapshot.liveKit).toBeNull());
  it('error is null', () => expect(initialSnapshot.error).toBeNull());
  it('incomingInvites is empty', () => expect(initialSnapshot.incomingInvites).toHaveLength(0));
  it('callType defaults to video', () => expect(initialSnapshot.callType).toBe('video'));
  it('callMode defaults to one-to-one', () => expect(initialSnapshot.callMode).toBe('one-to-one'));
});

// ── addIncomingInvite() ───────────────────────────────────────────────────────

describe('activeCallStore — addIncomingInvite()', () => {
  beforeEach(fullReset);

  it('adds a new invite with status ringing', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    const { incomingInvites } = readState();
    expect(incomingInvites).toHaveLength(1);
    expect(incomingInvites[0].status).toBe('ringing');
  });

  it('stores the correct callId and peer', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    const invite = readState().incomingInvites[0];
    expect(invite.callId).toBe('call-1');
    expect(invite.peer).toEqual(peer);
  });

  it('sets receivedAt to approximately Date.now()', () => {
    const before = Date.now();
    activeCallStore.addIncomingInvite(baseInvite);
    const after = Date.now();
    const { receivedAt } = readState().incomingInvites[0];
    expect(receivedAt).toBeGreaterThanOrEqual(before);
    expect(receivedAt).toBeLessThanOrEqual(after);
  });

  it('updates an existing invite when callId matches', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.addIncomingInvite({ ...baseInvite, reinvite: true });
    const { incomingInvites } = readState();
    expect(incomingInvites).toHaveLength(1);
    expect(incomingInvites[0].reinvite).toBe(true);
    expect(incomingInvites[0].status).toBe('ringing'); // status reset to ringing on re-add
  });

  it('accumulates distinct invites', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.addIncomingInvite({ ...baseInvite, callId: 'call-2' });
    expect(readState().incomingInvites).toHaveLength(2);
  });

  it('does not affect the main call phase', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    expect(readState().phase).toBe('idle');
  });
});

// ── markInviteEnded() ─────────────────────────────────────────────────────────

describe('activeCallStore — markInviteEnded()', () => {
  beforeEach(fullReset);

  it('sets status to ended for the matching callId', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.markInviteEnded('call-1');
    expect(readState().incomingInvites[0].status).toBe('ended');
  });

  it('does not affect other invites', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.addIncomingInvite({ ...baseInvite, callId: 'call-2' });
    activeCallStore.markInviteEnded('call-1');
    const other = readState().incomingInvites.find((i) => i.callId === 'call-2');
    expect(other?.status).toBe('ringing');
  });

  it('is a no-op for an unknown callId', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.markInviteEnded('call-unknown');
    expect(readState().incomingInvites[0].status).toBe('ringing');
  });
});

// ── removeIncomingInvite() ────────────────────────────────────────────────────

describe('activeCallStore — removeIncomingInvite()', () => {
  beforeEach(fullReset);

  it('removes the matching invite', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.removeIncomingInvite('call-1');
    expect(readState().incomingInvites).toHaveLength(0);
  });

  it('preserves other invites', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.addIncomingInvite({ ...baseInvite, callId: 'call-2' });
    activeCallStore.removeIncomingInvite('call-1');
    const remaining = readState().incomingInvites;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].callId).toBe('call-2');
  });

  it('is a no-op for an unknown callId', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.removeIncomingInvite('call-unknown');
    expect(readState().incomingInvites).toHaveLength(1);
  });
});

// ── startOutgoing() ───────────────────────────────────────────────────────────

describe('activeCallStore — startOutgoing()', () => {
  beforeEach(fullReset);

  it('sets phase to outgoing-ringing', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit });
    expect(readState().phase).toBe('outgoing-ringing');
  });

  it('stores callId, peer, callType, callMode', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'audio', callMode: 'conference', liveKit: null });
    const s = readState();
    expect(s.callId).toBe('c1');
    expect(s.peer).toEqual(peer);
    expect(s.callType).toBe('audio');
    expect(s.callMode).toBe('conference');
  });

  it('stores liveKit credentials when provided', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit });
    expect(readState().liveKit).toEqual(liveKit);
  });

  it('accepts null liveKit', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    expect(readState().liveKit).toBeNull();
  });

  it('clears any prior error', () => {
    activeCallStore.setError('previous error');
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    expect(readState().error).toBeNull();
  });

  it('preserves existing incomingInvites', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.startOutgoing({ callId: 'c2', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    expect(readState().incomingInvites).toHaveLength(1);
  });
});

// ── setIncoming() ─────────────────────────────────────────────────────────────

describe('activeCallStore — setIncoming()', () => {
  beforeEach(fullReset);

  it('sets phase to incoming-ringing', () => {
    activeCallStore.setIncoming({ callId: 'c1', peer, callType: 'audio', callMode: 'one-to-one' });
    expect(readState().phase).toBe('incoming-ringing');
  });

  it('stores call details', () => {
    activeCallStore.setIncoming({ callId: 'c99', peer, callType: 'video', callMode: 'conference' });
    const s = readState();
    expect(s.callId).toBe('c99');
    expect(s.callType).toBe('video');
    expect(s.callMode).toBe('conference');
  });

  it('resets liveKit to null', () => {
    activeCallStore.setInCall(liveKit);
    activeCallStore.setIncoming({ callId: 'c1', peer, callType: 'audio', callMode: 'one-to-one' });
    expect(readState().liveKit).toBeNull();
  });

  it('preserves existing incomingInvites', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.setIncoming({ callId: 'c2', peer, callType: 'audio', callMode: 'one-to-one' });
    expect(readState().incomingInvites).toHaveLength(1);
  });
});

// ── setConnecting() ───────────────────────────────────────────────────────────

describe('activeCallStore — setConnecting()', () => {
  beforeEach(fullReset);

  it('sets phase to connecting', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    activeCallStore.setConnecting();
    expect(readState().phase).toBe('connecting');
  });

  it('does not change callId or peer', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    activeCallStore.setConnecting();
    const s = readState();
    expect(s.callId).toBe('c1');
    expect(s.peer).toEqual(peer);
  });
});

// ── setInCall() ───────────────────────────────────────────────────────────────

describe('activeCallStore — setInCall()', () => {
  beforeEach(fullReset);

  it('sets phase to in-call', () => {
    activeCallStore.setInCall(liveKit);
    expect(readState().phase).toBe('in-call');
  });

  it('stores liveKit credentials', () => {
    activeCallStore.setInCall(liveKit);
    expect(readState().liveKit).toEqual(liveKit);
  });

  it('clears any existing error', () => {
    activeCallStore.setError('connection failed');
    activeCallStore.setInCall(liveKit);
    expect(readState().error).toBeNull();
  });
});

// ── setLiveKit() ──────────────────────────────────────────────────────────────

describe('activeCallStore — setLiveKit()', () => {
  beforeEach(fullReset);

  it('updates liveKit credentials without changing phase', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    activeCallStore.setLiveKit({ token: 'new-tok', roomName: 'room-2' });
    const s = readState();
    expect(s.liveKit?.token).toBe('new-tok');
    expect(s.phase).toBe('outgoing-ringing');
  });
});

// ── setError() ────────────────────────────────────────────────────────────────

describe('activeCallStore — setError()', () => {
  beforeEach(fullReset);

  it('sets an error message', () => {
    activeCallStore.setError('network error');
    expect(readState().error).toBe('network error');
  });

  it('clears the error with null', () => {
    activeCallStore.setError('err');
    activeCallStore.setError(null);
    expect(readState().error).toBeNull();
  });
});

// ── isCurrent() ───────────────────────────────────────────────────────────────

describe('activeCallStore — isCurrent()', () => {
  beforeEach(fullReset);

  it('returns true when callId matches current state', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    expect(activeCallStore.isCurrent('c1', readState())).toBe(true);
  });

  it('returns false when callId does not match', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    expect(activeCallStore.isCurrent('c-other', readState())).toBe(false);
  });

  it('returns false when no call is active (callId null)', () => {
    expect(activeCallStore.isCurrent('c1', readState())).toBe(false);
  });
});

// ── reset() ───────────────────────────────────────────────────────────────────

describe('activeCallStore — reset()', () => {
  beforeEach(fullReset);

  it('resets phase to idle', () => {
    activeCallStore.setInCall(liveKit);
    activeCallStore.reset();
    expect(readState().phase).toBe('idle');
  });

  it('clears callId', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    activeCallStore.reset();
    expect(readState().callId).toBeNull();
  });

  it('clears peer', () => {
    activeCallStore.startOutgoing({ callId: 'c1', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    activeCallStore.reset();
    expect(readState().peer).toBeNull();
  });

  it('clears liveKit', () => {
    activeCallStore.setInCall(liveKit);
    activeCallStore.reset();
    expect(readState().liveKit).toBeNull();
  });

  it('clears error', () => {
    activeCallStore.setError('boom');
    activeCallStore.reset();
    expect(readState().error).toBeNull();
  });

  it('preserves incomingInvites', () => {
    activeCallStore.addIncomingInvite(baseInvite);
    activeCallStore.startOutgoing({ callId: 'c2', peer, callType: 'video', callMode: 'one-to-one', liveKit: null });
    activeCallStore.reset();
    expect(readState().incomingInvites).toHaveLength(1);
  });

  it('is idempotent', () => {
    activeCallStore.reset();
    activeCallStore.reset();
    expect(readState().phase).toBe('idle');
    expect(readState().callId).toBeNull();
  });
});
