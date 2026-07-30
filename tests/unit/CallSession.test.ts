import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionState, Track } from 'livekit-client';

// ── Mocks — declared before imports so vi.mock hoisting takes effect ───────

// The real callStore only exposes syncRoom()/setHandRaised()/etc — none of
// which accept a plain state object. Mocking the module gives tests a bare
// writable so fixtures can be set directly with callStoreMock.set(...).
// NB: vi.mock factories are hoisted above the module's top-level consts, so
// the initial state literal is duplicated here rather than shared.
vi.mock('$lib/stores/call.store', async () => {
  const { writable } = await import('svelte/store');
  const { ConnectionState } = await import('livekit-client');
  const initial = {
    room: null,
    connectionState: ConnectionState.Disconnected,
    localParticipant: null,
    remoteParticipants: [],
    activeSpeakers: [],
    raisedHands: [],
    screenShareParticipantIdentity: null,
    error: null,
  };
  const store = writable({ ...initial });
  return {
    callStore: {
      subscribe: store.subscribe,
      set: store.set,
      update: store.update,
      syncRoom: () => {},
      setRoom: () => {},
      setActiveSpeakers: () => {},
      setHandRaised: () => {},
      setError: () => {},
      reset: () => store.set({ ...initial }),
    },
  };
});

const initialCallState: import('$lib/stores/call.store').CallState = {
  room: null,
  connectionState: ConnectionState.Disconnected,
  localParticipant: null,
  remoteParticipants: [],
  activeSpeakers: [],
  raisedHands: [],
  screenShareParticipantIdentity: null,
  error: null,
};

const setMicrophoneEnabled = vi.fn().mockResolvedValue(undefined);
const setCameraEnabled = vi.fn().mockResolvedValue(undefined);
const setCameraFacingMode = vi.fn().mockResolvedValue(undefined);
const setScreenShareEnabled = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/livekit/LiveKitClient', () => ({
  liveKitClient: {
    setMicrophoneEnabled: (...args: unknown[]) => setMicrophoneEnabled(...args),
    setCameraEnabled: (...args: unknown[]) => setCameraEnabled(...args),
    setCameraFacingMode: (...args: unknown[]) => setCameraFacingMode(...args),
    setScreenShareEnabled: (...args: unknown[]) => setScreenShareEnabled(...args),
  },
}));

const getContactsMock = vi.fn();
vi.mock('$lib/api/contacts.api', () => ({
  getContacts: (...args: unknown[]) => getContactsMock(...args),
}));

