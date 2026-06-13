/**
 * VideoTile — shared TypeScript types
 *
 * NetworkQuality maps to LiveKit's ConnectionQuality enum.
 * Map it at the call-site (CallGrid) before passing to VideoTile:
 *
 *   import { ConnectionQuality } from 'livekit-client';
 *   const nq = mapConnectionQuality(participant.participant.connectionQuality);
 *
 *   export function mapConnectionQuality(q: ConnectionQuality): NetworkQuality | undefined {
 *     switch (q) {
 *       case ConnectionQuality.Excellent: return 'excellent';
 *       case ConnectionQuality.Good:      return 'good';
 *       case ConnectionQuality.Poor:      return 'poor';
 *       default:                          return undefined;
 *     }
 *   }
 */

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Resolved tile state derived from CallParticipantState.
 * VideoTile derives all of these internally — exposed here for
 * consumers that want to pass pre-computed values (e.g. tests).
 */
export interface VideoTileState {
  displayName: string;
  initials: string;
  showVideo: boolean;
  isMuted: boolean;
  isCameraEnabled: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
}
