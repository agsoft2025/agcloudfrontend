/**
 * NetworkIndicator — shared TypeScript types
 *
 * Extends the existing NetworkQuality type from VideoTile.types.ts with
 * 'disconnected' (maps to LiveKit ConnectionQuality.Lost). 'fair' is a
 * design-system state between 'good' and 'poor' — not present in
 * LiveKit's enum, but useful for UI hierarchy.
 *
 * Runtime utilities (numericToQuality, livekitQualityToIndicator, etc.)
 * are defined inline where needed to keep this file type-only.
 *
 * Numeric → string mapping:
 *   0 -> 'disconnected'
 *   1 -> 'poor'
 *   2 -> 'fair'
 *   3 -> 'good'
 *   4 -> 'excellent'
 */

/** Full set of quality states the NetworkIndicator can render. */
export type IndicatorQuality =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'disconnected';
