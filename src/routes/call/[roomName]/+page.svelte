<!--
  /call/[roomName] — Full-Screen Active Call Page
  ================================================
  Entry point for the initiator (navigated here after initiateCall() returns
  LiveKit credentials) and for URL-based direct joins.

  Previously this page rendered its own video grid + CallControls, giving the
  caller fewer controls than the receiver (who saw CallSession via
  GlobalCallManager). Both paths now use CallSession so caller and receiver
  have identical controls: mic, camera, screen share, raise hand, recording,
  add people, video quality, full-screen, and end call.

  Lifecycle:
    onMount   → connect to LiveKit (using store credentials or fetched token)
    onDestroy → disconnect LiveKit, clean up event bindings, reset stores
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';

  import CallSession, { type ActiveCallSession } from '$lib/components/calls/CallSession.svelte';
  import IncomingCallOverlay from '$lib/components/molecules/IncomingCallOverlay.svelte';
  import Spinner from '$lib/components/atoms/Spinner.svelte';

  import { callStore } from '$lib/stores/call.store';
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

  // ── Route param ─────────────────────────────────────────────────
  $: roomName = $page.params.roomName as string;

  // ── Component state ──────────────────────────────────────────────
  let isConnecting = true;
  let connectError: string | null = null;
  let cleanupCallEvents: (() => void) | null = null;

  /** Populated once the LiveKit connection succeeds; drives CallSession. */
  let session: ActiveCallSession | null = null;
  let isEndingCall = false;

  // ── Store subscriptions ──────────────────────────────────────────
  $: activeState = $activeCallStore;

  // ── LiveKit connection ───────────────────────────────────────────
  async function connect() {
    isConnecting = true;
    connectError = null;
    session = null;

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

      // Build the session object that CallSession.svelte needs.
      // Uses storeState (captured synchronously above) to avoid race conditions.
      session = {
        callId:       storeState.callId,
        callMode:     storeState.callMode,
        callType:     storeState.callType,
        recipients:   storeState.peer ? [storeState.peer.name] : [],
        initiatedAt:  new Date(),
        roomName:     roomName
      };
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

  // ── End call ─────────────────────────────────────────────────────
  async function handleEndCall(): Promise<void> {
    if (isEndingCall) return;
    isEndingCall = true;
    const callId = get(activeCallStore).callId;
    try {
      if (callId) await endCall(callId);
    } catch (err) {
      console.error('[CallPage] end call failed:', err);
    } finally {
      isEndingCall = false;
      activeCallStore.reset();
      await goto('/home');
    }
  }

  // ── Incoming call handlers (second call arriving during an active call) ──
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

<!--
  Incoming-call overlay is intentionally rendered outside the main conditional
  so it layers on top of everything (including CallSession at z-index: 50).
  IncomingCallOverlay uses z-index: 1200 so this ordering is always correct.
-->
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

{#if isConnecting}
  <!-- ── Connecting state ────────────────────────────────────────── -->
  <div class="call-page" role="status" aria-live="polite">
    <Spinner size="lg" label="Connecting to call" />
    <p class="call-loading-text">Connecting…</p>
  </div>

{:else if connectError}
  <!-- ── Error state ─────────────────────────────────────────────── -->
  <div class="call-page call-page--error" role="alert">
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

{:else if session}
  <!--
    ── Full meeting room — identical controls for caller and receiver ──
    CallSession renders its own position:fixed overlay (z-index: 50) covering
    the full viewport. It handles video grid, participant tiles, controls bar
    (mic, camera, screen share, raise hand, recording, add people, video
    quality, full-screen), and the elapsed-time / participant-count header.
  -->
  <CallSession {session} {isEndingCall} on:endCall={handleEndCall} />
{/if}

<style lang="postcss">
  /* Full-screen backdrop for loading and error states */
  .call-page {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: #0a0f1a;
    color: rgba(255, 255, 255, 0.7);
    z-index: 10;
  }

  .call-loading-text {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .call-page--error {
    gap: 0.75rem;
    padding: 2rem;
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

  .call-error-btn   { background: var(--color-secondary); color: #fff; }
  .call-error-leave { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
  .call-error-btn:hover,
  .call-error-leave:hover { opacity: 0.85; }
</style>
