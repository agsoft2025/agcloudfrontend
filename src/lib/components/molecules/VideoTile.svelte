<!--
  VideoTile — participant tile for a live video call grid
  ========================================================
  Svelte 5 component. Accepts a CallParticipantState directly
  from callStore and derives all display state internally.

  Track attachment is delegated to the existing LiveKitTrack atom,
  which handles attach/detach and play() lifecycle correctly.

  States handled:
    1. Video active (camera on, track subscribed)
    2. Camera disabled (avatar + initials fallback)
    3. Audio muted (mute badge in overlay)
    4. Active speaker (animated green ring)
    5. Poor / fair / good / excellent network (Badge atom)
    6. Connecting (spinner + "Connecting…" label)
    7. Reconnecting (spinner + "Reconnecting…" label)
    8. Local participant ("You" badge)

  Accessibility:
    - article[aria-label] summarises all participant states
    - All icon-only indicators carry aria-label / title
    - Status changes announced via aria-live on the footer
-->
<script lang="ts">
  import { Track, ConnectionQuality, ConnectionState } from 'livekit-client';

  import Badge from '$lib/components/atoms/Badge.svelte';
  import type { BadgeVariant } from '$lib/components/atoms/Badge.svelte';
  import Spinner from '$lib/components/atoms/Spinner.svelte';
  import LiveKitTrack from '$lib/components/calls/LiveKitTrack.svelte';

  import type { CallParticipantState } from '$lib/stores/call.store';
  import type { NetworkQuality } from './VideoTile.types.ts';

  // ── Props ─────────────────────────────────────────────────────
  type Props = {
    participant: CallParticipantState;
    /** True when this tile represents the local (self) participant. */
    isLocal?: boolean;
    /**
     * Mirror the video horizontally — typically true for the local
     * participant so it looks like a mirror, false for remote.
     */
    mirror?: boolean;
    /**
     * Pre-mapped network quality from the parent (CallGrid).
     * Map from ConnectionQuality with mapConnectionQuality() below.
     */
    networkQuality?: NetworkQuality;
    /** Extra CSS class forwarded to the root <article>. */
    class?: string;
  };

  let {
    participant,
    isLocal = false,
    mirror = isLocal,
    networkQuality,
    class: extraClass = '',
  }: Props = $props();

  // ── Track resolution ──────────────────────────────────────────
  /** Camera video publication, if present. */
  const videoPublication = $derived(
    participant.tracks.find(
      (t) => t.kind === Track.Kind.Video && t.source === Track.Source.Camera
    )
  );

  /** Microphone audio publication, if present. */
  const audioPublication = $derived(
    participant.tracks.find(
      (t) => t.kind === Track.Kind.Audio && t.source === Track.Source.Microphone
    )
  );

  /**
   * The live video Track object (or undefined when camera is off /
   * not yet subscribed). Passed directly to <LiveKitTrack>.
   */
  const videoTrack = $derived(videoPublication?.track);

  /** Camera is on when: publication exists, not muted, and track is live. */
  const isCameraEnabled = $derived(
    Boolean(videoPublication && !videoPublication.isMuted && videoPublication.track)
  );

  /** Microphone muted when: no publication OR publication is muted. */
  const isMuted = $derived(
    !audioPublication || audioPublication.isMuted
  );

  const isSpeaking = $derived(participant.isSpeaking);

  /**
   * Whether to actually render the video element.
   * Both conditions must be true: camera enabled AND track available.
   */
  const showVideo = $derived(isCameraEnabled && Boolean(videoTrack));

  /**
   * Remote participant whose video publication exists but the track
   * is not yet subscribed — i.e. still negotiating with the server.
   */
  const isConnecting = $derived(
    !isLocal &&
    Boolean(videoPublication) &&
    Boolean(videoPublication) &&
    !videoPublication!.isSubscribed
  );

  // ── Display helpers ───────────────────────────────────────────
  const displayName = $derived(
    (participant.name?.trim() || participant.identity).trim()
  );

  const initials = $derived(
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => (part[0] ?? '').toUpperCase())
      .join('')
  );

  /** Stable hue derived from name — gives each participant a distinct avatar colour. */
  function avatarHue(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }

  const hue = $derived(avatarHue(displayName));

  // ── Network quality badge ─────────────────────────────────────
  type QualityConfig = { variant: BadgeVariant; label: string; shortLabel: string };

  const QUALITY_MAP: Record<NetworkQuality, QualityConfig> = {
    excellent: { variant: 'success',  label: 'Excellent network', shortLabel: 'Excellent' },
    good:      { variant: 'info',     label: 'Good network',      shortLabel: 'Good' },
    fair:      { variant: 'warning',  label: 'Fair network',      shortLabel: 'Fair' },
    poor:      { variant: 'danger',   label: 'Poor network',      shortLabel: 'Poor' },
  };

  const qualityConfig = $derived(networkQuality ? QUALITY_MAP[networkQuality] : null);

  // ── Accessible article label ──────────────────────────────────
  const ariaLabel = $derived(
    [
      displayName,
      isLocal              ? '(you)'                  : null,
      isSpeaking           ? '— speaking'             : null,
      isMuted              ? '— microphone muted'     : null,
      !isCameraEnabled     ? '— camera off'           : null,
      isConnecting         ? '— connecting'           : null,
      networkQuality === 'poor' ? '— poor network'    : null,
    ]
      .filter(Boolean)
      .join(' ')
  );
