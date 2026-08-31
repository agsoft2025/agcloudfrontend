<script lang="ts" context="module">
  import type { CallType } from '$lib/api/calls.api';

  const DEFAULT_CALLEE_ID = '';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import { RoomEvent, Track, type RemoteParticipant, type Room } from 'livekit-client';
  import Input from '$lib/components/atoms/Input.svelte';
  import { ApiError } from '$lib/api/client';
  import {
    getCallApiErrorMessage,
    getCallIdentifier,
    getCall,
    hasLiveKitCredentials,
    endCall,
    initiateCall,
    type AcceptCallResponse,
    type InitiateCallResponse
  } from '$lib/api/calls.api';
  import { bindCallEvents } from '$lib/livekit/useCall';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import { callStore } from '$lib/stores/call.store';
  import { toastStore } from '$lib/stores/toast.store';
  import AcceptCallForm from './AcceptCallForm.svelte';
  import CallSession, { type ActiveCallSession } from './CallSession.svelte';
  import CallStatus, { type CallStatusVariant } from './CallStatus.svelte';
  import CallTypeToggle from './CallTypeToggle.svelte';

  let calleeId = DEFAULT_CALLEE_ID;
  let callType: CallType = 'video';
  let callMode: 'one-to-one' | 'conference' = 'one-to-one';
  let isRecording = false;
  let fieldError = '';
  let statusMessage = '';
  let statusVariant: CallStatusVariant = 'info';
  let isSubmitting = false;
  let isEndingCall = false;
  let showSubscribePrompt = false;
  let activeSession: ActiveCallSession | null = null;
  let videoAvailable = true;
  let cleanupCallEvents: (() => void) | null = null;
  let cleanupOneToOneEndEvents: (() => void) | null = null;
  let callStatusInterval: ReturnType<typeof setInterval> | null = null;

  onDestroy(() => {
    cleanupLiveKit();
  });

  function setStatus(message: string, variant: CallStatusVariant) {
    statusMessage = message;
    statusVariant = variant;
  }

  function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message.length > 0) {
      return `${fallback} ${error.message}`;
    }
    return fallback;
  }

  function validateCalleeId() {
    const trimmedCalleeId = calleeId.trim();
    if (!trimmedCalleeId) {
      fieldError = 'Recipient ID is required.';
      return null;
    }
    const ids = trimmedCalleeId.split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      fieldError = 'At least one recipient ID is required.';
      return null;
    }
    if (callMode === 'one-to-one' && ids.length > 1) {
      fieldError = 'Only one recipient ID is allowed for One-to-One calls. Switch to Conference mode for multiple.';
      return null;
    }
    return ids;
  }

  async function connectLiveKit(
    response: InitiateCallResponse | AcceptCallResponse,
    fallbackCallType: CallType
  ): Promise<{ roomName: string; callType: CallType } | null> {
    if (!hasLiveKitCredentials(response)) return null;
    cleanupCallEvents?.();
    cleanupCallEvents = null;
    cleanupOneToOneEndEvents?.();
    cleanupOneToOneEndEvents = null;
    const requestedVideo = (response.call?.callType ?? fallbackCallType) === 'video';
    const room = await liveKitClient.connect({
      token: response.token,
      url: response.url,
      connectOptions: { autoSubscribe: true }
    });
    cleanupCallEvents = bindCallEvents(room);
    liveKitClient.subscribeToAllRemoteTracks();
    const publishResults = await Promise.allSettled([
      liveKitClient.setMicrophoneEnabled(true),
      requestedVideo ? liveKitClient.setCameraEnabled(true) : Promise.resolve(undefined)
    ]);
    publishResults.forEach((result) => {
      if (result.status === 'rejected') console.warn('LiveKit media publishing failed.', result.reason);
    });
    const localTracks = room.localParticipant.getTrackPublications();
    videoAvailable = localTracks.some((t) => t.kind === Track.Kind.Video);
    room.remoteParticipants.forEach((p) => {
      const remoteTracks = p.getTrackPublications();
    });
    cleanupOneToOneEndEvents = bindOneToOneEndEvents(room);
    const finalRoomName = response.roomName || `room-${Date.now()}`;
    return { roomName: finalRoomName, callType: requestedVideo && videoAvailable ? 'video' : 'audio' };
  }

  async function cleanupLiveKit() {
    stopCallStatusMonitor();
    cleanupCallEvents?.();
    cleanupCallEvents = null;
    cleanupOneToOneEndEvents?.();
    cleanupOneToOneEndEvents = null;
    activeSession = null;
    videoAvailable = true;
    await liveKitClient.disconnect();
    callStore.reset();
  }

  function startCallStatusMonitor(callId: string | null) {
    stopCallStatusMonitor();
    if (!callId) return;

    callStatusInterval = setInterval(async () => {
      try {
        const response = await getCall(callId);
        const status = response.call?.status;

        if (status && !['initiated', 'active'].includes(status)) {
          await cleanupLiveKit();
          setStatus('Call ended.', 'info');
        }
      } catch (error) {
        await cleanupLiveKit();
        setStatus(getCallApiErrorMessage(error, 'Call is no longer available.'), 'info');
      }
    }, 5000);
  }

  function stopCallStatusMonitor() {
    if (!callStatusInterval) return;
    clearInterval(callStatusInterval);
    callStatusInterval = null;
  }

  function bindOneToOneEndEvents(room: Room) {
    const endBecausePeerLeft = async (_participant: RemoteParticipant) => {
      const session = activeSession;
      if (!session || session.callMode !== 'one-to-one') return;

      if (session.callId) {
        endCall(session.callId).catch((error) => {
          console.warn('Unable to notify backend that peer left the call.', error);
        });
      }

      await cleanupLiveKit();
      setStatus('Call ended because the other participant left.', 'info');
    };

    const endBecauseRoomClosed = async () => {
      if (!activeSession) return;
      await cleanupLiveKit();
      setStatus('Call ended.', 'info');
    };

    room
      .on(RoomEvent.ParticipantDisconnected, endBecausePeerLeft)
      .on(RoomEvent.Disconnected, endBecauseRoomClosed);

    return () => {
      room
        .off(RoomEvent.ParticipantDisconnected, endBecausePeerLeft)
        .off(RoomEvent.Disconnected, endBecauseRoomClosed);
    };
  }

  async function handleAcceptedCall(event: CustomEvent<AcceptCallResponse & { requestedCallId: string }>) {
    statusMessage = '';
    try {
      const response = event.detail;
      const liveKitSession = await connectLiveKit(response, response.call?.callType ?? 'video');
      const callId = getCallIdentifier(response) ?? response.requestedCallId;
      activeSession = {
        callId,
        callMode: response.call?.callMode ?? 'one-to-one',
        callType: liveKitSession?.callType ?? response.call?.callType ?? 'video',
        recipients: [response.call?.callerId ?? 'Caller'],
        initiatedAt: new Date(),
        roomName: liveKitSession?.roomName ?? response.roomName
      };
      startCallStatusMonitor(callId);
      setStatus(response.message ?? 'Call accepted successfully.', 'success');
    } catch (apiError) {
      setStatus(getErrorMessage(apiError, 'Call accepted, but LiveKit could not connect.'), 'error');
    }
  }

  async function handleInitiateCall() {
    fieldError = '';
    statusMessage = '';
    const validatedReceiverIds = validateCalleeId();
    if (!validatedReceiverIds) return;
    isSubmitting = true;
    try {
      const response = await initiateCall({ receiverIds: validatedReceiverIds, callType, callMode, recording: isRecording });
      const callId = getCallIdentifier(response);
      let liveKitSession: { roomName: string; callType: CallType } | null = null;
      let liveKitError = '';
      try {
        liveKitSession = await connectLiveKit(response, callType);
      } catch (error) {
        liveKitError = getErrorMessage(error, 'Call initiated, but LiveKit could not connect. Check the LiveKit URL and token.');
      }
      activeSession = {
        callId,
        callMode,
        callType: liveKitSession?.callType ?? callType,
        recipients: validatedReceiverIds,
        initiatedAt: new Date(),
        roomName: liveKitSession?.roomName ?? response.roomName
      };
      startCallStatusMonitor(callId);
      if (liveKitError) {
        setStatus(liveKitError, 'error');
      } else {
        setStatus(`Call request sent to ${validatedReceiverIds.join(', ')}.`, 'success');
      }
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.status === 403) {
        const body = apiError.body as { code?: string; message?: string } | undefined;
        if (body?.code === 'FREE_CALL_EXHAUSTED') {
          showSubscribePrompt = true;
          // Show the backend message in a toast — skip the generic inline
          // error so the user sees a clean, actionable notification instead.
          toastStore.error(
            body.message ?? 'Your free call limit is over. Please subscribe to continue.',
            6000
          );
          return;
        }
      }
      setStatus(getCallApiErrorMessage(apiError, 'Unable to initiate the call.'), 'error');
    } finally {
      isSubmitting = false;
    }
  }

  async function retryVideo() {
    try {
      const pub = await liveKitClient.setCameraEnabled(true);
      if (pub) {
        videoAvailable = true;
        setStatus('Video re-enabled.', 'success');
        liveKitClient.subscribeToAllRemoteTracks();
      } else {
        setStatus('Camera still unavailable.', 'error');
      }
    } catch (e) {
      setStatus('Error enabling camera: ' + (e instanceof Error ? e.message : e), 'error');
    }
  }

  async function handleEndActiveCall() {
    if (!activeSession?.callId) {
      activeSession = null;
      setStatus('Call preview closed.', 'info');
      return;
    }
    isEndingCall = true;
    statusMessage = '';
    try {
      const response = await endCall(activeSession.callId);
      setStatus(response.message ?? 'Call ended successfully.', 'success');
      await cleanupLiveKit();
    } catch (apiError) {
      setStatus(getCallApiErrorMessage(apiError, 'Unable to end this call.'), 'error');
    } finally {
      isEndingCall = false;
    }
  }
