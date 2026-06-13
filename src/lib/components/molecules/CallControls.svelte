<!--
  CallControls — primary in-call control toolbar
  ================================================
  Svelte 5 component. Reads all media state from callStore (populated by
  useCall.ts / bindCallEvents). Receives action callbacks as props so the
  component stays decoupled from the LiveKit transport layer.

  Button atom integration:
    Every control uses the existing Button atom. Variants per design spec:
      Mic      ghost   (active) / secondary (muted)
      Camera   ghost   (active) / secondary (off)
      Share    primary (sharing) / ghost    (inactive)
      End      danger  (always)
      People   ghost   (inactive) / secondary (panel open)
      Chat     ghost   (inactive) / secondary (panel open)

  ARIA strategy:
    Button.svelte does not expose aria-pressed. We instead use descriptive
    ariaLabel props that change with state ("Mute microphone" ↔ "Unmute
    microphone"). This pattern is used by Google Meet, Zoom, and is
    fully compliant with WCAG 2.1 SC 4.1.2.

  State management:
    ┌───────────────────────────────────────────────────────┐
    │  callStore  →  CallParticipantState.tracks            │
    │    Track.Kind.Audio + Source.Microphone → isMicOn    │
    │    Track.Kind.Video + Source.Camera     → isCamOn    │
    │    Track.Kind.Video + Source.ScreenShare→ isSharing  │
    │    ConnectionState                      → isConnected │
    └───────────────────────────────────────────────────────┘
    Each toggle has an independent loading flag managed by $state so
    simultaneous actions (e.g. mute while camera is toggling) work correctly.
-->
<script lang="ts">
  import { Track, ConnectionState } from 'livekit-client';
  import Button from '$lib/components/atoms/Button.svelte';
  import Spinner from '$lib/components/atoms/Spinner.svelte';
  import { callStore } from '$lib/stores/call.store';
  import type { CallControlsActions, CallControlError } from './CallControls.types.ts';

  // ── Props ─────────────────────────────────────────────────────
  type Props = CallControlsActions & {
    /**
     * Show the screen share button.
     * Pass onToggleScreenShare to activate; button stays hidden otherwise.
     */
    allowScreenShare?: boolean;
    /** Whether the participants panel is currently open — tints the button. */
    participantsOpen?: boolean;
    /** Whether the chat panel is currently open — tints the button. */
    chatOpen?: boolean;
    /**
     * Callback for action errors so the parent can display them.
     * If omitted, errors are only logged to console.
     */
    onError?: (err: CallControlError) => void;
    /** Extra CSS class forwarded to the root element. */
    class?: string;
  };

  let {
    onToggleMic,
    onToggleCamera,
    onToggleScreenShare,
    onEndCall,
    onToggleParticipants,
    onToggleChat,
    allowScreenShare = Boolean(onToggleScreenShare),
    participantsOpen = false,
    chatOpen = false,
    onError,
    class: extraClass = '',
  }: Props = $props();

  // ── Per-button loading state ──────────────────────────────────
  // Independent flags: one slow operation can't block the others.
  let isMicToggling          = $state(false);
  let isCameraToggling       = $state(false);
  let isScreenShareToggling  = $state(false);
  let isEndingCall           = $state(false);

  // ── Derived state from callStore ──────────────────────────────
  const connectionState = $derived($callStore.connectionState);
  const isConnected     = $derived(connectionState === ConnectionState.Connected);
  const isReconnecting  = $derived(connectionState === ConnectionState.Reconnecting);
  const isDisconnected  = $derived(
    connectionState === ConnectionState.Disconnected
  );

  const localTracks = $derived($callStore.localParticipant?.tracks ?? []);

  // ── Media state ───────────────────────────────────────────────
  const micPublication = $derived(
    localTracks.find(
      (t) => t.kind === Track.Kind.Audio && t.source === Track.Source.Microphone
    )
  );

  const cameraPublication = $derived(
    localTracks.find(
      (t) => t.kind === Track.Kind.Video && t.source === Track.Source.Camera
    )
  );

  const screenSharePublication = $derived(
    localTracks.find(
      (t) => t.kind === Track.Kind.Video && t.source === Track.Source.ScreenShare
    )
  );

  /**
   * Microphone is considered "on" when:
   *   - a microphone publication exists AND
   *   - the publication is not muted
   */
  const isMicOn = $derived(
    Boolean(micPublication && !micPublication.isMuted)
  );

  /**
   * Camera is considered "on" when:
   *   - a camera publication exists AND
   *   - the publication is not muted AND
   *   - a live track object exists (not yet subscribed = undefined)
   */
  const isCameraOn = $derived(
    Boolean(cameraPublication && !cameraPublication.isMuted && cameraPublication.track)
  );

  /**
   * Screen share is active when:
   *   - a screen-share publication exists AND
   *   - the publication is not muted AND
   *   - a live track object exists
   */
  const isScreenSharing = $derived(
    Boolean(
      screenSharePublication &&
      !screenSharePublication.isMuted &&
      screenSharePublication.track
    )
  );

  // ── Button variant derivations (per design spec) ──────────────
  // Mic:   ghost   = active (unmuted)   | secondary = muted
  // Camera: ghost  = active (on)        | secondary = off
  // Share:  primary = sharing           | ghost     = not sharing
  // End:    danger  (always)
  const micVariant     = $derived(isMicOn     ? 'ghost'   : 'secondary');
  const cameraVariant  = $derived(isCameraOn  ? 'ghost'   : 'secondary');
  const shareVariant   = $derived(isScreenSharing ? 'primary' : 'ghost');
  const peopleVariant  = $derived(participantsOpen ? 'secondary' : 'ghost');
  const chatVariant    = $derived(chatOpen ? 'secondary' : 'ghost');

  // ── ARIA label derivations ────────────────────────────────────
  const micLabel        = $derived(isMicOn       ? 'Mute microphone'       : 'Unmute microphone');
  const cameraLabel     = $derived(isCameraOn    ? 'Turn camera off'       : 'Turn camera on');
  const shareLabel      = $derived(isScreenSharing ? 'Stop sharing screen' : 'Share screen');
  const peopleLabel     = $derived(participantsOpen ? 'Close participants'  : 'Open participants');
  const chatPanelLabel  = $derived(chatOpen        ? 'Close chat'           : 'Open chat');

  // ── Action handlers ───────────────────────────────────────────
  async function handleToggleMic() {
    if (isMicToggling || !isConnected) return;
    isMicToggling = true;
    try {
      await onToggleMic();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to toggle microphone.';
      console.error('[CallControls] mic toggle failed:', err);
      onError?.({ action: 'mic', message });
    } finally {
      isMicToggling = false;
    }
  }

  async function handleToggleCamera() {
    if (isCameraToggling || !isConnected) return;
    isCameraToggling = true;
    try {
      await onToggleCamera();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to toggle camera.';
      console.error('[CallControls] camera toggle failed:', err);
      onError?.({ action: 'camera', message });
    } finally {
      isCameraToggling = false;
    }
  }

  async function handleToggleScreenShare() {
    if (isScreenShareToggling || !isConnected || !onToggleScreenShare) return;
    isScreenShareToggling = true;
    try {
      await onToggleScreenShare();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to toggle screen share.';
      console.error('[CallControls] screen share toggle failed:', err);
      onError?.({ action: 'screen-share', message });
    } finally {
      isScreenShareToggling = false;
    }
  }

  async function handleEndCall() {
    if (isEndingCall) return;
    isEndingCall = true;
    try {
      await onEndCall();
    } catch (err) {
      console.error('[CallControls] end call failed:', err);
      onError?.({ action: 'end-call', message: err instanceof Error ? err.message : 'Unable to end call.' });
    } finally {
      isEndingCall = false;
    }
  }

  // ── Connection state label ────────────────────────────────────
  const connectionLabel = $derived(
    isReconnecting  ? 'Reconnecting…'  :
    isDisconnected  ? 'Disconnected'   :
    'Connected'
  );
</script>

<!-- ── Root wrapper ─────────────────────────────────────────────
     Provides the stacking context for the reconnecting banner
     and the toolbar. Parent positions this (fixed / absolute).   -->
<div class="cc-root {extraClass}">

  <!-- ── Reconnecting / disconnected banner ─────────────────── -->
  {#if isReconnecting || isDisconnected}
    <div
      class="cc-status-banner"
      class:is-reconnecting={isReconnecting}
      class:is-disconnected={isDisconnected}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {#if isReconnecting}
        <Spinner size="sm" decorative />
      {:else}
        <!-- Disconnected warning dot -->
        <span class="cc-status-dot" aria-hidden="true"></span>
      {/if}
      <span>{connectionLabel}</span>
    </div>
  {/if}

  <!-- ── Glass toolbar ─────────────────────────────────────────
       role="toolbar" groups the controls for AT.
       aria-label names the group.                               -->
  <div
    class="cc-toolbar"
    role="toolbar"
    aria-label="Call controls"
    aria-disabled={!isConnected && !isEndingCall}
  >

    <!-- ── Left group: mic + camera ──────────────────────────── -->
    <div class="cc-group" role="group" aria-label="Media controls">

      <!-- Microphone toggle -->
      <div
        class="cc-btn-wrap"
        class:is-off={!isMicOn}
        title={micLabel}
      >
        <Button
          variant={micVariant}
          size="md"
          loading={isMicToggling}
          disabled={!isConnected || isMicToggling}
          ariaLabel={micLabel}
          on:click={handleToggleMic}
        >
          <span class="cc-btn-content">
            {#if isMicOn}
              <!-- Mic on -->
              <svg class="cc-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
                <path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
              </svg>
            {:else}
              <!-- Mic muted / slashed -->
              <svg class="cc-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <line x1="1" y1="1" x2="23" y2="23"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v3M8 22h8"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
              </svg>
            {/if}
            <span class="cc-btn-label">{isMicOn ? 'Mute' : 'Unmute'}</span>
          </span>
        </Button>
      </div>

      <!-- Camera toggle -->
      <div
        class="cc-btn-wrap"
        class:is-off={!isCameraOn}
        title={cameraLabel}
      >
        <Button
          variant={cameraVariant}
          size="md"
          loading={isCameraToggling}
          disabled={!isConnected || isCameraToggling}
          ariaLabel={cameraLabel}
          on:click={handleToggleCamera}
        >
          <span class="cc-btn-content">
            {#if isCameraOn}
              <!-- Camera on -->
              <svg class="cc-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 10l5-3v10l-5-3"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
                <rect x="2" y="6" width="11" height="12" rx="2"
                  stroke="currentColor" stroke-width="1.75"/>
              </svg>
            {:else}
              <!-- Camera off / slashed -->
              <svg class="cc-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <line x1="2" y1="2" x2="22" y2="22"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M10.7 6H13a2 2 0 0 1 2 2v2.3M15 14l5 3V7l-3.2 1.9
                         M2 8a2 2 0 0 1 2-2h2M2 12v4a2 2 0 0 0 2 2h9
                         a2 2 0 0 0 1.1-.3"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
              </svg>
            {/if}
            <span class="cc-btn-label">{isCameraOn ? 'Cam off' : 'Cam on'}</span>
          </span>
        </Button>
      </div>
    </div>

    <!-- ── Centre divider ─────────────────────────────────────── -->
    <div class="cc-divider" aria-hidden="true"></div>

    <!-- ── Optional controls ─────────────────────────────────── -->
    <div class="cc-group cc-group--optional" role="group" aria-label="Optional controls">

      <!-- Screen share (shown only when enabled) -->
      {#if allowScreenShare && onToggleScreenShare}
        <div title={shareLabel}>
          <Button
            variant={shareVariant}
            size="md"
            loading={isScreenShareToggling}
            disabled={!isConnected || isScreenShareToggling}
            ariaLabel={shareLabel}
            on:click={handleToggleScreenShare}
          >
            <span class="cc-btn-content">
              <svg class="cc-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2" y="4" width="20" height="14" rx="2"
                  stroke="currentColor" stroke-width="1.75"/>
                <path d="M8 21h8M12 18v3"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                <path d="M10 11l2-2 2 2M12 9v5"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
                {#if isScreenSharing}
                  <!-- Active indicator dot inside icon -->
                  <circle cx="19" cy="5" r="2.5" fill="var(--color-success, #16a34a)"/>
                {/if}
              </svg>
              <span class="cc-btn-label">{isScreenSharing ? 'Sharing' : 'Share'}</span>
            </span>
          </Button>
        </div>
      {/if}

      <!-- Participants panel -->
      {#if onToggleParticipants}
        <div title={peopleLabel}>
          <Button
            variant={peopleVariant}
            size="md"
            ariaLabel={peopleLabel}
            on:click={onToggleParticipants}
          >
            <span class="cc-btn-content">
              <svg class="cc-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
                <circle cx="9" cy="7" r="4"
                  stroke="currentColor" stroke-width="1.75"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
              </svg>
              <span class="cc-btn-label">People</span>
            </span>
          </Button>
        </div>
      {/if}

      <!-- Chat panel -->
      {#if onToggleChat}
        <div title={chatPanelLabel}>
          <Button
            variant={chatVariant}
            size="md"
            ariaLabel={chatPanelLabel}
            on:click={onToggleChat}
          >
            <span class="cc-btn-content">
              <svg class="cc-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                  stroke-linejoin="round"/>
              </svg>
              <span class="cc-btn-label">Chat</span>
            </span>
          </Button>
        </div>
      {/if}
    </div>

    <!-- ── Centre divider ─────────────────────────────────────── -->
    <div class="cc-divider" aria-hidden="true"></div>

    <!-- ── End call ───────────────────────────────────────────── -->
    <div class="cc-end-wrap" title="End call">
      <Button
        variant="danger"
        size="md"
        loading={isEndingCall}
        disabled={isEndingCall}
        ariaLabel="End call"
        on:click={handleEndCall}
      >
        <span class="cc-btn-content cc-end-content">
          <!-- Phone hang-up icon (rotated phone) -->
          <svg class="cc-icon cc-icon--end" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1
                 A19.4 19.4 0 0 1 3.1 10.8 19.8 19.8 0 0 1 .1 2.2
                 A2 2 0 0 1 2.1 0h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9
                 a2 2 0 0 1-.5 2.1L6.1 7.9a16 16 0 0 0 6 6l1.2-1.3
                 a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0 1 22 14.9z"
              stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"
            />
          </svg>
          <span class="cc-btn-label cc-end-label">End</span>
        </span>
      </Button>
    </div>

  </div><!-- /.cc-toolbar -->
</div><!-- /.cc-root -->

<style lang="postcss">
  /* ── Root wrapper ─────────────────────────────────────────────
     Stacking context; sizing/positioning handled by parent.     */
  .cc-root {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  /* ═══════════════════════════════════════════════════════════
     STATUS BANNER (reconnecting / disconnected)
     ═══════════════════════════════════════════════════════════ */
  .cc-status-banner {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.875rem;
    border-radius: var(--radius-full, 9999px);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    backdrop-filter: blur(12px);
    animation: cc-fade-in var(--duration-base, 180ms) ease both;
  }

  .cc-status-banner.is-reconnecting {
    background: color-mix(in srgb, var(--badge-warning-bg, #fef0c7) 80%, transparent);
    border: 1px solid var(--badge-warning-border, #fedf89);
    color: var(--badge-warning-color, #b54708);
  }

  .cc-status-banner.is-disconnected {
    background: color-mix(in srgb, var(--badge-danger-bg, #fee4e2) 80%, transparent);
    border: 1px solid var(--badge-danger-border, #fecdca);
    color: var(--badge-danger-color, #b42318);
  }

  .cc-status-dot {
    display: inline-block;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.8;
  }

  /* ═══════════════════════════════════════════════════════════
     GLASS TOOLBAR
     ═══════════════════════════════════════════════════════════ */
  .cc-toolbar {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem;

    /* Glass effect — works over both dark video and light page bg */
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(24px) saturate(1.6);
    -webkit-backdrop-filter: blur(24px) saturate(1.6);

    border: 1px solid rgba(226, 232, 240, 0.82);
    border-radius: var(--radius-xl, 24px);

    box-shadow:
      0 8px 32px rgba(15, 23, 42, 0.10),
      0 2px 8px rgba(15, 23, 42, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.85);
  }

  /* ── Control groups ─────────────────────────────────────────── */
  .cc-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* Optional group collapses when empty */
  .cc-group--optional:empty {
    display: none;
  }

  /* Visual separator between groups */
  .cc-divider {
    inline-size: 1px;
    block-size: 1.75rem;
    background: var(--color-border, #e2e8f0);
    border-radius: 1px;
    flex-shrink: 0;
    opacity: 0.6;
  }

  /* ── Button content layout ────────────────────────────────────
     Stacks icon above label inside Button's slot.               */
  .cc-btn-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1875rem;
    /* Expand to fill Button's slot span */
    inline-size: 100%;
  }

  .cc-icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
    flex-shrink: 0;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .cc-btn-label {
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 1;
    /* Inherits color from Button */
  }

  /* ── Button-wrap: "off" state visual cue ──────────────────────
     When mic or camera is off, add a subtle red tint around
     the button to reinforce the muted/disabled state beyond
     just the variant change.                                     */
  .cc-btn-wrap.is-off :global(.button) {
    position: relative;
  }

  /* Fine-tune Button size for the icon-over-label layout */
  :global(.cc-toolbar .button[data-size='md']) {
    min-block-size: 3.25rem;
    padding-inline: var(--space-md, 1rem);
    padding-block: 0.5rem;
  }

  /* ── End call special sizing ─────────────────────────────────
     Slightly wider pill, same height as other controls.        */
  .cc-end-wrap :global(.button[data-variant='danger']) {
    min-inline-size: 4.25rem;
    border-radius: var(--radius-lg, 16px);
  }

  .cc-end-content {
    gap: 0.25rem;
  }

  /* End call icon — rotated 135° to look like a hung-up phone */
  .cc-icon--end {
    transform: rotate(135deg);
  }

  .cc-end-label {
    font-size: 0.625rem;
    font-weight: 800;
  }

  /* ═══════════════════════════════════════════════════════════
     ANIMATIONS
     ═══════════════════════════════════════════════════════════ */
  @keyframes cc-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ═══════════════════════════════════════════════════════════
     DARK THEME
     When the toolbar is placed over the dark call UI,
     the glass shifts to a dark-glass variant.
     ═══════════════════════════════════════════════════════════ */
  :global([data-theme='dark']) .cc-toolbar {
    background: rgba(15, 20, 35, 0.82);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.35),
      0 2px 8px rgba(0, 0, 0, 0.20),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  :global([data-theme='dark']) .cc-divider {
    background: rgba(255, 255, 255, 0.12);
  }

  /* Ghost buttons on dark glass need slightly lighter treatment */
  :global([data-theme='dark']) :global(.cc-toolbar .button[data-variant='ghost']) {
    --btn-color: rgba(255, 255, 255, 0.82);
    --btn-border: rgba(255, 255, 255, 0.1);
  }

  :global([data-theme='dark']) :global(.cc-toolbar .button[data-variant='ghost']:hover:not(:disabled)) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.16);
  }

  /* ═══════════════════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════════════════ */
  @media (max-width: 480px) {
    .cc-toolbar {
      gap: 0.25rem;
      padding: 0.3rem;
      border-radius: var(--radius-lg, 16px);
    }

    :global(.cc-toolbar .button[data-size='md']) {
      min-inline-size: unset;
      min-block-size: 2.75rem;
      padding-inline: 0.75rem;
    }

    /* Hide text labels at very small sizes */
    .cc-btn-label {
      display: none;
    }

    .cc-end-label {
      display: none;
    }

    .cc-end-wrap :global(.button[data-variant='danger']) {
      min-inline-size: 3rem;
    }
  }

  /* Reduced motion: disable entrance animations */
  @media (prefers-reduced-motion: reduce) {
    .cc-status-banner {
      animation: none;
    }
  }
</style>
