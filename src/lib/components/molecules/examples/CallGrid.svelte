<!--
  CallGrid — example integration of VideoTile with callStore
  ===========================================================
  Svelte 5 component. Drop this in place of the participants-grid
  section inside CallSession.svelte to migrate to VideoTile.

  Usage:
    <CallGrid />

  How it works:
    1. Subscribes to $callStore (populated by bindCallEvents / useCall.ts)
    2. Derives one tile per participant (local + remote)
    3. Maps LiveKit ConnectionQuality → VideoTile's NetworkQuality prop
    4. Computes grid column count from participant count
-->
<script lang="ts">
  import { ConnectionQuality } from 'livekit-client';
  import { callStore } from '$lib/stores/call.store';
  import VideoTile from '../VideoTile.svelte';
  import type { NetworkQuality } from '../VideoTile.types.ts';

  // ── NetworkQuality mapping ───────────────────────────────────
  /**
   * Map LiveKit's ConnectionQuality enum to our VideoTile prop.
   * Returns undefined for Unknown so no badge is rendered.
   */
  function mapConnectionQuality(q: ConnectionQuality): NetworkQuality | undefined {
    switch (q) {
      case ConnectionQuality.Excellent: return 'excellent';
      case ConnectionQuality.Good:      return 'good';
      case ConnectionQuality.Poor:      return 'poor';
      default:                          return undefined;
    }
  }

  // ── Derived state from callStore ─────────────────────────────
  const local = $derived($callStore.localParticipant);

  const remotes = $derived($callStore.remoteParticipants);

  /** Total tiles = 1 local + N remote */
  const totalTiles = $derived(1 + remotes.length);

  /**
   * Grid column count:
   *   1  participant → 1 column
   *   2–4            → 2 columns
   *   5–9            → 3 columns
   *   10+            → 4 columns
   */
  const gridCols = $derived(
    totalTiles <= 1 ? 1 :
    totalTiles <= 4 ? 2 :
    totalTiles <= 9 ? 3 : 4
  );
</script>

<div
  class="call-grid"
  style="--cols: {gridCols}"
  aria-label="{totalTiles} participant{totalTiles !== 1 ? 's' : ''} in call"
>
  <!-- Local tile (always first) -->
  {#if local}
    <VideoTile
      participant={local}
      isLocal={true}
      mirror={true}
      networkQuality={mapConnectionQuality(local.participant.connectionQuality)}
    />
  {/if}

  <!-- Remote tiles -->
  {#each remotes as remote (remote.sid || remote.identity)}
    <VideoTile
      participant={remote}
      isLocal={false}
      mirror={false}
      networkQuality={mapConnectionQuality(remote.participant.connectionQuality)}
    />
  {/each}
</div>

<style lang="postcss">
  .call-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr));
    gap: 0.5rem;
    inline-size: 100%;
    block-size: 100%;
    align-content: center;
    /* Single participant: cap width so it doesn't stretch edge-to-edge */
    &:has(> :only-child) {
      max-inline-size: min(100%, 72rem);
      margin-inline: auto;
    }
  }

  /* 2-column wraps earlier on narrow screens */
  @media (max-width: 640px) {
    .call-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (min-width: 641px) and (max-width: 1024px) {
    .call-grid[style*='--cols: 3'],
    .call-grid[style*='--cols: 4'] {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }
</style>
