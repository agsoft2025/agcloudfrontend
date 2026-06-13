/**
 * ParticipantList — shared TypeScript types
 *
 * ParticipantDisplayRow is derived at render-time from CallParticipantState
 * (call.store.ts) using the same track-resolution logic as VideoTile.svelte.
 * External consumers never need to construct this manually.
 */

import type { NetworkQuality } from './VideoTile.types.ts';

export type { NetworkQuality };

/**
 * The fully resolved display snapshot for a single participant row.
 * Derived from CallParticipantState inside ParticipantList.svelte.
 */
export interface ParticipantDisplayRow {
  /** LiveKit session ID — stable unique key for {#each} blocks. */
  sid: string;
  /** LiveKit identity string (unique per room). */
  identity: string;
  /** Trimmed display name, falling back to identity. */
  displayName: string;
  /** True for the local participant. */
  isLocal: boolean;
  /** Microphone is live (publication exists + not muted). */
  isMicOn: boolean;
  /** Camera is live (publication exists + not muted + track attached). */
  isCameraOn: boolean;
  /** LiveKit active-speaker flag from callStore. */
  isSpeaking: boolean;
  /** Mapped from ConnectionQuality enum; undefined if unknown. */
  networkQuality?: NetworkQuality;
  /**
   * Remote participant with a camera publication that isn't subscribed yet.
   * Dims the row to indicate the connection is still negotiating.
   */
  isConnecting: boolean;
}

/**
 * Optional per-row action callbacks.
 * If all three are undefined, the context-menu button is hidden entirely.
 */
export interface ParticipantRowActions {
  /** Open a profile / detail view for this participant. */
  onViewProfile?: (identity: string) => void;
  /**
   * Request a server-side mute for this participant.
   * Only meaningful for remote participants.
   */
  onMuteParticipant?: (identity: string) => void;
  /**
   * Remove / kick this participant from the room.
   * Only meaningful for remote participants.
   */
  onRemoveParticipant?: (identity: string) => void;
}
