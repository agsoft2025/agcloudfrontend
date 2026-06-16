<!--
  GlobalCallManager.svelte
  =========================
  Mounted once in the authenticated app shell (home/+layout.svelte).

  Listens for real-time call signaling (via $lib/realtime/call-signaling)
  and drives the activeCallStore state machine:

    idle -> outgoing-ringing  (caller initiates a call, see placeCall())
    idle -> incoming-ringing  (callee receives "call:incoming")
    outgoing-ringing -> connecting -> in-call  (callee accepted)
    incoming-ringing -> in-call                (callee accepts)
    * -> idle                                  (rejected / cancelled / ended)

  Renders the Teams-style IncomingCallOverlay, a "Calling…" overlay for
  the caller, and the full CallSession meeting UI once connected.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { authStore } from '$lib/stores/auth.store';
  import { activeCallStore, type ActiveCallState } from '$lib/stores/active-call.store';
  import { initCallSignaling, teardownCallSignaling } from '$lib/realtime/call-signaling';
  import { startRingback, startRingtone, stopRingtone } from '$lib/realtime/ringtone';
  import {
    acceptCall,
    rejectCall,
    endCall,
    hasLiveKitCredentials,
    getCallApiErrorMessage
  } from '$lib/api/calls.api';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import { bindCallEvents } from '$lib/livekit/useCall';
  import { callStore } from '$lib/stores/call.store';
  import IncomingCallOverlay from '$lib/components/molecules/IncomingCallOverlay.svelte';
  import IncomingCallNotifications from './IncomingCallNotifications.svelte';
  import CallSession, { type ActiveCallSession } from './CallSession.svelte';
  import type { IncomingInvite } from '$lib/stores/active-call.store';

  let cleanupLiveKitEvents: (() => void) | null = null;
  let session: ActiveCallSession | null = null;
  let isEndingCall = false;
  let lastPhase: ActiveCallState['phase'] = 'idle';

  $: state = $activeCallStore;
  $: handlePhaseChange(state);

  // Hide the banner for whichever invite is already driving the full-screen
  // incoming-call overlay, to avoid showing duplicate UI for the same call.
  $: bannerInvites = state.incomingInvites.filter(
    (invite) => !(state.phase === 'incoming-ringing' && state.callId === invite.callId)
  );

  onMount(() => {
    if ($authStore.isAuthenticated) {
      console.log('[GlobalCallManager] initializing call signaling');
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
        roomOptions: { adaptiveStream: false, dynacast: false },
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
    try {
      const response = await acceptCall(state.callId);
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
  async function handleEndCall() {
    if (!state.callId) return;
    isEndingCall = true;
    try {
      await endCall(state.callId);
    } catch (err) {
      console.error('[GlobalCallManager] end call failed:', err);
    } finally {
      isEndingCall = false;
      activeCallStore.reset();
    }
  }

  // ── Notification banner actions ──────────────────────────────────
  /** Join a call from the persistent notification banner (new invite, re-invite, or "Call in Progress"). */
  async function handleJoinInvite(invite: IncomingInvite) {
    const current = get(activeCallStore);

    // If we're on a different call already, leave it first.
    if (current.phase !== 'idle' && current.callId !== invite.callId) {
      if (current.phase === 'in-call' || current.phase === 'connecting') {
        if (current.callId) {
          try {
            await endCall(current.callId);
          } catch (err) {
            console.error('[GlobalCallManager] failed to leave current call:', err);
          }
        }
        await cleanupCallSession();
      } else if (current.phase === 'outgoing-ringing' && current.callId) {
        try {
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

  /** Dismiss a notification banner (declines the invitation; it can be re-sent later). */
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
      <div class="gcm-avatar" aria-hidden="true">
        {#if state.peer.avatarUrl}
          <img src={state.peer.avatarUrl} alt="" />
        {:else}
          <span>{state.peer.name.slice(0, 1).toUpperCase()}</span>
        {/if}
        <span class="gcm-pulse"></span>
      </div>
      <p class="gcm-calling">Calling {state.peer.name}…</p>
      <p class="gcm-ringing">Ringing</p>
      <button type="button" class="gcm-cancel" onclick={handleCancelOutgoing}>
        End call
      </button>
    </div>
  </div>
{:else if (state.phase === 'connecting' || state.phase === 'in-call') && session}
  <CallSession {session} {isEndingCall} on:endCall={handleEndCall} />
{/if}

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
    min-inline-size: 18rem;
  }

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

  .gcm-avatar img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .gcm-pulse {
    position: absolute;
    inset: -8px;
    border-radius: 999px;
    border: 2px solid var(--color-secondary);
    animation: gcm-pulse 1.8s ease-out infinite;
  }

  @keyframes gcm-pulse {
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(1.35); opacity: 0; }
  }

  .gcm-calling {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--color-text);
    font-family: var(--font-sans);
  }

  .gcm-ringing {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    font-family: var(--font-sans);
  }

  .gcm-cancel {
    margin-block-start: 1rem;
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
