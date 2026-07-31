import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { ConnectionQuality, ConnectionState, Track } from 'livekit-client';
import { callStore, snapshotRoom, type CallState } from '../../src/lib/stores/call.store';

// ── Minimal mock helpers ──────────────────────────────────────────────────────
//
// We only implement the properties that snapshotRoom / mapParticipant /
// mapTrackPublication actually read, then cast with `as unknown as Room` so
// TypeScript is happy without needing the full LiveKit interface surface.

function mockPublication(overrides: Record<string, unknown> = {}) {
  return {
    trackSid: 'track-1',
    kind: Track.Kind.Video,
    source: Track.Source.Camera,
    isMuted: false,
    isLocal: true,
    track: undefined,
    // RemoteTrackPublication shape — only read when isLocal === false
    isSubscribed: false,
    ...overrides,
  };
}

function mockParticipant(overrides: Record<string, unknown> = {}) {
  return {
    sid: 'p-sid-1',
    identity: 'alice',
    name: 'Alice',
    metadata: undefined as string | undefined,
    isSpeaking: false,
    audioLevel: 0,
    connectionQuality: ConnectionQuality.Excellent,
    getTrackPublications: () => [] as ReturnType<typeof mockPublication>[],
    ...overrides,
  };
}

function mockRoom(overrides: Record<string, unknown> = {}) {
  return {
    state: ConnectionState.Connected,
    localParticipant: mockParticipant({ identity: 'local', name: 'Me' }),
    remoteParticipants: new Map<string, ReturnType<typeof mockParticipant>>(),
    activeSpeakers: [] as ReturnType<typeof mockParticipant>[],
    ...overrides,
  };
}

function readState(): CallState {
  return get(callStore);
}

// Captured before any test mutates the store — reflects true initial state.
const initialSnapshot = readState();

// ── Initial state ─────────────────────────────────────────────────────────────

describe('callStore — initial state', () => {
  it('room is null', () => expect(initialSnapshot.room).toBeNull());
  it('connectionState is Disconnected', () =>
    expect(initialSnapshot.connectionState).toBe(ConnectionState.Disconnected));
  it('localParticipant is null', () => expect(initialSnapshot.localParticipant).toBeNull());
  it('remoteParticipants is empty', () => expect(initialSnapshot.remoteParticipants).toHaveLength(0));
  it('activeSpeakers is empty', () => expect(initialSnapshot.activeSpeakers).toHaveLength(0));
  it('raisedHands is empty', () => expect(initialSnapshot.raisedHands).toHaveLength(0));
  it('error is null', () => expect(initialSnapshot.error).toBeNull());
});

// ── syncRoom() / setRoom() ────────────────────────────────────────────────────

