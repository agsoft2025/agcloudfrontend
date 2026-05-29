<script lang="ts">
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
</script>

<article
  class="tile"
  class:speaking={isActive}
  class:cam-off={!showVideo}
  aria-label="{name}{isActive ? ' — speaking' : ''}"
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

  <!-- Bottom info overlay -->
  <div class="tile-footer">
    <span class="tile-name">{name}{isLocal ? ' (you)' : ''}</span>

    {#if isMuted}
      <span class="mute-badge" aria-label="{name} microphone muted" title="Microphone muted">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    {/if}
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
    /* Maintain 16/9 for tiles but allow flex to override */
    aspect-ratio: 16 / 9;
    transition: border-color 250ms ease;
  }

  .tile.speaking {
    border-color: #34d399;
    box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.25);
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
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.92);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .mute-badge {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.375rem;
    block-size: 1.375rem;
    border-radius: 999px;
    background: rgba(220, 38, 38, 0.82);
    color: #ffffff;
  }

  /* Speaking ring animation */
  .speaking-ring {
    position: absolute;
    inset: -2px;
    border-radius: 13px;
    border: 3px solid transparent;
    background: linear-gradient(#141e2e, #141e2e) padding-box,
                linear-gradient(90deg, #34d399, #059669, #34d399) border-box;
    background-size: 200% 100%;
    animation: speaker-shimmer 1.8s linear infinite;
    pointer-events: none;
  }

  @keyframes speaker-shimmer {
    from { background-position: 0% 0%; }
    to   { background-position: 200% 0%; }
  }
</style>
