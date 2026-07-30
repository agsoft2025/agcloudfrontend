/**
 * IncomingCallOverlay — shared TypeScript types
 */

import type { CallType } from '$lib/api/calls.api';

/**
 * The minimal caller snapshot the overlay needs to render.
 * In production, populate this from a push notification payload,
 * a WebSocket event, or a polling call status endpoint.
 */
export interface IncomingCallData {
  /** Opaque call ID passed to acceptCall() / rejectCall() API. */
  callId: string;
  /** Unique user identity of the caller. */
  callerId: string;
  /** Display name shown prominently on the overlay. */
  callerName: string;
  /** Optional avatar URL — falls back to initials via Avatar atom. */
  callerAvatar?: string;
  /** 'audio' | 'video' — controls the subtitle label. */
  callType?: CallType;
  /** Optional room name shown as supporting info. */
  roomName?: string;
}

/**
 * Action callbacks the parent must supply.
 * The component never calls LiveKit or the API directly.
 */
export interface IncomingCallActions {
  /** Called when the user clicks Accept. Must resolve after signaling is complete. */
  onAccept: () => void | Promise<void>;
  /** Called when the user clicks Reject (or presses Escape). */
  onReject: () => void | Promise<void>;
}