describe('callStore — syncRoom()', () => {
  beforeEach(() => callStore.reset());

  it('stores the room reference', () => {
    const room = mockRoom();
    callStore.syncRoom(room as any);
    expect(readState().room).toBe(room);
  });

  it('sets connectionState from room.state', () => {
    callStore.syncRoom(mockRoom() as any);
    expect(readState().connectionState).toBe(ConnectionState.Connected);
  });

  it('maps localParticipant identity and kind', () => {
    callStore.syncRoom(mockRoom() as any);
    const lp = readState().localParticipant;
    expect(lp?.identity).toBe('local');
    expect(lp?.kind).toBe('local');
  });

  it('maps localParticipant name and metadata', () => {
    const local = mockParticipant({ identity: 'local', name: 'Me', metadata: 'meta-data' });
    callStore.syncRoom(mockRoom({ localParticipant: local }) as any);
    const lp = readState().localParticipant;
    expect(lp?.name).toBe('Me');
    expect(lp?.metadata).toBe('meta-data');
  });

  it('maps localParticipant connection quality and audio level', () => {
    const local = mockParticipant({
      identity: 'local',
      audioLevel: 0.75,
      connectionQuality: ConnectionQuality.Good,
    });
    callStore.syncRoom(mockRoom({ localParticipant: local }) as any);
    const lp = readState().localParticipant;
    expect(lp?.audioLevel).toBe(0.75);
    expect(lp?.connectionQuality).toBe(ConnectionQuality.Good);
  });

  it('maps a remote participant with kind remote', () => {
    const bob = mockParticipant({ identity: 'bob', name: 'Bob', sid: 'r-sid-1' });
    const room = mockRoom({ remoteParticipants: new Map([['bob', bob]]) });
    callStore.syncRoom(room as any);
    const rp = readState().remoteParticipants;
    expect(rp).toHaveLength(1);
    expect(rp[0].identity).toBe('bob');
    expect(rp[0].kind).toBe('remote');
  });

  it('maps multiple remote participants', () => {
    const bob = mockParticipant({ identity: 'bob', sid: 'r1' });
    const carol = mockParticipant({ identity: 'carol', sid: 'r2' });
    const room = mockRoom({
      remoteParticipants: new Map([['bob', bob], ['carol', carol]]),
    });
    callStore.syncRoom(room as any);
    expect(readState().remoteParticipants).toHaveLength(2);
  });

  it('maps activeSpeakers identities', () => {
    const local = mockParticipant({ identity: 'local' });
    const room = mockRoom({ localParticipant: local, activeSpeakers: [local] });
    callStore.syncRoom(room as any);
    expect(readState().activeSpeakers).toContain('local');
  });

  it('preserves raisedHands across syncRoom calls', () => {
    callStore.setHandRaised('alice', true);
    callStore.syncRoom(mockRoom() as any);
    expect(readState().raisedHands).toContain('alice');
  });

  it('maps track publications for localParticipant', () => {
    const pub = mockPublication({ trackSid: 'vid-1', kind: Track.Kind.Video, isLocal: true });
    const local = mockParticipant({ identity: 'local', getTrackPublications: () => [pub] });
    callStore.syncRoom(mockRoom({ localParticipant: local }) as any);
    const tracks = readState().localParticipant?.tracks ?? [];
    expect(tracks).toHaveLength(1);
    expect(tracks[0].sid).toBe('vid-1');
    expect(tracks[0].kind).toBe(Track.Kind.Video);
  });

  it('local track is always isSubscribed=true', () => {
    const pub = mockPublication({ isLocal: true, isSubscribed: false });
    const local = mockParticipant({ identity: 'local', getTrackPublications: () => [pub] });
    callStore.syncRoom(mockRoom({ localParticipant: local }) as any);
    expect(readState().localParticipant?.tracks[0].isSubscribed).toBe(true);
  });

  it('remote track reads isSubscribed from publication', () => {
    const sub = mockPublication({ isLocal: false, isSubscribed: true, trackSid: 'aud-1' });
    const unsub = mockPublication({ isLocal: false, isSubscribed: false, trackSid: 'aud-2' });
    const bob = mockParticipant({ identity: 'bob', getTrackPublications: () => [sub, unsub] });
    const room = mockRoom({ remoteParticipants: new Map([['bob', bob]]) });
    callStore.syncRoom(room as any);
    const [t1, t2] = readState().remoteParticipants[0].tracks;
    expect(t1.isSubscribed).toBe(true);
    expect(t2.isSubscribed).toBe(false);
  });

  it('maps track muted state', () => {
    const pub = mockPublication({ isMuted: true });
    const local = mockParticipant({ identity: 'local', getTrackPublications: () => [pub] });
    callStore.syncRoom(mockRoom({ localParticipant: local }) as any);
    expect(readState().localParticipant?.tracks[0].isMuted).toBe(true);
  });

  it('setRoom is an alias for syncRoom', () => {
    callStore.setRoom(mockRoom() as any);
    expect(readState().connectionState).toBe(ConnectionState.Connected);
  });
});

// ── setActiveSpeakers() ───────────────────────────────────────────────────────

describe('callStore — setActiveSpeakers()', () => {
  beforeEach(() => {
    callStore.reset();
    // Populate with a local + one remote participant
    const bob = mockParticipant({ identity: 'bob', sid: 'r1' });
    const room = mockRoom({
      localParticipant: mockParticipant({ identity: 'local' }),
      remoteParticipants: new Map([['bob', bob]]),
    });
    callStore.syncRoom(room as any);
  });

  it('updates activeSpeakers list', () => {
    callStore.setActiveSpeakers(['local', 'bob']);
    expect(readState().activeSpeakers).toEqual(['local', 'bob']);
  });

  it('sets isSpeaking on localParticipant when included', () => {
    callStore.setActiveSpeakers(['local']);
    expect(readState().localParticipant?.isSpeaking).toBe(true);
  });

  it('clears isSpeaking on localParticipant when removed', () => {
    callStore.setActiveSpeakers(['local']);
    callStore.setActiveSpeakers([]);
    expect(readState().localParticipant?.isSpeaking).toBe(false);
  });

  it('sets isSpeaking on a remote participant when included', () => {
    callStore.setActiveSpeakers(['bob']);
    expect(readState().remoteParticipants[0].isSpeaking).toBe(true);
  });

  it('clears isSpeaking on a remote participant when removed', () => {
    callStore.setActiveSpeakers(['bob']);
    callStore.setActiveSpeakers([]);
    expect(readState().remoteParticipants[0].isSpeaking).toBe(false);
  });

  it('returns identical state reference when speaker list is unchanged (dedup)', () => {
    callStore.setActiveSpeakers(['bob']);
    const before = readState();
    callStore.setActiveSpeakers(['bob']);
    const after = readState();
    // activeSpeakers array should be the same reference (no new object was created)
    expect(after.activeSpeakers).toBe(before.activeSpeakers);
  });

  it('clears all speakers with an empty array', () => {
    callStore.setActiveSpeakers(['local', 'bob']);
    callStore.setActiveSpeakers([]);
    expect(readState().activeSpeakers).toHaveLength(0);
  });
});

