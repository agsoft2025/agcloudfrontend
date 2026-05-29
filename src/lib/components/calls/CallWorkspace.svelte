<script lang="ts" context="module">
  import type { CallType } from '$lib/api/calls.api';

  const DEFAULT_CALLEE_ID = '';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import { Track } from 'livekit-client';
  import Input from '$lib/components/atoms/Input.svelte';
  import {
    getCallApiErrorMessage,
    getCallIdentifier,
    hasLiveKitCredentials,
    endCall,
    initiateCall,
    type AcceptCallResponse,
    type InitiateCallResponse
  } from '$lib/api/calls.api';
  import { bindCallEvents } from '$lib/livekit/useCall';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import { callStore } from '$lib/stores/call.store';
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
  let activeSession: ActiveCallSession | null = null;
  let videoAvailable = true;
  let cleanupCallEvents: (() => void) | null = null;

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
    const requestedVideo = (response.call?.callType ?? fallbackCallType) === 'video';
    const room = await liveKitClient.connect({
      token: response.token,
      url: response.url,
      roomOptions: { adaptiveStream: false, dynacast: false },
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
      console.log('Remote participant', p.identity, 'tracks:', remoteTracks.map((t) => t.kind + ':' + t.source));
    });
    const finalRoomName = response.roomName || `room-${Date.now()}`;
    return { roomName: finalRoomName, callType: requestedVideo && videoAvailable ? 'video' : 'audio' };
  }

  async function cleanupLiveKit() {
    cleanupCallEvents?.();
    cleanupCallEvents = null;
    activeSession = null;
    videoAvailable = true;
    await liveKitClient.disconnect();
    callStore.reset();
  }

  async function handleAcceptedCall(event: CustomEvent<AcceptCallResponse & { requestedCallId: string }>) {
    statusMessage = '';
    try {
      const response = event.detail;
      const liveKitSession = await connectLiveKit(response, response.call?.callType ?? 'video');
      const callId = getCallIdentifier(response) ?? response.requestedCallId;
      activeSession = {
        callId,
        callType: liveKitSession?.callType ?? response.call?.callType ?? 'video',
        recipients: [response.call?.callerId ?? 'Caller'],
        initiatedAt: new Date(),
        roomName: liveKitSession?.roomName ?? response.roomName
      };
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
        callType: liveKitSession?.callType ?? callType,
        recipients: validatedReceiverIds,
        initiatedAt: new Date(),
        roomName: liveKitSession?.roomName ?? response.roomName
      };
      if (liveKitError) {
        setStatus(liveKitError, 'error');
      } else {
        setStatus(`Call request sent to ${validatedReceiverIds.join(', ')}.`, 'success');
      }
    } catch (apiError) {
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
        <span class="badge-dot" aria-hidden="true"></span>
        {callType}
      </span>
      <span class="badge badge-ready">
        <span class="badge-dot badge-dot--green" aria-hidden="true"></span>
        Ready
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

        <Button type="submit" size="lg" loading={isSubmitting}>
          Start call
        </Button>
      </form>

      <CallStatus message={statusMessage} variant={statusVariant} />

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
    <article class="panel" aria-labelledby="accept-title">
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
  </div>
</div>

<style lang="postcss">
  /* ── Workspace shell ─────────────────────────────── */
  .workspace {
    display: grid;
    gap: var(--space-xl);
  }

  /* ── Header ──────────────────────────────────────── */
  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
    padding-block-end: var(--space-lg);
    border-block-end: 1px solid var(--color-border);
  }

  .workspace-title-group {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .workspace-icon {
    display: grid;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    flex-shrink: 0;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-secondary) 10%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-secondary) 18%, var(--color-border));
    color: var(--color-secondary);
  }

  .workspace-eyebrow {
    margin: 0;
    color: var(--color-subtle);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--color-text);
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
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
    gap: 0.375rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-muted);
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    text-transform: capitalize;
  }

  .badge-dot {
    inline-size: 0.4375rem;
    block-size: 0.4375rem;
    border-radius: 999px;
    background: var(--color-secondary);
  }

  .badge-dot--green {
    background: var(--color-success);
  }

  /* ── Panels layout ────────────────────────────────── */
  .panels {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(18rem, 0.8fr);
    gap: var(--space-lg);
    align-items: start;
  }

  /* ── Panel card ──────────────────────────────────── */
  .panel {
    display: grid;
    gap: var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    padding: var(--space-xl);
    box-shadow: var(--shadow-sm);
    margin: 0;
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
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--radius-md);
  }

  .panel-head-icon.outbound {
    background: color-mix(in srgb, var(--color-secondary) 10%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-secondary) 18%, var(--color-border));
    color: var(--color-secondary);
  }

  .panel-head-icon.inbound {
    background: color-mix(in srgb, var(--color-tertiary) 10%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-tertiary) 18%, var(--color-border));
    color: var(--color-tertiary);
  }

  .panel-eyebrow {
    margin: 0;
    color: var(--color-subtle);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h3 {
    margin: 0;
    color: var(--color-text);
    font-size: 1.0625rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.2;
  }

  /* ── Form ────────────────────────────────────────── */
  .panel-form {
    display: grid;
    gap: var(--space-md);
  }

  .form-field {
    display: grid;
    gap: 0.35rem;
  }

  .field-label {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.3;
  }

  /* Styled select */
  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .styled-select {
    inline-size: 100%;
    min-block-size: 2.875rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    line-height: 1.4;
    padding: 0 2.25rem 0 var(--space-md);
    cursor: pointer;
    appearance: none;
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .styled-select:hover:not(:disabled) {
    border-color: var(--color-border-strong);
  }

  .styled-select:focus {
    border-color: var(--color-secondary);
    outline: none;
    box-shadow: 0 0 0 3px rgba(78, 135, 255, 0.15);
  }

  .styled-select:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    background: var(--color-surface-raised);
  }

  .select-caret {
    position: absolute;
    inset-inline-end: 0.75rem;
    display: grid;
    place-items: center;
    color: var(--color-subtle);
    pointer-events: none;
  }

  /* Checkbox */
  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
  }

  .checkbox {
    inline-size: 1rem;
    block-size: 1rem;
    flex-shrink: 0;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    accent-color: var(--color-secondary);
  }

  /* Video warning */
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

  @media (max-width: 900px) {
    .panels {
      grid-template-columns: 1fr;
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
  }
</style>
