<!--
  GlobalCallManager.svelte
  =========================
  Mounted once in the authenticated app shell (home/+layout.svelte).

  Listens for real-time call signaling (via $lib/realtime/call-signaling)
  and drives the activeCallStore state machine:

    idle -> outgoing-ringing  (caller initiates a call)
    idle -> incoming-ringing  (callee receives "call:incoming")
    outgoing-ringing -> connecting -> in-call  (callee accepted)
    incoming-ringing -> in-call                (callee accepts)
    * -> idle                                  (rejected / cancelled / ended)

  Renders the Teams-style IncomingCallOverlay, a "Calling..." overlay for
  the caller, and the full CallSession meeting UI once connected.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { authStore } from '$lib/stores/auth.store';
  import { activeCallStore, type ActiveCallState } from '$lib/stores/active-call.store';
  import { presenceStore } from '$lib/stores/presence.store';
  import { initCallSignaling, teardownCallSignaling } from '$lib/realtime/call-signaling';
  import { startRingback, startRingtone, stopRingtone } from '$lib/realtime/ringtone';
  import {
    acceptCall,
    rejectCall,
    endCall,
    leaveCall,
    hasLiveKitCredentials,
    getCallApiErrorMessage
  } from '$lib/api/calls.api';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import { bindCallEvents } from '$lib/livekit/useCall';
  import { callStore } from '$lib/stores/call.store';
  import IncomingCallOverlay from '$lib/components/molecules/IncomingCallOverlay.svelte';
  import IncomingCallNotifications from './IncomingCallNotifications.svelte';
  import CallSession, { type ActiveCallSession } from './CallSession.svelte';
  import BillingWarningPopup from './BillingWarningPopup.svelte';
  import type { IncomingInvite } from '$lib/stores/active-call.store';

  let cleanupLiveKitEvents: (() => void) | null = null;
  let session: ActiveCallSession | null = null;
  let isEndingCall = false;
  let lastPhase: ActiveCallState['phase'] = 'idle';

  $: state = $activeCallStore;
  $: handlePhaseChange(state);

  // Callee presence -- used to show offline/ringing status on outgoing call screen
  $: calleePresence = state.peer
    ? $presenceStore.presences.get(state.peer.id)
    : undefined;

  $: calleeStatus = calleePresence?.status ?? 'unknown';

  // Hide the banner for:
  //   (1) the invite already shown in the full-screen incoming-call overlay, and
  //   (2) any invite for the call the user has already joined/is connecting to —
  //       there is no reason to offer "Join" for a call you are already inside.
  $: bannerInvites = state.incomingInvites.filter((invite) => {
    if (state.callId === invite.callId) {
      if (
        state.phase === 'incoming-ringing' ||
        state.phase === 'connecting' ||
        state.phase === 'in-call'
      ) {
        return false;
      }
    }
    return true;
  });

  onMount(() => {
    if ($authStore.isAuthenticated) {
      initCallSignaling();
    } else {
      console.warn('[GlobalCallManager] not authenticated at mount, skipping call signaling init');
    }
  });

  onDestroy(() => {
    teardownCallSignaling();
    stopRingtone();
    void cleanupCallSession();
  });

  function handlePhaseChange(current: ActiveCallState) {
    if (current.phase === lastPhase) return;
    const previous = lastPhase;
    lastPhase = current.phase;

    if (current.phase === 'outgoing-ringing') {
      startRingback();
    } else if (current.phase === 'incoming-ringing') {
      startRingtone();
    } else {
      stopRingtone();
    }

    if (current.phase === 'connecting' && current.liveKit) {
      void connectToCall(current.liveKit, current);
    }

    if (current.phase === 'idle' && previous !== 'idle') {
      void cleanupCallSession();
    }
  }

  async function connectToCall(
    liveKit: NonNullable<ActiveCallState['liveKit']>,
    current: ActiveCallState
  ) {
    try {
      cleanupLiveKitEvents?.();
      cleanupLiveKitEvents = null;

      const room = await liveKitClient.connect({
        token: liveKit.token,
        url: liveKit.url,
        connectOptions: { autoSubscribe: true }
      });

      cleanupLiveKitEvents = bindCallEvents(room);
      liveKitClient.subscribeToAllRemoteTracks();

      await Promise.allSettled([
        liveKitClient.setMicrophoneEnabled(true),
        current.callType === 'video' ? liveKitClient.setCameraEnabled(true) : Promise.resolve(undefined)
      ]);

      session = {
        callId: current.callId,
        callMode: current.callMode,
        callType: current.callType,
        recipients: current.peer ? [current.peer.name] : [],
        initiatedAt: new Date(),
        roomName: liveKit.roomName
      };

      activeCallStore.setInCall(liveKit);
    } catch (err) {
      activeCallStore.setError(getCallApiErrorMessage(err, 'Unable to connect to the call.'));
      activeCallStore.reset();
    }
  }

  async function cleanupCallSession() {
    cleanupLiveKitEvents?.();
    cleanupLiveKitEvents = null;
    await liveKitClient.disconnect();
    callStore.reset();
    session = null;
  }

  // ── Callee actions ───────────────────────────────────────────────
  async function handleAccept() {
    if (!state.callId) return;
    // Capture callId before any async state changes so the finally block
    // always removes the correct invite even if the store has been reset.
    const callId = state.callId;
    try {
      const response = await acceptCall(callId);
      if (hasLiveKitCredentials(response)) {
        const liveKit = { token: response.token, roomName: response.roomName, url: response.url };
        activeCallStore.setLiveKit(liveKit);
        await connectToCall(liveKit, { ...state, liveKit });
      } else {
        activeCallStore.reset();
      }
    } catch (err) {
      activeCallStore.setError(getCallApiErrorMessage(err, 'Unable to accept the call.'));
      activeCallStore.reset();
    } finally {
      // Dismiss the persistent notification banner — the user has already
      // responded (accepted or failed), so the invite must not linger.
      activeCallStore.removeIncomingInvite(callId);
    }
  }

  async function handleReject() {
    if (!state.callId) return;
    try {
      await rejectCall(state.callId);
    } catch (err) {
      console.error('[GlobalCallManager] reject failed:', err);
    } finally {
      activeCallStore.reset();
    }
  }

  // ── Caller action: cancel an outgoing call before it's answered ───
  async function handleCancelOutgoing() {
    if (!state.callId) return;
    try {
      await endCall(state.callId);
    } catch (err) {
      console.error('[GlobalCallManager] cancel failed:', err);
    } finally {
      activeCallStore.reset();
    }
  }

  // ── End an active call ──────────────────────────────────────────
  // Uses leaveCall() instead of endCall() so the meeting stays alive for
  // remaining participants. endCall() is reserved for the host explicitly
  // terminating the session for everyone (future "End for all" feature).
  async function handleEndCall() {
    if (!state.callId) return;
    isEndingCall = true;
    try {
      await leaveCall(state.callId);
    } catch (err) {
      console.error('[GlobalCallManager] leave call failed:', err);
    } finally {
      isEndingCall = false;
      activeCallStore.reset();
    }
  }

  // ── Notification banner actions ──────────────────────────────────
  async function handleJoinInvite(invite: IncomingInvite) {
    const current = get(activeCallStore);

    if (current.phase !== 'idle' && current.callId !== invite.callId) {
      if (current.phase === 'in-call' || current.phase === 'connecting') {
        if (current.callId) {
          try {
            // Leave the current call gracefully — other participants stay in.
            await leaveCall(current.callId);
          } catch (err) {
            console.error('[GlobalCallManager] failed to leave current call:', err);
          }
        }
        await cleanupCallSession();
      } else if (current.phase === 'outgoing-ringing' && current.callId) {
        try {
          // Cancel an unanswered outgoing call — this truly ends it for everyone.
          await endCall(current.callId);
        } catch (err) {
          console.error('[GlobalCallManager] failed to cancel outgoing call:', err);
        }
      }
      activeCallStore.reset();
    }

    try {
      const response = await acceptCall(invite.callId);
      if (!hasLiveKitCredentials(response)) {
        throw new Error('Call accepted but no LiveKit credentials were returned.');
      }

      const liveKit = { token: response.token, roomName: response.roomName, url: response.url };
      activeCallStore.setIncoming({
        callId: invite.callId,
        peer: invite.peer,
        callType: invite.callType,
        callMode: invite.callMode
      });
      activeCallStore.setLiveKit(liveKit);
      activeCallStore.setConnecting();
    } catch (err) {
      activeCallStore.setError(getCallApiErrorMessage(err, 'Unable to join the call.'));
    } finally {
      activeCallStore.removeIncomingInvite(invite.callId);
    }
  }

  async function handleDismissInvite(invite: IncomingInvite) {
    if (invite.status !== 'ended') {
      try {
        await rejectCall(invite.callId);
      } catch (err) {
        console.error('[GlobalCallManager] dismiss/reject failed:', err);
      }
    }

    const current = get(activeCallStore);
    if (current.phase === 'incoming-ringing' && current.callId === invite.callId) {
      activeCallStore.reset();
    }

    activeCallStore.removeIncomingInvite(invite.callId);
  }
