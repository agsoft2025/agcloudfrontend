/**
 * call-signaling.ts
 *
 * Wires Socket.IO call-lifecycle events (emitted by the backend in
 * backend/src/modules/call/call.routes.ts) into the activeCallStore
 * state machine, so the UI reacts in real time on both ends of a call.
 */
import { get } from 'svelte/store';
import { connectSocket, disconnectSocket } from './socket';
import { activeCallStore } from '$lib/stores/active-call.store';
import { presenceStore, type PresenceStatus } from '$lib/stores/presence.store';
import type { CallType } from '$lib/api/calls.api';

interface PresenceUpdateEvent {
  userId: string;
  status: PresenceStatus;
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

let isInitialized = false;

export function initCallSignaling(): void {
  const socket = connectSocket();
  if (!socket || isInitialized) return;
  isInitialized = true;

  socket.on('call:incoming', (data: IncomingCallEvent) => {
    console.log('[call-signaling] call:incoming', data);
    const state = get(activeCallStore);
    // Ignore new incoming calls while already on/initiating a call.
    if (state.phase !== 'idle') {
      console.warn('[call-signaling] ignoring call:incoming, phase is', state.phase);
      return;
    }

    activeCallStore.setIncoming({
      callId: data.callId,
      peer: { id: data.callerId, name: data.callerName, avatarUrl: data.callerAvatar ?? null },
      callType: data.callType,
      callMode: data.callMode
    });
  });

  socket.on('call:accepted', (data: CallAcceptedEvent) => {
    const state = get(activeCallStore);
    if (state.phase === 'outgoing-ringing' && state.callId === data.callId) {
      activeCallStore.setConnecting();
    }
  });

  socket.on('call:rejected', (data: CallRejectedEvent) => {
    const state = get(activeCallStore);
    if (state.phase === 'outgoing-ringing' && state.callId === data.callId) {
      activeCallStore.reset();
    }
  });

  socket.on('call:cancelled', (data: CallCancelledEvent) => {
    const state = get(activeCallStore);
    if (state.phase === 'incoming-ringing' && state.callId === data.callId) {
      activeCallStore.reset();
    }
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
  });
}

export function teardownCallSignaling(): void {
  isInitialized = false;
  disconnectSocket();
}