// ── setHandRaised() ───────────────────────────────────────────────────────────

describe('callStore — setHandRaised()', () => {
  beforeEach(() => callStore.reset());

  it('adds identity to raisedHands', () => {
    callStore.setHandRaised('alice', true);
    expect(readState().raisedHands).toContain('alice');
  });

  it('removes identity from raisedHands', () => {
    callStore.setHandRaised('alice', true);
    callStore.setHandRaised('alice', false);
    expect(readState().raisedHands).not.toContain('alice');
  });

  it('adding the same identity twice does not duplicate', () => {
    callStore.setHandRaised('alice', true);
    callStore.setHandRaised('alice', true);
    const hits = readState().raisedHands.filter((id) => id === 'alice');
    expect(hits).toHaveLength(1);
  });

  it('removing a non-present identity is a no-op', () => {
    callStore.setHandRaised('alice', true);
    callStore.setHandRaised('bob', false); // bob was never added
    expect(readState().raisedHands).toContain('alice');
    expect(readState().raisedHands).not.toContain('bob');
  });

  it('tracks multiple identities independently', () => {
    callStore.setHandRaised('alice', true);
    callStore.setHandRaised('bob', true);
    callStore.setHandRaised('alice', false);
    expect(readState().raisedHands).toContain('bob');
    expect(readState().raisedHands).not.toContain('alice');
  });
});

// ── setError() ────────────────────────────────────────────────────────────────

describe('callStore — setError()', () => {
  beforeEach(() => callStore.reset());

  it('sets an error message', () => {
    callStore.setError('connection lost');
    expect(readState().error).toBe('connection lost');
  });

  it('clears the error with null', () => {
    callStore.setError('err');
    callStore.setError(null);
    expect(readState().error).toBeNull();
  });
});

// ── reset() ───────────────────────────────────────────────────────────────────

describe('callStore — reset()', () => {
  it('returns all fields to initial values', () => {
    callStore.syncRoom(mockRoom() as any);
    callStore.setHandRaised('alice', true);
    callStore.setError('boom');
    callStore.reset();
    const s = readState();
    expect(s.room).toBeNull();
    expect(s.connectionState).toBe(ConnectionState.Disconnected);
    expect(s.localParticipant).toBeNull();
    expect(s.remoteParticipants).toHaveLength(0);
    expect(s.activeSpeakers).toHaveLength(0);
    expect(s.raisedHands).toHaveLength(0);
    expect(s.error).toBeNull();
  });

  it('is idempotent', () => {
    callStore.reset();
    callStore.reset();
    expect(readState().connectionState).toBe(ConnectionState.Disconnected);
  });
});

// ── snapshotRoom() (exported helper) ─────────────────────────────────────────

describe('snapshotRoom()', () => {
  it('returns a CallState snapshot from a Room', () => {
    const room = mockRoom();
    const snap = snapshotRoom(room as any);
    expect(snap.room).toBe(room);
    expect(snap.connectionState).toBe(ConnectionState.Connected);
    expect(snap.localParticipant?.identity).toBe('local');
    expect(snap.raisedHands).toHaveLength(0);
    expect(snap.error).toBeNull();
  });

  it('snapshot is independent of store state', () => {
    callStore.reset();
    const snap = snapshotRoom(mockRoom() as any);
    // Store is still in initial (disconnected) state
    expect(readState().connectionState).toBe(ConnectionState.Disconnected);
    // Snapshot reflects the provided room
    expect(snap.connectionState).toBe(ConnectionState.Connected);
  });

  it('maps all remote participants in the snapshot', () => {
    const bob = mockParticipant({ identity: 'bob', sid: 'b1' });
    const carol = mockParticipant({ identity: 'carol', sid: 'c1' });
    const room = mockRoom({
      remoteParticipants: new Map([['bob', bob], ['carol', carol]]),
    });
    const snap = snapshotRoom(room as any);
    expect(snap.remoteParticipants).toHaveLength(2);
  });

  it('activeSpeakers contains the identity of each active speaker', () => {
    const local = mockParticipant({ identity: 'local' });
    const room = mockRoom({ localParticipant: local, activeSpeakers: [local] });
    const snap = snapshotRoom(room as any);
    expect(snap.activeSpeakers).toContain('local');
  });
});
