<!--
  /call/[roomName] — Full-Screen Active Call Page
  Integrates VideoTile, CallControls, ParticipantList, NetworkIndicator,
  and IncomingCallOverlay against the existing LiveKit + store layer.

  Desktop : video grid left, participant sidebar right
  Mobile  : video grid top, participant drawer collapsible below

  Lifecycle:
    onMount   → connect LiveKit (token from activeCallStore or fetched)
    onDestroy → disconnect LiveKit, remove listeners, clear stores
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { ConnectionQuality, ConnectionState, Track } from 'livekit-client';

  import LiveKitTrack from '$lib/components/calls/LiveKitTrack.svelte';
  import VideoTile from '$lib/components/molecules/VideoTile.svelte';
  import CallControls from '$lib/components/molecules/CallControls.svelte';
  import ParticipantList from '$lib/components/molecules/ParticipantList.svelte';
  import NetworkIndicator from '$lib/components/atoms/NetworkIndicator.svelte';
  import IncomingCallOverlay from '$lib/components/molecules/IncomingCallOverlay.svelte';
  import Spinner from '$lib/components/atoms/Spinner.svelte';

  import { callStore, type CallParticipantState } from '$lib/stores/call.store';
  import { activeCallStore } from '$lib/stores/active-call.store';
  import { liveKitClient, getLiveKitToken } from '$lib/livekit/LiveKitClient';
  import { bindCallEvents } from '$lib/livekit/useCall';
  import {
    endCall,
    acceptCall,
    rejectCall,
    getCallApiErrorMessage,
    hasLiveKitCredentials
  } from '$lib/api/calls.api';

  import type { IndicatorQuality } from '$lib/components/atoms/NetworkIndicator.types.ts';
  import type { NetworkQuality } from '$lib/components/molecules/VideoTile.types.ts';

  // ── Route param ────────────────────────────────────────────
  $: roomName = $page.params.roomName as string;

  // ── Component state ────────────────────────────────────────
  let isConnecting = true;
  let connectError: string | null = null;
  let showParticipants = false;
  let cleanupCallEvents: (() => void) | null = null;

  // ── Store subscriptions ────────────────────────────────────
  $: callState = $callStore;
  $: activeState = $activeCallStore;

  $: localParticipant = callState.localParticipant;
  $: remoteParticipants = callState.remoteParticipants;

  // Remote audio tracks — rendered as hidden <audio> elements so User1 can hear User2
  $: remoteAudioTracks = remoteParticipants.flatMap((p) =>
    p.tracks
      .filter((t) => t.kind === Track.Kind.Audio && t.track)
      .map((t) => ({ id: t.sid, participant: p.name ?? p.identity, track: t.track }))
  );

  // All participants in display order: local first, then remote
  $: allParticipants = [
    ...(localParticipant ? [localParticipant] : []),
    ...remoteParticipants
  ];

  // Network quality for local participant
  $: localNetworkQuality = mapToIndicatorQuality(
    localParticipant?.connectionQuality
  );

  // ── Quality mappers ────────────────────────────────────────
  function mapToIndicatorQuality(q?: ConnectionQuality): IndicatorQuality | undefined {
    switch (q) {
      case ConnectionQuality.Excellent: return 'excellent';
      case ConnectionQuality.Good:      return 'good';
      case ConnectionQuality.Poor:      return 'poor';
      case ConnectionQuality.Lost:      return 'disconnected';
      default:                           return undefined;
    }
  }

  function mapToTileQuality(q?: ConnectionQuality): NetworkQuality | undefined {
    switch (q) {
      case ConnectionQuality.Excellent: return 'excellent';
      case ConnectionQuality.Good:      return 'good';
      case ConnectionQuality.Poor:      return 'poor';
      default:                           return undefined;
    }
  }

  // ── LiveKit connection ─────────────────────────────────────
  async function connect() {
    isConnecting = true;
    connectError = null;

    try {
      const storeState = get(activeCallStore);
      const existingCreds = storeState.liveKit;

      const room = await liveKitClient.connect({
        token:  existingCreds?.token,
        url:    existingCreds?.url,
        tokenProvider: existingCreds?.token ? undefined : async () =>
          getLiveKitToken({ roomName }),
        publishDefaults: { audio: true, video: storeState.callType === 'video' }
      });

      cleanupCallEvents?.();
      cleanupCallEvents = bindCallEvents(room);
      liveKitClient.subscribeToAllRemoteTracks();

      activeCallStore.setInCall({
        token:    existingCreds?.token ?? '',
        roomName: roomName,
        url:      existingCreds?.url
      });
    } catch (err) {
      connectError = getCallApiErrorMessage(err, 'Could not connect to the call.');
    } finally {
      isConnecting = false;
    }
  }

  onMount(() => {
    void connect();
  });

  onDestroy(async () => {
    cleanupCallEvents?.();
    cleanupCallEvents = null;
    await liveKitClient.disconnect();
    callStore.reset();
  });

  // ── Call control actions ───────────────────────────────────
  async function onToggleMic(): Promise<void> {
    await liveKitClient.setMicrophoneEnabled(!callState.localParticipant?.tracks
      .some((t) => t.source.toString() === 'microphone' && !t.isMuted));
  }

  async function onToggleCamera(): Promise<void> {
    await liveKitClient.setCameraEnabled(!callState.localParticipant?.tracks
      .some((t) => t.source.toString() === 'camera' && !t.isMuted));
  }

  async function onToggleScreenShare(): Promise<void> {
    const isSharing = callState.localParticipant?.tracks
      .some((t) => t.source.toString() === 'screen_share');
    await liveKitClient.setScreenShareEnabled(!isSharing);
  }

  async function onEndCall(): Promise<void> {
    const callId = get(activeCallStore).callId;
    try {
      if (callId) await endCall(callId);
    } catch (err) {
      console.error('[CallPage] end call failed:', err);
    } finally {
      activeCallStore.reset();
      await goto('/home');
    }
  }

  // ── Incoming call handlers ─────────────────────────────────
  async function handleAcceptIncoming(): Promise<void> {
    const callId = activeState.callId;
    if (!callId) return;
    try {
      const response = await acceptCall(callId);
      if (hasLiveKitCredentials(response)) {
        activeCallStore.setLiveKit({
          token:    response.token,
          roomName: response.roomName,
          url:      response.url
        });
        activeCallStore.setConnecting();
        await connect();
      } else {
        activeCallStore.reset();
      }
    } catch (err) {
      console.error('[CallPage] accept failed:', getCallApiErrorMessage(err));
      activeCallStore.reset();
    }
  }

  async function handleRejectIncoming(): Promise<void> {
    const callId = activeState.callId;
    if (callId) {
      try { await rejectCall(callId); } catch { /* ignore */ }
    }
    activeCallStore.reset();
    await goto('/home');
  }