</script>

<div class="workspace" aria-labelledby="workspace-title">
  <!-- Workspace header -->
  <header class="workspace-header">
    <div class="workspace-title-group">
      <div class="workspace-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1A19.4 19.4 0 013.1 10.8 19.8 19.8 0 012.1 2.2 2 2 0 014.1 0h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8.1 7.9a16 16 0 006 6l1.2-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0122 14.9z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <p class="workspace-eyebrow">Call workspace</p>
        <h2 id="workspace-title">One-to-One Call</h2>
      </div>
    </div>

    <div class="workspace-badges">
      <span class="badge badge-type">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 10l5-3v10l-5-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="2" y="6" width="11" height="12" rx="2" stroke="currentColor" stroke-width="2"/>
        </svg>
        {callType} support
      </span>
      <span class="badge badge-ready">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
          <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Encrypted
      </span>
    </div>
  </header>

  <!-- Active call session -->
  {#if activeSession}
    <CallSession session={activeSession} {isEndingCall} on:endCall={handleEndActiveCall} />
  {/if}

  <!-- Setup panels -->
  <div class="panels">
    <!-- Outbound panel -->
    <article class="panel" aria-labelledby="initiate-title">
      <header class="panel-head">
        <div class="panel-head-icon outbound" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <p class="panel-eyebrow">Outbound</p>
          <h3 id="initiate-title">Initiate call</h3>
        </div>
      </header>

      <form class="panel-form" on:submit|preventDefault={handleInitiateCall} novalidate>
        <!-- Call mode -->
        <div class="form-field">
          <label class="field-label" for="call-mode">Call mode</label>
          <div class="select-wrap">
            <select id="call-mode" class="styled-select" bind:value={callMode} disabled={isSubmitting}>
              <option value="one-to-one">One-to-One</option>
              <option value="conference">Conference</option>
            </select>
            <span class="select-caret" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
        </div>

        <!-- Recipient ID -->
        <Input
          id="callee-id"
          name="calleeId"
          label={callMode === 'one-to-one' ? 'Recipient user ID' : 'Recipient user IDs (comma-separated)'}
          bind:value={calleeId}
          error={fieldError}
          placeholder={callMode === 'one-to-one' ? 'e.g. 1001' : 'e.g. 1001, 1002, 1003'}
          disabled={isSubmitting}
          required
          on:input={() => { fieldError = ''; statusMessage = ''; }}
        />

        <!-- Call type toggle -->
        <div class="form-field">
          <span class="field-label">Call type</span>
          <CallTypeToggle bind:value={callType} disabled={isSubmitting} />
        </div>

        <!-- Recording -->
        <label class="checkbox-row">
          <input
            type="checkbox"
            class="checkbox"
            bind:checked={isRecording}
            disabled={isSubmitting}
          />
          <span>Enable call recording</span>
        </label>

        <Button type="submit" size="lg" variant="secondary" fullWidth loading={isSubmitting}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1A19.4 19.4 0 013.1 10.8 19.8 19.8 0 012.1 2.2 2 2 0 014.1 0h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8.1 7.9a16 16 0 006 6l1.2-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0122 14.9z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Start call
        </Button>
      </form>

      <CallStatus message={statusMessage} variant={statusVariant} />

      {#if showSubscribePrompt}
        <div class="subscribe-prompt">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.75"/>
            <path d="M2 10h20" stroke="currentColor" stroke-width="1.75"/>
          </svg>
          <div class="subscribe-prompt-body">
            <strong>Free call used</strong>
            <p>You've used your free call. Subscribe to make unlimited calls.</p>
          </div>
          <a href="/settings/subscription" class="subscribe-prompt-link">View plans</a>
        </div>
      {/if}

      {#if !videoAvailable}
        <div class="video-warning">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2L14.5 13H1.5L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M8 6v3M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <div>
            <strong>Camera unavailable</strong>
            <p>Camera is in use by another application. Video is disabled.</p>
          </div>
          <Button type="button" size="sm" variant="ghost" on:click={retryVideo}>Retry</Button>
        </div>
      {/if}
    </article>

    <!-- Inbound panel -->
    <div class="side-stack">
      <article class="panel inbound-panel" aria-labelledby="accept-title">
        <header class="panel-head">
          <div class="panel-head-icon inbound" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <p class="panel-eyebrow">Inbound</p>
            <h3 id="accept-title">Answer call</h3>
          </div>
        </header>

        <AcceptCallForm on:accepted={handleAcceptedCall} />
      </article>

      <aside class="network-card" aria-label="Network performance">
        <div class="network-visual" aria-hidden="true">
          <div class="signal-card signal-card-main">
            <span></span>
            <i></i>
            <b></b>
          </div>
          <div class="signal-card signal-card-small">
            <span></span>
            <i></i>
          </div>
          <div class="signal-base"></div>
        </div>
        <div class="network-copy">
          <h3>Global Connectivity</h3>
          <p>Reach enterprise nodes in under 20ms with Kinetic Ultra-low Latency Network.</p>
        </div>
      </aside>
    </div>
  </div>
</div>

<style lang="postcss">
  .workspace {
    display: grid;
    gap: clamp(0.85rem, 1.6vw, 1.25rem);
    max-inline-size: 76rem;
    margin-inline: auto;
    color: var(--color-text);
  }

  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
    padding: 0.25rem 0.25rem 0;
  }

  .workspace-title-group {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .workspace-icon {
    display: grid;
    place-items: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    flex-shrink: 0;
    border-radius: 12px;
    background: var(--call-info-badge-bg);
    border: 1px solid var(--call-info-badge-border);
    color: var(--call-info-badge-color);
  }

  .workspace-eyebrow,
  .panel-eyebrow {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--call-info-header-color);
    font-size: clamp(1.35rem, 2vw, 1.75rem);
    font-weight: 800;
    line-height: 1.2;
  }

  .workspace-badges {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-block-size: 2rem;
    border: 1px solid var(--call-card-border);
    border-radius: var(--radius-full);
    background: var(--call-card-bg);
    color: var(--call-room-input-color);
    font-size: 0.75rem;
    font-weight: 800;
    padding: 0.25rem 0.875rem;
    text-transform: capitalize;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
    backdrop-filter: blur(14px);
  }

  .panels {
    display: grid;
    grid-template-columns: minmax(0, 1.42fr) minmax(18rem, 0.68fr);
    gap: clamp(0.85rem, 1.5vw, 1.15rem);
    align-items: stretch;
  }

  .panel {
    display: grid;
    gap: 1rem;
    block-size: 100%;
    border: 1px solid var(--call-card-border);
    border-radius: 22px;
    background: var(--call-panel-bg);
    padding: clamp(1rem, 2vw, 1.35rem);
    box-shadow:
      var(--call-card-shadow);
    margin: 0;
  }

  .inbound-panel {
    padding: 1rem;
  }

  .side-stack {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: clamp(0.75rem, 1.4vw, 1rem);
    block-size: 100%;
  }

  .panel-head {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .panel-head-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 2.625rem;
    block-size: 2.625rem;
    border-radius: 12px;
  }

  .panel-head-icon.outbound {
    background: var(--call-info-badge-bg);
    border: 1px solid var(--call-info-badge-border);
    color: var(--call-info-badge-color);
  }

  .panel-head-icon.inbound {
    background: var(--call-ok-badge-bg);
    border: 1px solid var(--call-ok-badge-border);
    color: var(--call-ok-badge-color);
  }

  h3 {
    margin: 0;
    color: var(--call-info-header-color);
    font-size: 1.12rem;
    font-weight: 800;
    line-height: 1.2;
  }

  .panel-form {
    display: grid;
    gap: 0.78rem;
  }

  .form-field {
    display: grid;
    gap: 0.35rem;
  }

  .field-label {
    color: var(--call-room-input-color);
    font-size: 0.78rem;
    font-weight: 800;
    line-height: 1.3;
  }

  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .styled-select {
    inline-size: 100%;
    min-block-size: 2.7rem;
    border: 1.5px solid var(--call-room-input-border);
    border-radius: 12px;
    background: var(--call-room-input-bg);
    color: var(--call-room-input-color);
    font-family: var(--font-sans);
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.4;
    padding: 0 2.25rem 0 var(--space-md);
    cursor: pointer;
    appearance: none;
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .styled-select:hover:not(:disabled) {
    border-color: var(--call-room-input-border-strong);
  }

  .styled-select:focus {
    border-color: var(--color-secondary);
    outline: none;
    box-shadow: 0 0 0 3px rgba(78, 135, 255, 0.15);
  }

  .styled-select:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    background: var(--call-room-disabled-bg);
  }

  .select-caret {
    position: absolute;
    inset-inline-end: 0.75rem;
    display: grid;
    place-items: center;
    color: var(--color-muted);
    pointer-events: none;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--call-room-label-color);
    font-size: 0.86rem;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }

  .checkbox {
    inline-size: 1rem;
    block-size: 1rem;
    flex-shrink: 0;
    border: 1.5px solid var(--color-border-strong);
    border-radius: 5px;
    cursor: pointer;
    accent-color: var(--color-secondary);
  }

  .subscribe-prompt {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-block-start: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--pico-primary) 30%, transparent);
    background: color-mix(in srgb, var(--pico-primary) 6%, transparent);
    color: var(--pico-color);
  }

  .subscribe-prompt svg {
    flex-shrink: 0;
    color: var(--pico-primary, #cba6f7);
  }

  .subscribe-prompt-body {
    flex: 1;
    min-inline-size: 0;
  }

  .subscribe-prompt-body strong {
    display: block;
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .subscribe-prompt-body p {
    margin: 0;
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .subscribe-prompt-link {
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--pico-primary, #cba6f7);
    text-decoration: none;
    white-space: nowrap;
  }
  .subscribe-prompt-link:hover { text-decoration: underline; }

  .video-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    border: 1px solid var(--color-error-border);
    border-radius: var(--radius-md);
    background: var(--color-error-bg);
    padding: 0.875rem 1rem;
    color: var(--color-error);
    font-size: 0.875rem;
  }

  .video-warning svg {
    flex-shrink: 0;
    margin-block-start: 0.15rem;
  }

  .video-warning div {
    flex: 1;
    display: grid;
    gap: 0.2rem;
  }

  .video-warning strong {
    font-weight: 700;
  }

  .video-warning p {
    margin: 0;
    color: var(--color-error);
    opacity: 0.8;
  }

  .network-card {
    position: relative;
    display: grid;
    min-block-size: 10.75rem;
    overflow: hidden;
    border-radius: 22px;
    background:
      radial-gradient(circle at 76% 20%, rgba(65, 190, 255, 0.5) 0, transparent 9rem),
      radial-gradient(circle at 20% 0%, rgba(45, 212, 191, 0.32) 0, transparent 10rem),
      linear-gradient(145deg, #0d3546 0%, #0f5ec8 100%);
    color: white;
    box-shadow: 0 24px 60px rgba(14, 87, 160, 0.28);
    isolation: isolate;
  }

  .network-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(120deg, transparent 0 45%, rgba(255, 255, 255, 0.16) 46%, transparent 47% 100%),
      linear-gradient(180deg, transparent 0%, rgba(1, 13, 34, 0.42) 100%);
    z-index: -1;
  }

  .network-visual {
    position: relative;
    min-block-size: 6.9rem;
  }

  .signal-card {
    position: absolute;
    border: 1px solid rgba(125, 211, 252, 0.64);
    border-radius: 9px;
    background: linear-gradient(145deg, rgba(96, 165, 250, 0.28), rgba(14, 165, 233, 0.08));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 18px 34px rgba(0, 0, 0, 0.22);
    transform: skewY(-17deg) rotateY(-10deg);
    backdrop-filter: blur(12px);
  }

  .signal-card-main {
    inline-size: 5.65rem;
    block-size: 4.55rem;
    inset-block-start: 0.75rem;
    inset-inline-start: 4.4rem;
  }

  .signal-card-small {
    inline-size: 3.9rem;
    block-size: 3.25rem;
    inset-block-start: 3rem;
    inset-inline-start: 8.1rem;
  }

  .signal-card span,
  .signal-card i,
  .signal-card b {
    position: absolute;
    display: block;
    border-radius: 999px;
    background: rgba(186, 230, 253, 0.42);
  }

  .signal-card span {
    inline-size: 48%;
    block-size: 0.55rem;
    inset-block-start: 1.8rem;
    inset-inline-start: 0.9rem;
  }

  .signal-card i {
    inline-size: 58%;
    block-size: 0.55rem;
    inset-block-start: 2.55rem;
    inset-inline-start: 0.9rem;
  }

  .signal-card b {
    inline-size: 1.1rem;
    block-size: 1.1rem;
    inset-block-start: 0.6rem;
    inset-inline-end: 0.75rem;
    background: linear-gradient(135deg, #e0f2fe, #38bdf8);
  }

  .signal-base {
    position: absolute;
    inline-size: 9.4rem;
    block-size: 2.5rem;
    inset-block-start: 5.2rem;
    inset-inline-start: 3.6rem;
    border-radius: 50%;
    background: linear-gradient(90deg, rgba(56, 189, 248, 0.12), rgba(147, 197, 253, 0.32));
    transform: skewX(-28deg);
  }

  .network-copy {
    align-self: end;
    padding: 0 1.1rem 1.05rem;
  }

  .network-copy h3 {
    color: #ffffff;
    font-size: 1rem;
  }

  .network-copy p {
    max-inline-size: 16rem;
    margin: 0.25rem 0 0;
    color: rgba(255, 255, 255, 0.86);
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.45;
  }

  :global(.panel .input) {
    min-block-size: 2.7rem;
    border-color: var(--call-room-input-border);
    border-radius: 12px;
    background: var(--call-room-input-bg);
  }

  :global(.panel .label) {
    color: var(--call-room-input-color);
    font-size: 0.78rem;
    font-weight: 800;
  }

  :global(.panel .input:focus) {
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px rgba(78, 135, 255, 0.15);
  }

  @media (max-width: 900px) {
    .panels {
      grid-template-columns: 1fr;
    }

    .network-card {
      min-block-size: 12rem;
    }
  }

  @media (max-width: 560px) {
    .workspace-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .panel {
      padding: var(--space-lg);
    }

    .workspace-badges {
      inline-size: 100%;
      align-items: stretch;
    }

    .badge {
      justify-content: center;
      flex: 1;
    }

    .network-card {
      border-radius: 18px;
    }
  }
</style>
