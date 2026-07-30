<!--
  NetworkIndicatorExample — integration with callStore, VideoTile, ParticipantList
  =================================================================================
  Demonstrates three usage patterns:

  1. callStore integration — local participant quality in a call header
  2. Standalone preview — all five states side-by-side
  3. Code patterns for embedding inside VideoTile and ParticipantList

  The NetworkIndicator never touches LiveKit or callStore itself.
  Quality is always derived upstream and passed as a prop.

  callStore flow:
    LiveKit room event (ConnectionQualityChanged)
      → bindCallEvents / useCall.ts calls callStore.syncRoom(room)
        → callStore updates participant.participant.connectionQuality
          → $derived maps ConnectionQuality string → IndicatorQuality
            → <NetworkIndicator quality={...} /> re-renders
-->
<script lang="ts">
  import { callStore } from '$lib/stores/call.store';
  import NetworkIndicator from '$lib/components/atoms/NetworkIndicator.svelte';
  import type { IndicatorQuality } from '$lib/components/atoms/NetworkIndicator.types.ts';

  // ── LiveKit ConnectionQuality → IndicatorQuality mapping ─────
  // Defined inline (not imported from a .ts value export) so this
  // file remains importable without allowImportingTsExtensions.
  // LiveKit's ConnectionQuality enum values are plain strings:
  //   'excellent' | 'good' | 'poor' | 'lost' | 'unknown'
  function mapQuality(q: string | undefined): IndicatorQuality | undefined {
    switch (q) {
      case 'excellent': return 'excellent';
      case 'good':      return 'good';
      case 'poor':      return 'poor';
      case 'lost':      return 'disconnected';
      default:          return undefined;   // 'unknown' or missing
    }
  }

  // ── 1. callStore integration ──────────────────────────────────
  /**
   * Derive local participant quality from callStore.
   * callStore.localParticipant.participant.connectionQuality is a
   * LiveKit ConnectionQuality enum value (string literal).
   */
  const localQuality = $derived<IndicatorQuality | undefined>(
    mapQuality($callStore.localParticipant?.participant.connectionQuality)
  );

  /**
   * Remote participant qualities for a custom network-health list.
   */
  const remoteQualities = $derived(
    $callStore.remoteParticipants.map((p) => ({
      identity: p.identity,
      name:     p.name ?? p.identity,
      quality:  mapQuality(p.participant.connectionQuality),
    }))
  );

  // ── 2. Preview states ─────────────────────────────────────────
  const allStates: Array<{ quality: IndicatorQuality; desc: string }> = [
    { quality: 'excellent',    desc: 'Excellent — 4 bars (green)'  },
    { quality: 'good',         desc: 'Good — 3 bars (blue)'        },
    { quality: 'fair',         desc: 'Fair — 2 bars (amber)'       },
    { quality: 'poor',         desc: 'Poor — 1 bar (red)'          },
    { quality: 'disconnected', desc: 'Disconnected — 0 bars (dim)' },
  ];
</script>

<!-- ── Call header: local participant quality (live) ─────────── -->
<section class="nie-section" aria-labelledby="nie-header-id">
  <h3 id="nie-header-id" class="nie-heading">
    Call header — local quality (live from callStore)
  </h3>
  <div class="nie-header-demo">
    <span class="nie-header-label">Your connection</span>
    <NetworkIndicator quality={localQuality} size="md" showLabel />
  </div>
</section>

<!-- ── All states + sizes preview ───────────────────────────── -->
<section class="nie-section" aria-labelledby="nie-states-id">
  <h3 id="nie-states-id" class="nie-heading">All states × all sizes</h3>
  <div class="nie-states-grid">
    <!-- undefined / loading -->
    <div class="nie-row">
      <span class="nie-row-desc">Loading / unknown</span>
      <div class="nie-sizes">
        <NetworkIndicator size="sm" />
        <NetworkIndicator size="md" />
        <NetworkIndicator size="lg" showLabel />
      </div>
    </div>
    {#each allStates as { quality, desc } (quality)}
      <div class="nie-row">
        <span class="nie-row-desc">{desc}</span>
        <div class="nie-sizes">
          <NetworkIndicator {quality} size="sm" />
          <NetworkIndicator {quality} size="md" />
          <NetworkIndicator {quality} size="lg" showLabel />
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- ── Remote participant qualities (live) ───────────────────── -->
{#if remoteQualities.length > 0}
  <section class="nie-section" aria-labelledby="nie-remote-id">
    <h3 id="nie-remote-id" class="nie-heading">
      Remote participant qualities (live)
    </h3>
    <ul class="nie-remote-list" role="list">
      {#each remoteQualities as { identity, name, quality } (identity)}
        <li class="nie-remote-row">
          <span class="nie-remote-name">{name}</span>
          <NetworkIndicator {quality} size="sm" showLabel />
        </li>
      {/each}
    </ul>
  </section>
{/if}

<!-- See script block comments above for VideoTile / ParticipantList / CallControls integration patterns. -->

<style lang="postcss">
  .nie-section {
    padding: var(--space-lg);
    border-block-end: 1px solid var(--color-border);
  }

  .nie-heading {
    margin: 0 0 var(--space-md);
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Call-header demo pill */
  .nie-header-demo {
    display: inline-flex;
    align-items: center;
    gap: var(--space-md);
    padding: 0.5rem var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
  }

  .nie-header-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  /* State rows */
  .nie-states-grid {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .nie-row {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding: 0.5rem var(--space-md);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
  }

  .nie-row-desc {
    inline-size: 13rem;
    flex-shrink: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .nie-sizes {
    display: flex;
    align-items: center;
    gap: var(--space-xl);
  }

  /* Remote list */
  .nie-remote-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .nie-remote-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem var(--space-md);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
  }

  .nie-remote-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
  }
</style>
