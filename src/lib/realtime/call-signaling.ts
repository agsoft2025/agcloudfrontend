/**
 * call-signaling.ts
 *
 * Wires Socket.IO call-lifecycle events (emitted by the backend in
 * backend/src/modules/call/call.routes.ts) into the activeCallStore
 * state machine, so the UI reacts in real time on both ends of a call.
 */
import { get, writable } from 'svelte/store';
import { connectSocket, disconnectSocket } from './socket';
import { activeCallStore } from '$lib/stores/active-call.store';
import { presenceStore } from '$lib/stores/presence.store';
import type { CallType } from '$lib/api/calls.api';

/**
 * Lightweight event bus for call-lifecycle events that other parts of the
 * UI (e.g. RecentCalls) want to react to without owning their own socket
 * subscription. Each emission is `{ type, callId }`.
 */
export type CallLifecycleEvent = { type: string; callId: string; userId?: string };
export const callLifecycleEvents = writable<CallLifecycleEvent | null>(null);

function emitLifecycleEvent(type: string, callId: string, userId?: string) {
  callLifecycleEvents.set({ type, callId, userId });
}

interface PresenceUpdateEvent {
  userId: string;
  /** Accept `unknown` — normalisation happens inside setPresence(). */
  status: unknown;
  lastSeen?: string;
}

interface IncomingCallEvent {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  callType: CallType;
  callMode: 'one-to-one' | 'conference';
  roomId: string;
  reinvite?: boolean;
}

interface CallAcceptedEvent {
  callId: string;
  calleeId: string;
  roomId: string;
}

interface CallRejectedEvent {
  callId: string;
  calleeId: string;
}

interface CallCancelledEvent {
  callId: string;
}

interface CallEndedEvent {
  callId: string;
}

interface CallParticipantJoinedEvent {
  callId: string;
  userId: string;
  displayName: string;
}

interface CallParticipantRejectedEvent {
  callId: string;
  userId: string;
}

let isInitialized = false;

export function initCallSignaling(): void {
  const socket = connectSocket();
  if (!socket || isInitialized) return;
  isInitialized = true;

  socket.on('call:incoming', (data: IncomingCallEvent) => {
    console.log('[call-signaling] call:incoming', data);
    const state = get(activeCallStore);

    // Always record/refresh the invitation in the persistent notification
    // queue so multiple (or re-sent) invitations are never silently dropped.
    activeCallStore.addIncomingInvite({
      callId: data.callId,
      peer: { id: data.callerId, name: data.callerName, avatarUrl: data.callerAvatar ?? null },
      callType: data.callType,
      callMode: data.callMode,
      roomId: data.roomId,
      reinvite: Boolean(data.reinvite)
    });

    // Only drive the full-screen ringing overlay if the user is idle, or this
    // is a refreshed invite for the call they're already being prompted about.
    if (state.phase === 'idle' || state.callId === data.callId) {
      activeCallStore.setIncoming({
        callId: data.callId,
        peer: { id: data.callerId, name: data.callerName, avatarUrl: data.callerAvatar ?? null },
        callType: data.callType,
        callMode: data.callMode
      });
    }

    emitLifecycleEvent('call:incoming', data.callId);
  });

  socket.on('call:accepted', (data: CallAcceptedEvent) => {
    const state = get(activeCallStore);
    if (state.phase === 'outgoing-ringing' && state.callId === data.callId) {
      activeCallStore.setConnecting();
    }
    emitLifecycleEvent('call:accepted', data.callId);
  });

  socket.on('call:rejected', (data: CallRejectedEvent) => {
    const state = get(activeCallStore);
    if (state.phase === 'outgoing-ringing' && state.callId === data.callId) {
      activeCallStore.reset();
    }
    emitLifecycleEvent('call:rejected', data.callId);
  });

  socket.on('call:cancelled', (data: CallCancelledEvent) => {
    const state = get(activeCallStore);
    if (state.phase === 'incoming-ringing' && state.callId === data.callId) {
      activeCallStore.reset();
    }
    activeCallStore.removeIncomingInvite(data.callId);
    emitLifecycleEvent('call:cancelled', data.callId);
  });

  socket.on('call:participant-joined', (data: CallParticipantJoinedEvent) => {
    emitLifecycleEvent('call:participant-joined', data.callId);
  });

  socket.on('call:participant-rejected', (data: CallParticipantRejectedEvent) => {
    emitLifecycleEvent('call:participant-rejected', data.callId, data.userId);
  });

  socket.on('presence:update', (data: PresenceUpdateEvent) => {
    presenceStore.setPresence({
      userId: data.userId,
      status: data.status,
      lastSeen: data.lastSeen
    });
  });

  socket.on('call:ended', (data: CallEndedEvent) => {
    const state = get(activeCallStore);
    if (state.callId === data.callId) {
      activeCallStore.reset();
    }
    activeCallStore.markInviteEnded(data.callId);
    // Give the user a moment to see "Call Ended" before the banner disappears.
    window.setTimeout(() => activeCallStore.removeIncomingInvite(data.callId), 5000);
    emitLifecycleEvent('call:ended', data.callId);
  });
}

export function teardownCallSignaling(): void {
  isInitialized = false;
  disconnectSocket();
}