</script>

<svelte:head>
  <title>Call | AG Cloud</title>
</svelte:head>

<div class="call-page">
  <!-- ── Incoming call overlay (shown when a new call arrives during an active call) -->
  {#if activeState.phase === 'incoming-ringing' && activeState.peer}
    <IncomingCallOverlay
      callId={activeState.callId ?? ''}
      callerId={activeState.peer.id}
      callerName={activeState.peer.name}
      callerAvatar={activeState.peer.avatarUrl ?? undefined}
      callType={activeState.callType}
      onAccept={handleAcceptIncoming}
      onReject={handleRejectIncoming}
    />
  {/if}

  <!-- ── Connecting / error state ─────────────────────────── -->
  {#if isConnecting}
    <div class="call-loading" role="status" aria-live="polite">
      <Spinner size="lg" label="Connecting to call" />
      <p class="call-loading-text">Connecting…</p>
    </div>

  {:else if connectError}
    <div class="call-error" role="alert">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
      <p class="call-error-title">Could not connect to call</p>
      <p class="call-error-desc">{connectError}</p>
      <button class="call-error-btn" type="button" onclick={() => void connect()}>
        Retry
      </button>
      <button class="call-error-leave" type="button" onclick={() => goto('/home')}>
        Leave
      </button>
    </div>

  {:else}
    <!-- ── Hidden audio sink: plays remote participants' audio for User1 ── -->
    <div aria-hidden="true" style="display:none">
      {#each remoteAudioTracks as item (item.id)}
        <LiveKitTrack track={item.track} label="{item.participant} audio" />
      {/each}
    </div>

    <!-- ── Main call workspace ──────────────────────────────── -->
    <div class="call-workspace">

      <!-- Header bar: room name + network quality -->
      <header class="call-header">
        <div class="call-header-left">
          <span class="call-room-label">{roomName}</span>
          {#if activeState.peer?.name}
            <span class="call-peer-name">· {activeState.peer.name}</span>
          {/if}
        </div>
        <div class="call-header-right">
          <NetworkIndicator
            quality={localNetworkQuality}
            showLabel={false}
            size="sm"
          />
          <span class="call-conn-state" data-state={callState.connectionState}>
            {callState.connectionState === ConnectionState.Connected ? 'Connected' :
             callState.connectionState === ConnectionState.Connecting ? 'Connecting…' :
             callState.connectionState === ConnectionState.Reconnecting ? 'Reconnecting…' :
             'Disconnected'}
          </span>
        </div>
      </header>

      <!-- Body: video grid + sidebar -->
      <div class="call-body">

        <!-- Video grid -->
        <div
          class="call-grid"
          data-count={allParticipants.length}
          aria-label="Video conference grid"
        >
          {#if allParticipants.length === 0}
            <div class="call-grid-empty">
              <Spinner size="md" decorative />
              <p>Waiting for participants…</p>
            </div>
          {:else}
            {#each allParticipants as participant (participant.sid)}
              <VideoTile
                {participant}
                isLocal={participant.kind === 'local'}
                mirror={participant.kind === 'local'}
                networkQuality={mapToTileQuality(participant.connectionQuality)}
              />
            {/each}
          {/if}
        </div>

        <!-- Participant sidebar (desktop) / drawer (mobile) -->
        <aside
          class="call-sidebar"
          class:call-sidebar--open={showParticipants}
          aria-label="Participants"
          aria-hidden={!showParticipants}
        >
          <ParticipantList showSearch={false} />
        </aside>

      </div>

      <!-- Controls bar -->
      <div class="call-controls-bar">
        <CallControls
          {onToggleMic}
          {onToggleCamera}
          onToggleScreenShare={onToggleScreenShare}
          allowScreenShare={true}
          participantsOpen={showParticipants}
          onToggleParticipants={() => (showParticipants = !showParticipants)}
          {onEndCall}
        />
      </div>

    </div>
  {/if}
</div>

<style lang="postcss">
  /* ── Page shell ──────────────────────────────────────────── */
  .call-page {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #0a0f1a;
    color: #fff;
    overflow: hidden;
    z-index: 10;
  }

  /* ── Loading state ───────────────────────────────────────── */
  .call-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .call-loading-text {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 500;
  }

  /* ── Error state ─────────────────────────────────────────── */
  .call-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
  }

  .call-error-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 1.125rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.92);
  }

  .call-error-desc {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    max-inline-size: 22rem;
    line-height: 1.5;
  }

  .call-error-btn,
  .call-error-leave {
    margin-block-start: 0.25rem;
    padding: 0.625rem 1.5rem;
    border-radius: 999px;
    border: none;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 140ms ease;
  }

  .call-error-btn { background: var(--color-secondary); color: #fff; }
  .call-error-leave { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
  .call-error-btn:hover, .call-error-leave:hover { opacity: 0.85; }

  /* ── Workspace layout ────────────────────────────────────── */
  .call-workspace {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    overflow: hidden;
  }

  /* ── Header ──────────────────────────────────────────────── */
  .call-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border-block-end: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    z-index: 2;
  }

  .call-header-left {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-inline-size: 0;
    overflow: hidden;
  }

  .call-room-label {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .call-peer-name {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.45);
    white-space: nowrap;
  }

  .call-header-right {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-shrink: 0;
  }

  .call-conn-state {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: rgba(255, 255, 255, 0.4);
  }

  .call-conn-state[data-state='Connected']    { color: #34d399; }
  .call-conn-state[data-state='Reconnecting'] { color: #fbbf24; }

  /* ── Body: grid + sidebar ────────────────────────────────── */
  .call-body {
    flex: 1;
    min-block-size: 0;
    display: flex;
    overflow: hidden;
  }

  /* ── Video grid ──────────────────────────────────────────── */
  .call-grid {
    flex: 1;
    min-inline-size: 0;
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    align-content: center;
    overflow: hidden;
    /* Default: 1 tile */
    grid-template-columns: 1fr;
  }

  /* 2 tiles: side by side */
  .call-grid[data-count='2'] {
    grid-template-columns: 1fr 1fr;
  }

  /* 3-4 tiles: 2x2 grid */
  .call-grid[data-count='3'],
  .call-grid[data-count='4'] {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  /* 5-6 tiles: 3x2 */
  .call-grid[data-count='5'],
  .call-grid[data-count='6'] {
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  /* 7+ tiles: 3 columns auto rows */
  .call-grid:not([data-count='0']):not([data-count='1']):not([data-count='2']):not([data-count='3']):not([data-count='4']):not([data-count='5']):not([data-count='6']) {
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 1fr;
  }

  .call-grid-empty {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    min-block-size: 12rem;
  }

  .call-grid-empty p { margin: 0; }

  /* ── Participant sidebar ─────────────────────────────────── */
  .call-sidebar {
    inline-size: 0;
    flex-shrink: 0;
    overflow: hidden;
    border-inline-start: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(10, 15, 26, 0.9);
    transition: inline-size 220ms ease;
  }

  .call-sidebar--open {
    inline-size: 18rem;
  }

  /* ── Controls bar ────────────────────────────────────────── */
  .call-controls-bar {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    border-block-start: 1px solid rgba(255, 255, 255, 0.06);
    z-index: 2;
  }

  /* ── Mobile ──────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .call-body { flex-direction: column; }

    .call-sidebar {
      inline-size: 100%;
      block-size: 0;
      border-inline-start: none;
      border-block-start: 1px solid rgba(255, 255, 255, 0.08);
      transition: block-size 220ms ease, inline-size 0ms;
    }

    .call-sidebar--open {
      inline-size: 100%;
      block-size: 14rem;
    }

    .call-grid[data-count='2'],
    .call-grid[data-count='3'],
    .call-grid[data-count='4'],
    .call-grid[data-count='5'],
    .call-grid[data-count='6'] {
      grid-template-columns: 1fr;
      grid-auto-rows: auto;
    }
  }
</style>
