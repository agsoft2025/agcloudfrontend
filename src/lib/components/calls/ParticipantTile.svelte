<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import LiveKitTrack from './LiveKitTrack.svelte';
  import type { Track } from 'livekit-client';

  export let track: Track | undefined = undefined;
  export let name: string;
  export let label: string;
  export let isActive = false;   // speaking / active speaker
  export let isMuted = false;    // microphone muted
  export let isCameraOff = false;
  export let mirror = false;
  export let isLocal = false;
  export let isPinned = false;
  export let isHandRaised = false;
  export let networkQuality: 'excellent' | 'good' | 'poor' | undefined = undefined;
  export let isScreenShare = false;

  const dispatch = createEventDispatcher<{ togglePin: void }>();

  function getInitials(n: string): string {
    return n
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  // Pick a stable hue from the name string for the avatar color
  function getAvatarHue(n: string): number {
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }

  $: initials = getInitials(name);
  $: avatarHue = getAvatarHue(name);
  $: showVideo = !!track && !isCameraOff;

  const NETWORK_LABEL: Record<string, string> = {
    excellent: 'Excellent connection',
    good: 'Good connection',
    poor: 'Poor connection'
  };
</script>

<article
  class="tile"
  class:speaking={isActive}
  class:cam-off={!showVideo}
  class:pinned={isPinned}
  class:screen-share={isScreenShare}
  aria-label="{name}{isActive ? ' — speaking' : ''}{isPinned ? ' — pinned' : ''}"
>
  <!-- Video -->
  {#if showVideo}
    <div class="tile-video">
      <LiveKitTrack {track} {label} muted={isLocal} {mirror} />
    </div>
  {:else}
    <!-- Avatar fallback -->
    <div class="tile-avatar">
      <div
        class="avatar-circle"
        style="--hue: {avatarHue}deg"
        aria-hidden="true"
      >
        {initials}
      </div>
    </div>
  {/if}

  <!-- Pin / unpin button -->
  <button
    type="button"
    class="pin-btn"
    class:is-pinned={isPinned}
    aria-pressed={isPinned}
    aria-label={isPinned ? `Unpin ${name}` : `Pin ${name}`}
    title={isPinned ? 'Unpin' : 'Pin'}
    on:click|stopPropagation={() => dispatch('togglePin')}
  >
    {#if isPinned}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16 3l5 5-4 4 1 5-4-4-5 5-1-1 5-5-4-4 5-1 4-4z"/>
      </svg>
    {:else}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M16 3l5 5-4 4 1 5-4-4-5 5-1-1 5-5-4-4 5-1 4-4z"
          stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>
      </svg>
    {/if}
  </button>

  <!-- Top-left status badges -->
  <div class="tile-top-badges" aria-hidden="true">
    {#if isHandRaised}
      <span class="badge-pill badge-hand" title="Hand raised">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 11.5V4.5a1.5 1.5 0 013 0v6M12 10.5V3a1.5 1.5 0 013 0v7.5M15 10.5V5a1.5 1.5 0 013 0v9a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L4 13.8a1.4 1.4 0 012.3-1.6L8 14"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    {/if}

    {#if networkQuality === 'poor'}
      <span class="badge-pill badge-network badge-network-poor" title={NETWORK_LABEL.poor}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 20h2v-4H2v4zm5 0h2v-8H7v8zm5 0h2v-12h-2v12zm5 0h2V4h-2v16z" fill="currentColor" opacity="0.35"/>
          <path d="M2 20h2v-4H2v4z" fill="currentColor"/>
        </svg>
      </span>
    {/if}
  </div>

  <!-- Bottom info overlay -->
  <div class="tile-footer">
    <span class="tile-name">{name}{isLocal ? ' (you)' : ''}</span>

    <span class="tile-icons">
      {#if networkQuality && networkQuality !== 'poor'}
        <span class="status-icon icon-network" title={NETWORK_LABEL[networkQuality]} aria-label={NETWORK_LABEL[networkQuality]}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 20h2v-4H2v4zm5 0h2v-8H7v8zm5 0h2v-12h-2v12zm5 0h2V4h-2v16z" fill="currentColor"
              opacity={networkQuality === 'excellent' ? '1' : '0.6'}/>
          </svg>
        </span>
      {/if}

      {#if isCameraOff}
        <span class="status-icon icon-cam-off" aria-label="{name} camera off" title="Camera off">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 8a2 2 0 012-2h2M2 12v4a2 2 0 002 2h9"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </span>
      {/if}

      {#if isMuted}
        <span class="status-icon icon-muted" aria-label="{name} microphone muted" title="Microphone muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      {/if}
    </span>
  </div>

  <!-- Active speaker ring overlay -->
  {#if isActive}
    <div class="speaking-ring" aria-hidden="true"></div>
  {/if}
</article>

<style lang="postcss">
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 12px;
    background: #141e2e;
    border: 2px solid transparent;
    min-block-size: 0;
    /* No hard-coded aspect-ratio here — parent containers (thumbnail-item or
       grid-item) set the dimensions; tiles always fill their allocated space. */
    transition: transform 250ms ease;
    container-type: inline-size;
  }

  /* .tile.speaking intentionally has NO border-color or box-shadow change.
     border-color is non-compositable: it triggers paint on .tile which has
     overflow:hidden + border-radius (a clip render surface). Chrome must then
     re-composite the entire clip context — including the <video> GPU layer —
     causing a brief compositor desync visible as a blink. The .speaking-ring
     overlay (will-change: opacity) provides the visual indicator at zero paint cost. */

  .tile.pinned {
    border-color: rgba(78, 135, 255, 0.55);
  }

  .tile.screen-share {
    background: #0c1320;
  }

  /* Video layer */
  .tile-video {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
  }

  .tile-video :global(video) {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .tile.screen-share .tile-video :global(video) {
    object-fit: contain;
    background: #000;
  }

  /* Avatar fallback */
  .tile-avatar {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #0f1829 0%, #1a2540 100%);
  }

  .avatar-circle {
    --hue: 210deg;
    display: grid;
    place-items: center;
    inline-size: clamp(3rem, 18cqw, 5rem);
    block-size: clamp(3rem, 18cqw, 5rem);
    border-radius: 999px;
    background: hsl(var(--hue) 45% 28%);
    border: 2px solid hsl(var(--hue) 50% 40%);
    color: hsl(var(--hue) 70% 85%);
    font-size: clamp(0.875rem, 6cqw, 1.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    user-select: none;
  }

  /* Pin / unpin button */
  .pin-btn {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-end: 0.5rem;
    z-index: 3;
    display: grid;
    place-items: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: none;
    border-radius: 999px;
    background: rgba(10, 15, 26, 0.55);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 160ms ease, transform 160ms ease, background-color 160ms ease, color 160ms ease;
  }

  .tile:hover .pin-btn,
  .tile:focus-within .pin-btn,
  .pin-btn.is-pinned {
    opacity: 1;
    transform: scale(1);
  }

  .pin-btn:hover {
    background: rgba(10, 15, 26, 0.85);
    color: #fff;
  }

  .pin-btn.is-pinned {
    background: rgba(78, 135, 255, 0.35);
    color: #bfdbfe;
  }

  /* Top-left status badges */
  .tile-top-badges {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-start: 0.5rem;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .badge-pill {
    display: grid;
    place-items: center;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border-radius: 999px;
    background: rgba(10, 15, 26, 0.6);
    color: #fff;
  }

  .badge-hand {
    color: #fcd34d;
    animation: hand-wave 1.6s ease-in-out infinite;
  }

  @keyframes hand-wave {
    0%, 100% { transform: rotate(0deg); }
    25%       { transform: rotate(-12deg); }
    75%       { transform: rotate(12deg); }
  }

  .badge-network-poor {
    color: #fca5a5;
    background: rgba(220, 38, 38, 0.18);
  }

  /* Bottom overlay */
  .tile-footer {
    position: absolute;
    inset-block-end: 0;
    inset-inline: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.375rem;
    padding: 1.5rem 0.625rem 0.5rem;
    background: linear-gradient(transparent, rgba(5, 10, 20, 0.82));
    z-index: 1;
  }

  .tile-name {
    flex: 1;
    min-inline-size: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.92);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .tile-icons {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .status-icon {
    display: grid;
    place-items: center;
    inline-size: 1.375rem;
    block-size: 1.375rem;
    border-radius: 999px;
  }

  .icon-muted {
    background: rgba(220, 38, 38, 0.82);
    color: #ffffff;
  }

  .icon-cam-off {
    background: rgba(30, 40, 70, 0.72);
    color: rgba(255, 255, 255, 0.6);
  }

  .icon-network {
    color: rgba(255, 255, 255, 0.6);
  }

  /* Speaking ring animation — will-change:opacity pre-allocates a compositor
     layer so the shimmer opacity pulse never triggers a paint on the parent. */
  .speaking-ring {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    border: 3px solid #34d399;
    animation: speaker-shimmer 1.8s linear infinite;
    box-shadow:
      inset 0 0 0 1px rgba(52, 211, 153, 0.32),
      0 0 18px rgba(52, 211, 153, 0.18);
    pointer-events: none;
    z-index: 3;
    will-change: opacity;
  }

  @keyframes speaker-shimmer {
    0%, 100% { opacity: 0.78; }
    50%      { opacity: 1; }
  }

  /* Hide labels at very small tile sizes */
  @container (max-width: 140px) {
    .tile-name { font-size: 0.6875rem; }
    .pin-btn { inline-size: 1.5rem; block-size: 1.5rem; }
  }

  @container (max-width: 100px) {
    .tile-footer { padding-inline: 0.375rem; }
    .tile-icons { display: none; }
  }
</style>