</script>

{#if bannerInvites.length > 0}
  <IncomingCallNotifications
    invites={bannerInvites}
    on:join={(e) => handleJoinInvite(e.detail)}
    on:dismiss={(e) => handleDismissInvite(e.detail)}
  />
{/if}

{#if state.phase === 'incoming-ringing' && state.peer}
  <IncomingCallOverlay
    callId={state.callId ?? ''}
    callerId={state.peer.id}
    callerName={state.peer.name}
    callerAvatar={state.peer.avatarUrl ?? undefined}
    callType={state.callType}
    onAccept={handleAccept}
    onReject={handleReject}
  />
{:else if state.phase === 'outgoing-ringing' && state.peer}
  <div class="gcm-outgoing" role="dialog" aria-modal="true" aria-label="Outgoing call">
    <div class="gcm-outgoing-card">

      <!-- Avatar with pulse ring (suppressed when offline) -->
      <div class="gcm-avatar" class:gcm-avatar--offline={calleeStatus === 'offline'} aria-hidden="true">
        {#if state.peer.avatarUrl}
          <img src={state.peer.avatarUrl} alt="" />
        {:else}
          <span>{state.peer.name.slice(0, 1).toUpperCase()}</span>
        {/if}
        {#if calleeStatus !== 'offline'}
          <span class="gcm-pulse"></span>
        {/if}
      </div>

      <!-- Name -->
      <p class="gcm-name">{state.peer.name}</p>

      <!-- Status line: offline warning | ringing dots | calling -->
      {#if calleeStatus === 'offline'}
        <div class="gcm-status gcm-status--offline" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="16" r="1" fill="currentColor"/>
          </svg>
          <span>{state.peer.name} is offline — they may not receive your call</span>
        </div>
        <p class="gcm-substatus">Calling…</p>
      {:else if calleeStatus === 'online'}
        <div class="gcm-status gcm-status--ringing">
          <span>Ringing</span>
          <span class="gcm-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
        </div>
      {:else}
        <p class="gcm-substatus">Calling…</p>
      {/if}

      <button type="button" class="gcm-cancel" onclick={handleCancelOutgoing}>
        End call
      </button>
    </div>
  </div>
{:else if (state.phase === 'connecting' || state.phase === 'in-call') && session}
  <CallSession {session} {isEndingCall} on:endCall={handleEndCall} />
{/if}

<!-- Billing warning popup — shown during grace period after free minutes expire -->
<BillingWarningPopup />

<style lang="postcss">
  .gcm-outgoing {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: rgba(10, 15, 26, 0.72);
    backdrop-filter: blur(6px);
  }

  .gcm-outgoing-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2.5rem 2rem;
    border-radius: var(--radius-lg, 16px);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    text-align: center;
    min-inline-size: 20rem;
    max-inline-size: 24rem;
  }

  /* Avatar */
  .gcm-avatar {
    position: relative;
    inline-size: 5rem;
    block-size: 5rem;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--color-secondary);
    color: #fff;
    font-size: 2rem;
    font-weight: 700;
    overflow: hidden;
  }

  .gcm-avatar--offline {
    filter: grayscale(0.6);
    opacity: 0.8;
  }

  .gcm-avatar img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  /* Pulse ring -- only shown when online */
  .gcm-pulse {
    position: absolute;
    inset: -8px;
    border-radius: 999px;
    border: 2px solid var(--color-secondary);
    animation: gcm-pulse 1.8s ease-out infinite;
  }

  @keyframes gcm-pulse {
    0%   { transform: scale(1);    opacity: 0.7; }
    100% { transform: scale(1.35); opacity: 0; }
  }

  /* Peer name */
  .gcm-name {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--color-text);
    font-family: var(--font-sans);
  }

  /* Status row (shared) */
  .gcm-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8125rem;
    font-family: var(--font-sans);
    font-weight: 500;
    border-radius: 999px;
    padding: 0.3rem 0.75rem;
  }

  /* Offline warning badge */
  .gcm-status--offline {
    background: rgba(234, 88, 12, 0.12);
    color: #ea580c;
    border: 1px solid rgba(234, 88, 12, 0.28);
    font-size: 0.75rem;
    border-radius: 8px;
    text-align: start;
    padding: 0.5rem 0.75rem;
  }

  /* Ringing badge */
  .gcm-status--ringing {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border: 1px solid rgba(34, 197, 94, 0.25);
  }

  /* Sub-status text (Calling... shown below offline badge) */
  .gcm-substatus {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    font-family: var(--font-sans);
  }

  /* Animated bouncing dots for Ringing */
  .gcm-dots {
    display: inline-flex;
    gap: 3px;
    align-items: center;
  }

  .gcm-dots span {
    display: block;
    inline-size: 4px;
    block-size: 4px;
    border-radius: 999px;
    background: currentColor;
    animation: gcm-dot-bounce 1.2s ease-in-out infinite;
  }

  .gcm-dots span:nth-child(1) { animation-delay: 0s; }
  .gcm-dots span:nth-child(2) { animation-delay: 0.2s; }
  .gcm-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes gcm-dot-bounce {
    0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
    40%            { transform: translateY(-4px); opacity: 1; }
  }

  /* End call button */
  .gcm-cancel {
    margin-block-start: 0.5rem;
    padding: 0.625rem 1.5rem;
    border: none;
    border-radius: 999px;
    background: #dc2626;
    color: #fff;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 140ms ease;
  }

  .gcm-cancel:hover {
    background: #b91c1c;
  }
</style>
