/**
 * active-call.store.ts
 *
 * Single source of truth for the call UI state machine. Covers both
 * the caller side ("outgoing-ringing" -> "in-call") and the callee
 * side ("incoming-ringing" -> "in-call"), driven by REST responses
 * and real-time socket events (see $lib/realtime/call-signaling.ts).
 */
import { writable } from 'svelte/store';
import type { CallType } from '$lib/api/calls.api';

export type ActiveCallPhase =
  | 'idle'
  | 'outgoing-ringing'
  | 'incoming-ringing'
  | 'connecting'
  | 'in-call';

export interface ActiveCallPeer {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface LiveKitCredentials {
  token: string;
  roomName: string;
  url?: string;
}

export interface ActiveCallState {
  phase: ActiveCallPhase;
  callId: string | null;
  peer: ActiveCallPeer | null;
  callType: CallType;
  callMode: 'one-to-one' | 'conference';
  liveKit: LiveKitCredentials | null;
  error: string | null;
}

const initialState: ActiveCallState = {
  phase: 'idle',
  callId: null,
  peer: null,
  callType: 'video',
  callMode: 'one-to-one',
  liveKit: null,
  error: null
};

function createActiveCallStore() {
  const { subscribe, set, update } = writable<ActiveCallState>(initialState);

  return {
    subscribe,

    /** Caller side: a call was just initiated, show "Calling…" UI. */
    startOutgoing(params: {
      callId: string;
      peer: ActiveCallPeer;
      callType: CallType;
      callMode: 'one-to-one' | 'conference';
      liveKit: LiveKitCredentials | null;
    }) {
      set({
        phase: 'outgoing-ringing',
        callId: params.callId,
        peer: params.peer,
        callType: params.callType,
        callMode: params.callMode,
        liveKit: params.liveKit,
        error: null
      });
    },

    /** Callee side: an incoming call notification arrived via socket. */
    setIncoming(params: {
      callId: string;
      peer: ActiveCallPeer;
      callType: CallType;
      callMode: 'one-to-one' | 'conference';
    }) {
      set({
        phase: 'incoming-ringing',
        callId: params.callId,
        peer: params.peer,
        callType: params.callType,
        callMode: params.callMode,
        liveKit: null,
        error: null
      });
    },

    setConnecting() {
      update((state) => ({ ...state, phase: 'connecting' }));
    },

    setInCall(liveKit: LiveKitCredentials) {
      update((state) => ({ ...state, phase: 'in-call', liveKit, error: null }));
    },

    setLiveKit(liveKit: LiveKitCredentials) {
      update((state) => ({ ...state, liveKit }));
    },

    setError(error: string | null) {
      update((state) => ({ ...state, error }));
    },

    /** True if the given call id is the one currently tracked. */
    isCurrent(callId: string, state: ActiveCallState) {
      return state.callId === callId;
    },

    reset() {
      set(initialState);
    }
  };
}

export const activeCallStore = createActiveCallStore();
