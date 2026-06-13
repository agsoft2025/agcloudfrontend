<!--
  IncomingCallOverlayExample — wires IncomingCallOverlay to the call API
  ========================================================================
  Shows how to:
    1. Hold incoming call data in a $state variable (populated from a
       push notification, polling, or WebSocket event).
    2. Implement onAccept via acceptCall() + connectLiveKit().
    3. Implement onReject via rejectCall().
    4. Mount / unmount the overlay based on call state.

  In a real app, replace the "simulate" buttons with your notification
  subscription logic (e.g. a Svelte store listener or SSE handler).
-->
<script lang="ts">
  import IncomingCallOverlay from '../IncomingCallOverlay.svelte';
  import type { IncomingCallData } from '../IncomingCallOverlay.types.ts';
  import {
    acceptCall,
    rejectCall,
    getCallApiErrorMessage,
    type AcceptCallResponse,
  } from '$lib/api/calls.api';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import { bindCallEvents } from '$lib/livekit/useCall';
  import { callStore } from '$lib/stores/call.store';

  // ── Parent-level props (e.g. passed from a top-level layout) ─
  type Props = {
    /** Called when the call session is fully connected and ready to render. */
    onCallConnected?: (callId: string, roomName: string) => void;
    /** Called when the call is rejected or dismissed. */
    onCallRejected?: () => void;
  };

  let { onCallConnected, onCallRejected }: Props = $props();

  // ── Incoming call state ───────────────────────────────────────
  // In production: populate this from a WebSocket / SSE event or
  // a notification store whenever a new call arrives.
  let incomingCall = $state<IncomingCallData | null>(null);

  // Error surfaced back to the UI (e.g. "Network error accepting call")
  let error = $state('');

  // ── Simulate receiving a call (demo helper) ───────────────────
  function simulateIncomingCall() {
    incomingCall = {
      callId:       'call-abc-123',
      callerId:     'user-456',
      callerName:   'Jane Smith',
      callerAvatar: undefined,      // undefined → initials fallback
      callType:     'video',
      roomName:     'room-abc-123',
    };
    error = '';
  }

  // ── Accept handler ────────────────────────────────────────────
  async function handleAccept() {
    if (!incomingCall) return;

    const { callId, roomName } = incomingCall;
    error = '';

    // 1. Accept the call on the backend
    let response: AcceptCallResponse;
    try {
      response = await acceptCall(callId);
    } catch (err) {
      error = getCallApiErrorMessage(err, 'Unable to accept the call.');
      throw err; // re-throw so IncomingCallOverlay shows loading error
    }

    // 2. Connect to LiveKit using the token returned from acceptCall
    const token   = response.token;
    const lkUrl   = response.url;
    const lkRoom  = response.roomName ?? roomName;

    if (token && lkUrl) {
      try {
        const room = await liveKitClient.connect({
          token,
          url: lkUrl,
          connectOptions: { autoSubscribe: true },
        });

        // 3. Bind room events → callStore
        bindCallEvents(room);
        liveKitClient.subscribeToAllRemoteTracks();

        // 4. Enable local mic + camera
        await Promise.allSettled([
          liveKitClient.setMicrophoneEnabled(true),
          liveKitClient.setCameraEnabled(true),
        ]);
      } catch (err) {
        console.error('[IncomingCallOverlay] LiveKit connect failed:', err);
        // Still dismiss overlay; parent can handle the failure
      }
    }

    // 5. Dismiss overlay and notify parent
    incomingCall = null;
    onCallConnected?.(callId, lkRoom ?? '');
  }

  // ── Reject handler ────────────────────────────────────────────
  async function handleReject() {
    if (!incomingCall) return;

    const { callId } = incomingCall;
    error = '';

    try {
      await rejectCall(callId);
    } catch (err) {
      // Log but still dismiss — UX > perfect signaling
      console.warn('[IncomingCallOverlay] rejectCall failed:', err);
    } finally {
      incomingCall = null;
      onCallRejected?.();
    }
  }
</script>

<!-- ── Demo trigger (remove in production) ───────────────────── -->
{#if !incomingCall}
  <div class="demo-trigger">
    <button type="button" onclick={simulateIncomingCall}>
      Simulate incoming call
    </button>
  </div>
{/if}

<!-- ── Error banner ──────────────────────────────────────────── -->
{#if error}
  <div class="ical-error" role="alert">
    {error}
    <button type="button" onclick={() => (error = '')}>✕</button>
  </div>
{/if}

<!-- ── Overlay (conditionally mounted) ───────────────────────── -->
{#if incomingCall}
  <IncomingCallOverlay
    callId={incomingCall.callId}
    callerId={incomingCall.callerId}
    callerName={incomingCall.callerName}
    callerAvatar={incomingCall.callerAvatar}
    callType={incomingCall.callType}
    roomName={incomingCall.roomName}
    onAccept={handleAccept}
    onReject={handleReject}
    rejectOnEscape={true}
  />
{/if}

<style lang="postcss">
  .demo-trigger {
    display: flex;
    padding: var(--space-md);
  }

  .demo-trigger button {
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-surface-raised);
    color: var(--color-text);
    font: 600 0.875rem var(--font-sans);
    cursor: pointer;
  }

  .demo-trigger button:hover {
    background: var(--color-border);
  }

  .ical-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: 0.625rem var(--space-md);
    margin: var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    color: var(--color-error);
    font: 500 0.8125rem var(--font-sans);
  }

  .ical-error button {
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    padding: 0;
    font-size: 0.875rem;
  }

  .ical-error button:hover { opacity: 1; }
</style>