const addParticipantMock = vi.fn();
vi.mock('$lib/api/calls.api', () => ({
  addParticipant: (...args: unknown[]) => addParticipantMock(...args),
  getCallApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

import CallSession, { type ActiveCallSession } from '../../src/lib/components/calls/CallSession.svelte';
import CallSessionHarness from './CallSessionHarness.svelte';
import { callStore, type CallState } from '$lib/stores/call.store';
import { authStore } from '../../src/lib/stores/auth.store';
import { callLifecycleEvents } from '../../src/lib/realtime/call-signaling';

const callStoreMock = callStore as unknown as { set: (v: CallState) => void };

const session: ActiveCallSession = {
  callId: 'call-1',
  callMode: 'conference',
  callType: 'video',
  recipients: ['bob@example.com'],
  initiatedAt: new Date(),
};

function fakeVideoTrack() {
  // Deliberately omit `mediaStreamTrack` (see ParticipantTile.test.ts) —
  // jsdom has no global MediaStreamTrack to check `instanceof` against.
  return { kind: Track.Kind.Video, attach: vi.fn(), detach: vi.fn() } as unknown as Track;
}

type FakeParticipantState = import('$lib/stores/call.store').CallParticipantState;

function localParticipantFixture(
  overrides: Partial<{ micMuted: boolean; camMuted: boolean; withVideoTrack: boolean }> = {},
): FakeParticipantState {
  const { micMuted = false, camMuted = false, withVideoTrack = true } = overrides;
  return {
    sid: 'local-sid',
    identity: 'me',
    name: 'Me',
    metadata: undefined,
    kind: 'local' as const,
    isSpeaking: false,
    audioLevel: 0,
    connectionQuality: 'excellent',
    tracks: [
      {
        sid: 'audio-1',
        participantIdentity: 'me',
        kind: Track.Kind.Audio,
        source: Track.Source.Microphone,
        isMuted: micMuted,
        isSubscribed: true,
        publication: {},
        track: undefined,
      },
      {
        sid: 'video-1',
        participantIdentity: 'me',
        kind: Track.Kind.Video,
        source: Track.Source.Camera,
        isMuted: camMuted,
        isSubscribed: true,
        publication: {},
        track: withVideoTrack && !camMuted ? fakeVideoTrack() : undefined,
      },
    ],
    participant: {},
  } as unknown as FakeParticipantState;
}

function remoteParticipantFixture(identity: string, name: string): FakeParticipantState {
  return {
    sid: `${identity}-sid`,
    identity,
    name,
    metadata: undefined,
    kind: 'remote' as const,
    isSpeaking: false,
    audioLevel: 0,
    connectionQuality: 'good',
    tracks: [],
    participant: {},
  } as unknown as FakeParticipantState;
}

beforeEach(() => {
  // jsdom has no ResizeObserver; CallSession creates one unconditionally on mount.
  // Must be a real class (not an arrow function) — CallSession calls `new ResizeObserver(...)`.
  class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

  callStoreMock.set({ ...initialCallState });
  authStore.setUser({ id: 'me', email: 'me@example.com' });
  callLifecycleEvents.set(null);
  setMicrophoneEnabled.mockReset().mockResolvedValue(undefined);
  setCameraEnabled.mockReset().mockResolvedValue(undefined);
  setCameraFacingMode.mockReset().mockResolvedValue(undefined);
  setScreenShareEnabled.mockReset().mockResolvedValue(undefined);
  getContactsMock.mockReset();
  addParticipantMock.mockReset();
});

afterEach(() => {
  cleanup();
  authStore.clear();
});

// ── Default / disconnected state ────────────────────────────────────────────

describe('CallSession — default (disconnected) state', () => {
  it('renders the meeting room landmark', () => {
    const { getByLabelText } = render(CallSession, { session });
    expect(getByLabelText('Meeting room')).toBeTruthy();
  });

  it('shows the raw connection state when not connected', () => {
    const { getByText } = render(CallSession, { session });
    expect(getByText('disconnected')).toBeTruthy();
  });

  it('shows the waiting overlay with the invited recipients', () => {
    const { getByText } = render(CallSession, { session });
    expect(getByText('Waiting for others to join')).toBeTruthy();
    expect(getByText('Share the room ID with bob@example.com to invite them')).toBeTruthy();
  });

  it('shows a participant count of 0', () => {
    // Both the header badge and the grid share the "N participants" label text,
    // so scope to the header count element specifically.
    const { container } = render(CallSession, { session });
    expect(container.querySelector('.participant-count')?.getAttribute('aria-label')).toBe(
      '0 participants',
    );
  });

  it('disables the mic and camera controls', () => {
    // No localParticipant yet → both read as "off", so the buttons show their
    // "turn on" labels, and are disabled because the call isn't connected.
    const { getByRole } = render(CallSession, { session });
    expect(getByRole('button', { name: 'Unmute microphone' }).hasAttribute('disabled')).toBe(true);
    expect(getByRole('button', { name: 'Turn camera on' }).hasAttribute('disabled')).toBe(true);
  });
});

// ── Connected state with participants ───────────────────────────────────────

describe('CallSession — connected with participants', () => {
  beforeEach(() => {
    callStoreMock.set({
      ...initialCallState,
      connectionState: ConnectionState.Connected,
      localParticipant: localParticipantFixture(),
      remoteParticipants: [remoteParticipantFixture('bob', 'Bob')],
    });
  });

  it('shows "Connected"', () => {
    const { getByText } = render(CallSession, { session });
    expect(getByText('Connected')).toBeTruthy();
  });

  it('hides the waiting overlay once a remote participant is present', () => {
    const { queryByText } = render(CallSession, { session });
    expect(queryByText('Waiting for others to join')).toBeNull();
  });

  it('renders a grid with both participants', () => {
    const { container } = render(CallSession, { session });
    expect(container.querySelector('.participants-grid')?.getAttribute('aria-label')).toBe(
      '2 participants',
    );
  });

  it('enables the mic and camera controls', () => {
    const { getByRole } = render(CallSession, { session });
    expect(getByRole('button', { name: 'Mute microphone' }).hasAttribute('disabled')).toBe(false);
    expect(getByRole('button', { name: 'Turn camera off' }).hasAttribute('disabled')).toBe(false);
  });

  it('reflects a muted microphone', () => {
    callStoreMock.set({
      ...initialCallState,
      connectionState: ConnectionState.Connected,
      localParticipant: localParticipantFixture({ micMuted: true }),
      remoteParticipants: [],
    });
    const { getByRole } = render(CallSession, { session });
    expect(getByRole('button', { name: 'Unmute microphone' })).toBeTruthy();
  });
});

// ── Media control handlers ──────────────────────────────────────────────────

describe('CallSession — mic / camera / screen share controls', () => {
  beforeEach(() => {
    callStoreMock.set({
      ...initialCallState,
      connectionState: ConnectionState.Connected,
      localParticipant: localParticipantFixture(),
      remoteParticipants: [],
    });
  });

  it('mutes the microphone via liveKitClient', async () => {
    const { getByRole } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Mute microphone' }));
    await waitFor(() => expect(setMicrophoneEnabled).toHaveBeenCalledWith(false));
  });

  it('turns the camera off via liveKitClient', async () => {
    const { getByRole } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Turn camera off' }));
    await waitFor(() => expect(setCameraEnabled).toHaveBeenCalledWith(false));
  });

  it('starts screen sharing via liveKitClient', async () => {
    const { getByRole } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Share screen' }));
    await waitFor(() => expect(setScreenShareEnabled).toHaveBeenCalledWith(true));
  });

  it('shows a control error banner when a toggle rejects', async () => {
    setMicrophoneEnabled.mockRejectedValueOnce(new Error('mic exploded'));
    const { getByRole, getByText } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Mute microphone' }));
    await waitFor(() => expect(getByText('mic exploded')).toBeTruthy());
    expect(getByRole('alert')).toBeTruthy();
  });

  it('dismisses the control error banner', async () => {
    setMicrophoneEnabled.mockRejectedValueOnce(new Error('mic exploded'));
    const { getByRole, queryByText, getByText } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Mute microphone' }));
    await waitFor(() => expect(getByText('mic exploded')).toBeTruthy());
    await fireEvent.click(getByRole('button', { name: '✕' }));
    expect(queryByText('mic exploded')).toBeNull();
  });
});

// ── Raise hand ───────────────────────────────────────────────────────────────

describe('CallSession — raise hand', () => {
  beforeEach(() => {
    callStoreMock.set({
      ...initialCallState,
      connectionState: ConnectionState.Connected,
      localParticipant: localParticipantFixture(),
      remoteParticipants: [],
    });
  });

  it('toggles from "Raise hand" to "Lower hand"', async () => {
    const { getByRole } = render(CallSession, { session });
    const btn = getByRole('button', { name: 'Raise hand' });
    await fireEvent.click(btn);
    expect(getByRole('button', { name: 'Lower hand' })).toBeTruthy();
  });
});

// ── Recording (no active media tracks) ──────────────────────────────────────

describe('CallSession — recording without active tracks', () => {
  it('shows a toast and does not start recording when there is nothing to record', async () => {
    callStoreMock.set({
      ...initialCallState,
      connectionState: ConnectionState.Connected,
      localParticipant: localParticipantFixture(),
      remoteParticipants: [],
    });
    const { getByRole } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Start recording' }));
    // No MediaRecorder in jsdom to back a real recording — the component's own
    // "no tracks" guard fires first and keeps the button in its initial state.
    expect(getByRole('button', { name: 'Start recording' })).toBeTruthy();
  });
});

// ── End call ─────────────────────────────────────────────────────────────────

describe('CallSession — end call', () => {
  it('dispatches endCall when the end-call button is clicked', async () => {
    const onEndCall = vi.fn();
    const { getByRole } = render(CallSessionHarness, { session, onEndCall });
    await fireEvent.click(getByRole('button', { name: 'End call' }));
    expect(onEndCall).toHaveBeenCalledOnce();
  });

  it('disables the end-call button while isEndingCall is true', () => {
    const { getByRole } = render(CallSessionHarness, { session, isEndingCall: true });
    expect(getByRole('button', { name: 'End call' }).hasAttribute('disabled')).toBe(true);
  });
});

// ── Add people ───────────────────────────────────────────────────────────────

describe('CallSession — add people', () => {
  beforeEach(() => {
    callStoreMock.set({
      ...initialCallState,
      connectionState: ConnectionState.Connected,
      localParticipant: localParticipantFixture(),
      remoteParticipants: [],
    });
  });

  it('loads and lists contacts when opened', async () => {
    getContactsMock.mockResolvedValue([
      { id: 'c1', email: 'carol@example.com', displayName: 'Carol' },
    ]);
    const { getByRole, getByText } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Add people to this call' }));
    await waitFor(() => expect(getByText('Carol')).toBeTruthy());
    expect(getContactsMock).toHaveBeenCalledOnce();
  });

  it('shows an error state when contacts fail to load', async () => {
    getContactsMock.mockRejectedValue(new Error('boom'));
    const { getByRole, getByText } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Add people to this call' }));
    await waitFor(() => expect(getByText('Unable to load contacts.')).toBeTruthy());
  });

  it('invites a contact and marks them as invited', async () => {
    getContactsMock.mockResolvedValue([
      { id: 'c1', email: 'carol@example.com', displayName: 'Carol' },
    ]);
    addParticipantMock.mockResolvedValue({ message: 'ok' });
    const { getByRole, getByText } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Add people to this call' }));
    await waitFor(() => expect(getByText('Carol')).toBeTruthy());
    await fireEvent.click(getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(getByText('Invite Sent')).toBeTruthy());
    expect(addParticipantMock).toHaveBeenCalledWith('call-1', 'c1');
  });

  it('closes via the close button', async () => {
    getContactsMock.mockResolvedValue([]);
    const { getByRole, queryByLabelText } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Add people to this call' }));
    await waitFor(() => expect(getContactsMock).toHaveBeenCalledOnce());
    await fireEvent.click(getByRole('button', { name: 'Close' }));
    expect(queryByLabelText('Add people to call')).toBeNull();
  });

  it('reflects a rejection pushed through callLifecycleEvents', async () => {
    getContactsMock.mockResolvedValue([
      { id: 'c1', email: 'carol@example.com', displayName: 'Carol' },
    ]);
    addParticipantMock.mockResolvedValue({ message: 'ok' });
    const { getByRole, getByText } = render(CallSession, { session });
    await fireEvent.click(getByRole('button', { name: 'Add people to this call' }));
    await waitFor(() => expect(getByText('Carol')).toBeTruthy());
    await fireEvent.click(getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(getByText('Invite Sent')).toBeTruthy());

    callLifecycleEvents.set({ type: 'call:participant-rejected', callId: 'call-1', userId: 'c1' });
    await waitFor(() => expect(getByText('Declined')).toBeTruthy());
  });
});