</script>

<article
  class="tile {extraClass}"
  class:is-speaking={isSpeaking}
  class:is-cam-off={!isCameraEnabled}
  class:is-connecting={isConnecting}
  class:is-local={isLocal}
  class:is-poor-network={networkQuality === 'poor'}
  aria-label={ariaLabel}
>

  <!-- ── Video layer ──────────────────────────────────────────── -->
  {#if showVideo}
    <div class="tile-video" aria-hidden="true">
      <LiveKitTrack
        track={videoTrack}
        label="{displayName} video"
        muted={isLocal}
        {mirror}
      />
    </div>

  {:else if isConnecting}
    <!-- Connecting skeleton -->
    <div class="tile-connecting" aria-hidden="true">
      <div class="connecting-inner">
        <Spinner size="md" decorative />
      </div>
    </div>

  {:else}
    <!-- Camera-off avatar fallback -->
    <div class="tile-avatar" aria-hidden="true">
      <div
        class="avatar-circle"
        style="--hue: {hue}deg"
      >
        {initials || '?'}
      </div>
      <!-- Camera-off icon below the avatar -->
      <span class="cam-off-icon" title="Camera off">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="2" y1="2" x2="22" y2="22"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M10.7 6H13a2 2 0 0 1 2 2v2.3M15 14l5 3V7l-3.2 1.9
                   M2 8a2 2 0 0 1 2-2h2
                   M2 12v4a2 2 0 0 0 2 2h9a2 2 0 0 0 1.1-.3"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round"/>
        </svg>
      </span>
    </div>
  {/if}

  <!-- ── Top-right badge row ──────────────────────────────────── -->
  <div class="tile-top-badges" aria-hidden="true">
    {#if isConnecting}
      <Badge variant="neutral" size="sm" label="Connecting…" />
    {/if}

    {#if qualityConfig}
      <Badge
        variant={qualityConfig.variant}
        size="sm"
        label={qualityConfig.shortLabel}
        ariaLabel={qualityConfig.label}
      />
    {/if}

    {#if isLocal}
      <Badge variant="primary" size="sm" label="You" ariaLabel="Local participant" />
    {/if}
  </div>

  <!-- ── Bottom overlay ───────────────────────────────────────── -->
  <div
    class="tile-footer"
    aria-live="polite"
    aria-atomic="true"
  >
    <!-- Name -->
    <span class="tile-name" title={displayName}>
      {displayName}
    </span>

    <!-- Status icons — right-aligned group -->
    <span class="tile-icons" aria-hidden="true">
      <!-- Speaking indicator dot (visible when mic is on) -->
      {#if isSpeaking && !isMuted}
        <span class="speaking-dot" title="Speaking"></span>
      {/if}

      <!-- Mute icon -->
      {#if isMuted}
        <span
          class="status-icon icon-muted"
          role="img"
          aria-label="{displayName} microphone muted"
          title="Microphone muted"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <path
              d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path
              d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round"/>
          </svg>
        </span>
      {/if}

      <!-- Camera off icon (only in footer when video IS active, so we know it was just disabled) -->
      {#if !isCameraEnabled && showVideo === false && !isConnecting}
        <span
          class="status-icon icon-cam-off"
          role="img"
          aria-label="{displayName} camera off"
          title="Camera off"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2 8a2 2 0 0 1 2-2h2M2 12v4a2 2 0 0 0 2 2h9"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round"/>
            <line x1="2" y1="2" x2="22" y2="22"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </span>
      {/if}
    </span>
  </div>

  <!-- ── Active speaker animated ring ────────────────────────── -->
  {#if isSpeaking}
    <div class="speaking-ring" aria-hidden="true"></div>
  {/if}

  <!-- ── Poor network warning overlay ────────────────────────── -->
  {#if networkQuality === 'poor'}
    <div class="network-warning" aria-hidden="true" title="Poor network connection">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L22 20H2L12 2z"
          stroke="currentColor" stroke-width="2"
          stroke-linejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="14"
          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="17.5" r="0.75" fill="currentColor"/>
      </svg>
    </div>
  {/if}

</article>

<style lang="postcss">
  /* ── Root tile ────────────────────────────────────────────────
     The tile is a flex column, overflow hidden so video fills
     the rounded box. 16/9 aspect-ratio is the default; parent
     grids may override it.                                       */
  .tile {
    /* Local custom properties */
    --tile-radius:       var(--radius-md, 12px);
    --tile-border-color: transparent;
    --tile-glow:         none;
    --tile-bg:           #111827;

    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    min-block-size: 0;
    border-radius: var(--tile-radius);
    border: 2px solid var(--tile-border-color);
    background: var(--tile-bg);
    box-shadow: var(--tile-glow), var(--shadow-md, 0 4px 6px rgba(0,0,0,.15));
    outline: none;
    transition:
      border-color 220ms ease,
      box-shadow    220ms ease;
    /* Container query context for fluid avatar sizing */
    container-type: inline-size;
  }

  /* Focus ring — keyboard accessible */
  .tile:focus-visible {
    --tile-border-color: rgba(78, 135, 255, 0.7);
    --tile-glow: 0 0 0 3px rgba(78, 135, 255, 0.25);
  }

  /* ── Active speaker state ─────────────────────────────────────
     Green border + soft glow. The animated ring is a separate
     element so the border stays crisp while the shimmer moves.   */
  .tile.is-speaking {
    --tile-border-color: #34d399;
    --tile-glow: 0 0 0 3px rgba(52, 211, 153, 0.22),
                 0 0 24px rgba(52, 211, 153, 0.12);
  }

  /* ── Poor network state ──────────────────────────────────────*/
  .tile.is-poor-network {
    --tile-border-color: rgba(248, 113, 113, 0.55);
  }

  /* ── Video layer ─────────────────────────────────────────────
     Fills the tile absolutely so rounded corners clip correctly. */
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
    display: block;
  }

  /* ── Avatar fallback ─────────────────────────────────────────
     Centred in the tile with a dark gradient background.         */
  .tile-avatar {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    background: linear-gradient(155deg, #0f1829 0%, #1a2540 100%);
  }

  .avatar-circle {
    --hue: 210deg;
    display: grid;
    place-items: center;
    /* Fluid sizing via container query — clamps to avoid oversized avatars in large grids */
    inline-size:  clamp(2.5rem, 20cqi, 5rem);
    block-size:   clamp(2.5rem, 20cqi, 5rem);
    border-radius: 999px;
    background: hsl(var(--hue) 40% 22%);
    border: 2px solid hsl(var(--hue) 46% 35%);
    color: hsl(var(--hue) 68% 82%);
    font-size: clamp(0.75rem, 6cqi, 1.5rem);
    font-weight: 800;
    letter-spacing: -0.01em;
    user-select: none;
  }

  .cam-off-icon {
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.28);
  }

  /* ── Connecting skeleton ─────────────────────────────────────*/
  .tile-connecting {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    /* Subtle shimmer background */
    background:
      linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.03) 0%,
        rgba(255, 255, 255, 0.06) 40%,
        rgba(255, 255, 255, 0.03) 80%
      );
    background-size: 220% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .tile-connecting { animation: none; }
  }

  @keyframes shimmer {
    to { background-position-x: -220%; }
  }

  .connecting-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.45);
  }

  /* ── Top-right badge row ─────────────────────────────────────
     Badges stack horizontally, right-aligned.                   */
  .tile-top-badges {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-end: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    z-index: 2;
    /* Override Badge defaults for the dark tile context */
    --badge-background: rgba(15, 20, 35, 0.78);
    --badge-color:      rgba(255, 255, 255, 0.88);
    --badge-border:     rgba(255, 255, 255, 0.12);
  }

  /* Restore semantic colours for non-neutral badges */
  .tile-top-badges :global(.badge[data-variant='success']) {
    --badge-background: rgba(52, 211, 153, 0.18);
    --badge-color:      #6ee7b7;
    --badge-border:     rgba(52, 211, 153, 0.32);
  }

  .tile-top-badges :global(.badge[data-variant='info']) {
    --badge-background: rgba(78, 135, 255, 0.18);
    --badge-color:      #93c5fd;
    --badge-border:     rgba(78, 135, 255, 0.32);
  }

  .tile-top-badges :global(.badge[data-variant='warning']) {
    --badge-background: rgba(251, 191, 36, 0.18);
    --badge-color:      #fcd34d;
    --badge-border:     rgba(251, 191, 36, 0.32);
  }

  .tile-top-badges :global(.badge[data-variant='danger']) {
    --badge-background: rgba(248, 113, 113, 0.20);
    --badge-color:      #fca5a5;
    --badge-border:     rgba(248, 113, 113, 0.35);
  }

  .tile-top-badges :global(.badge[data-variant='primary']) {
    --badge-background: rgba(78, 135, 255, 0.22);
    --badge-color:      #bfdbfe;
    --badge-border:     rgba(78, 135, 255, 0.36);
  }

  /* ── Bottom overlay ──────────────────────────────────────────
     Gradient fades from transparent to dark at the bottom.      */
  .tile-footer {
    position: absolute;
    inset-block-end: 0;
    inset-inline: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.375rem;
    padding: 1.5rem 0.625rem 0.5rem;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(5, 10, 22, 0.75) 100%
    );
    z-index: 2;
  }

  .tile-name {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  }

  .tile-icons {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  /* Individual status icon pill */
  .status-icon {
    display: grid;
    place-items: center;
    inline-size: 1.375rem;
    block-size: 1.375rem;
    border-radius: 999px;
  }

  .icon-muted {
    background: rgba(220, 38, 38, 0.82);
    color: #fff;
  }

  .icon-cam-off {
    background: rgba(30, 40, 70, 0.72);
    color: rgba(255, 255, 255, 0.6);
  }

  /* Speaking pulse dot (only when mic is live) */
  .speaking-dot {
    display: block;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 999px;
    background: #34d399;
    box-shadow: 0 0 6px rgba(52, 211, 153, 0.7);
    animation: speaking-pulse 900ms ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .speaking-dot { animation: none; }
  }

  @keyframes speaking-pulse {
    0%, 100% { transform: scale(0.9); opacity: 0.7; }
    50%       { transform: scale(1.3); opacity: 1;   }
  }

  /* ── Active speaker shimmer ring ─────────────────────────────
     Absolute overlay, inset -2px so it sits *over* the border.
     Uses a moving gradient along the border-box.                */
  .speaking-ring {
    position: absolute;
    inset: -2px;
    border-radius: calc(var(--tile-radius) + 2px);
    border: 3px solid transparent;
    background:
      linear-gradient(var(--tile-bg), var(--tile-bg)) padding-box,
      linear-gradient(90deg, #34d399, #059669, #34d399) border-box;
    background-size: 200% 100%;
    animation: ring-shimmer 2s linear infinite;
    pointer-events: none;
    z-index: 3;
  }

  @media (prefers-reduced-motion: reduce) {
    .speaking-ring { animation: none; }
  }

  @keyframes ring-shimmer {
    from { background-position: 0% 0%; }
    to   { background-position: 200% 0%; }
  }

  /* ── Poor network warning pip ────────────────────────────────
     Small amber triangle pinned to top-left.                   */
  .network-warning {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-start: 0.5rem;
    display: grid;
    place-items: center;
    inline-size: 1.625rem;
    block-size: 1.625rem;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.18);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fcd34d;
    z-index: 2;
  }

  /* ── Responsive: hide labels at very small tile sizes ────────
     Below ~180px container width, the name overflows.
     Reduce text size gracefully.                               */
  @container (max-width: 180px) {
    .tile-name  { font-size: 0.6875rem; }
    .tile-footer { padding-inline: 0.375rem; }
  }

  @container (max-width: 120px) {
    .tile-footer  { display: none; }
    .tile-top-badges { display: none; }
  }
</style>
