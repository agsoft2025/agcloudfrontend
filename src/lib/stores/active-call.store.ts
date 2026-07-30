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

/** A pending call invitation shown in the persistent notification banner. */
export interface IncomingInvite {
  callId: string;
  peer: ActiveCallPeer;
  callType: CallType;
  callMode: 'one-to-one' | 'conference';
  roomId?: string;
  /** True if this is a re-invite (the user previously missed/rejected/left this call). */
  reinvite: boolean;
  /** 'ringing' while waiting for a response, 'ended' once the call has finished. */
  status: 'ringing' | 'ended';
  receivedAt: number;
}

export interface ActiveCallState {
  phase: ActiveCallPhase;
  callId: string | null;
  peer: ActiveCallPeer | null;
  callType: CallType;
  callMode: 'one-to-one' | 'conference';
  liveKit: LiveKitCredentials | null;
  error: string | null;
  /** All pending/active call invitations for the persistent notification banner. */
  incomingInvites: IncomingInvite[];
}

const initialState: ActiveCallState = {
  phase: 'idle',
  callId: null,
  peer: null,
  callType: 'video',
  callMode: 'one-to-one',
  liveKit: null,
  error: null,
  incomingInvites: []
};

function createActiveCallStore() {
  const { subscribe, update } = writable<ActiveCallState>(initialState);

  return {
    subscribe,

    /** Add a fresh incoming-call notification, or refresh it if one already exists for this call. */
    addIncomingInvite(invite: Omit<IncomingInvite, 'receivedAt' | 'status'>) {
      update((state) => {
        const existingIndex = state.incomingInvites.findIndex((i) => i.callId === invite.callId);
        const entry: IncomingInvite = { ...invite, receivedAt: Date.now(), status: 'ringing' };

        if (existingIndex === -1) {
          return { ...state, incomingInvites: [...state.incomingInvites, entry] };
        }

        const incomingInvites = [...state.incomingInvites];
        incomingInvites[existingIndex] = { ...incomingInvites[existingIndex], ...entry };
        return { ...state, incomingInvites };
      });
    },

    /** Mark a pending invitation as ended (call finished before the user responded). */
    markInviteEnded(callId: string) {
      update((state) => ({
        ...state,
        incomingInvites: state.incomingInvites.map((invite) =>
          invite.callId === callId ? { ...invite, status: 'ended' } : invite
        )
      }));
    },

    removeIncomingInvite(callId: string) {
      update((state) => ({
        ...state,
        incomingInvites: state.incomingInvites.filter((invite) => invite.callId !== callId)
      }));
    },

    /** Caller side: a call was just initiated, show "Calling…" UI. */
    startOutgoing(params: {
      callId: string;
      peer: ActiveCallPeer;
      callType: CallType;
      callMode: 'one-to-one' | 'conference';
      liveKit: LiveKitCredentials | null;
    }) {
      update((state) => ({
        ...initialState,
        incomingInvites: state.incomingInvites,
        phase: 'outgoing-ringing',
        callId: params.callId,
        peer: params.peer,
        callType: params.callType,
        callMode: params.callMode,
        liveKit: params.liveKit,
        error: null
      }));
    },

    /** Callee side: an incoming call notification arrived via socket. */
    setIncoming(params: {
      callId: string;
      peer: ActiveCallPeer;
      callType: CallType;
      callMode: 'one-to-one' | 'conference';
    }) {
      update((state) => ({
        ...initialState,
        incomingInvites: state.incomingInvites,
        phase: 'incoming-ringing',
        callId: params.callId,
        peer: params.peer,
        callType: params.callType,
        callMode: params.callMode,
        liveKit: null,
        error: null
      }));
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
      update((state) => ({ ...initialState, incomingInvites: state.incomingInvites }));
    }
  };
}

export const activeCallStore = createActiveCallStore();
