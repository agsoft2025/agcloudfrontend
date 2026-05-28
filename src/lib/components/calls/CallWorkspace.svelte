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
  // Flag to indicate whether we have a local video track
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
    if (!hasLiveKitCredentials(response)) {
      return null;
    }

    cleanupCallEvents?.();
    cleanupCallEvents = null;

    const requestedVideo = (response.call?.callType ?? fallbackCallType) === 'video';
    const room = await liveKitClient.connect({
      token: response.token,
      url: response.url,
      roomOptions: {
        adaptiveStream: false,
        dynacast: false
      },
      connectOptions: {
        autoSubscribe: true
      }
    });

    cleanupCallEvents = bindCallEvents(room);
    // Ensure we are subscribed to all remote tracks after connecting
    liveKitClient.subscribeToAllRemoteTracks();

    const publishResults = await Promise.allSettled([
      liveKitClient.setMicrophoneEnabled(true),
      requestedVideo ? liveKitClient.setCameraEnabled(true) : Promise.resolve(undefined)
    ]);

    publishResults.forEach((result) => {
      if (result.status === 'rejected') {
        console.warn('LiveKit media publishing failed.', result.reason);
      }
    });

    // Log local tracks for debugging and detect video availability
    const localTracks = room.localParticipant.getTrackPublications();
    videoAvailable = localTracks.some((t) => t.kind === Track.Kind.Video);
    // Log remote tracks for debugging
    room.remoteParticipants.forEach((p) => {
      const remoteTracks = p.getTrackPublications();
      console.log(
        'Remote participant',
        p.identity,
        'tracks:',
        remoteTracks.map((t) => t.kind + ':' + t.source)
      );
    });

    // Ensure we use the same roomName for both users
    const finalRoomName = response.roomName || `room-${Date.now()}`;

    return {
      roomName: finalRoomName,
      callType: requestedVideo && videoAvailable ? 'video' : 'audio'
    };
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

    if (!validatedReceiverIds) {
      return;
    }

    isSubmitting = true;

    try {
      const response = await initiateCall({
        receiverIds: validatedReceiverIds,
        callType,
        callMode,
        recording: isRecording
      });
      const callId = getCallIdentifier(response);
      let liveKitSession: { roomName: string; callType: CallType } | null = null;
      let liveKitError = '';

      try {
        liveKitSession = await connectLiveKit(response, callType);
      } catch (error) {
        liveKitError = getErrorMessage(
          error,
          'Call initiated, but LiveKit could not connect. Check the LiveKit URL and token.'
        );
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
    // Attempt to enable the camera again after the device is freed
    try {
      const pub = await liveKitClient.setCameraEnabled(true);
      if (pub) {
        videoAvailable = true;
        setStatus('Video re-enabled.', 'success');
        // Re-subscribe to remote tracks just in case.
        liveKitClient.subscribeToAllRemoteTracks();
      } else {
        // Still no video, keep warning visible.
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

<section class="workspace" aria-labelledby="call-workspace-title">
  <div class="hero">
    <div class="hero-copy">
      <p class="eyebrow">Call setup</p>
      <h2 id="call-workspace-title">One-to-One Call</h2>
      <p>Start, monitor, and manage a direct call with a single recipient.</p>
    </div>

    <div class="hero-metrics" aria-label="Call readiness">
      <div class="metric">
        <span class="metric-icon" aria-hidden="true"></span>
        <strong>{callType}</strong>
        <small>Selected mode</small>
      </div>
      <div class="metric">
        <span class="metric-icon is-ready" aria-hidden="true"></span>
        <strong>Ready</strong>
        <small>Workspace online</small>
      </div>
    </div>
  </div>

  {#if activeSession}
    <CallSession session={activeSession}>
      <svelte:fragment slot="actions">
        <Button
          type="button"
          variant="danger"
          ariaLabel="End active call"
          loading={isEndingCall}
          on:click={handleEndActiveCall}
        >
          End call
        </Button>
      </svelte:fragment>
    </CallSession>
  {/if}

  <div class="content-grid">
    <article class="panel primary-panel" aria-labelledby="initiate-title">
      <div class="panel-header">
        <div class="panel-title">
          <span class="panel-icon" aria-hidden="true">
            <span></span>
          </span>
          <div>
            <p class="panel-kicker">Outbound</p>
            <h3 id="initiate-title">Initiate call</h3>
          </div>
        </div>
        <span class="pill">{callType}</span>
      </div>

      <form class="form" on:submit|preventDefault={handleInitiateCall} novalidate>
        <label class="field" for="call-mode">
          <span>Call mode</span>
          <select id="call-mode" bind:value={callMode} disabled={isSubmitting}>
            <option value="one-to-one">One-to-One Call</option>
            <option value="conference">Conference Call</option>
          </select>
        </label>

        <Input
          id="callee-id"
          name="calleeId"
          label={callMode === 'one-to-one' ? 'Callee User ID' : 'Callee User IDs (comma-separated)'}
          bind:value={calleeId}
          error={fieldError}
          placeholder={callMode === 'one-to-one' ? 'e.g. 1001' : 'e.g. 1001, 1002, 1003'}
          disabled={isSubmitting}
          required
          on:input={() => {
            fieldError = '';
            statusMessage = '';
          }}
        />

        <label class="field" for="call-type">
          <span>Call type</span>
          <select id="call-type" bind:value={callType} disabled={isSubmitting}>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>
        </label>

        <div class="recording-row">
          <label class="recording-label">
            <input type="checkbox" bind:checked={isRecording} disabled={isSubmitting} />
            <span>Enable Call Recording</span>
          </label>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting}>Initiate call</Button>
      </form>

      <CallStatus message={statusMessage} variant={statusVariant} />
      {#if !videoAvailable}
        <div class="video-warning">
          <p>Camera is currently in use by another application. Video is disabled.</p>
          <Button type="button" on:click={retryVideo}>Retry video</Button>
        </div>
      {/if}

    </article>

    <article class="panel secondary-panel" aria-labelledby="accept-title">
      <div class="panel-header">
        <div class="panel-title">
          <span class="panel-icon inbound" aria-hidden="true">
            <span></span>
          </span>
          <div>
            <p class="panel-kicker">Inbound</p>
            <h3 id="accept-title">Accept call</h3>
          </div>
        </div>
      </div>
      <AcceptCallForm on:accepted={handleAcceptedCall} />
    </article>
  </div>
</section>

<style lang="postcss">
  .workspace {
    display: grid;
    gap: var(--space-lg);
  }

  .hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-lg);
    align-items: end;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent);
    border-radius: var(--radius-md);
    background:
      radial-gradient(circle at 90% 10%, color-mix(in srgb, var(--color-secondary) 22%, transparent), transparent 18rem),
      linear-gradient(135deg, var(--color-surface) 0%, #eef7f5 100%);
    padding: clamp(1.25rem, 3vw, 2rem);
    box-shadow: 0 1.25rem 3rem rgb(23 32 38 / 10%);
  }

  .hero::before,
  .hero::after {
    content: '';
    position: absolute;
    border: 1px solid color-mix(in srgb, var(--color-secondary) 28%, transparent);
    border-radius: 999px;
    pointer-events: none;
  }

  .hero::before {
    inline-size: 16rem;
    block-size: 16rem;
    inset-block-start: -9rem;
    inset-inline-end: -4rem;
  }

  .hero::after {
    inline-size: 9rem;
    block-size: 9rem;
    inset-block-end: -5rem;
    inset-inline-end: 9rem;
    border-color: color-mix(in srgb, var(--color-tertiary) 24%, transparent);
  }

  .hero-copy,
  .hero-metrics {
    position: relative;
    z-index: 1;
  }

  .hero-copy {
    display: grid;
    gap: var(--space-xs);
    max-inline-size: 42rem;
  }

  .hero-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(7rem, 1fr));
    gap: var(--space-sm);
  }

  .eyebrow,
  h2,
  h3,
  p,
  .metric strong,
  .metric small,
  .panel-kicker {
    margin: 0;
  }

  .eyebrow {
    color: var(--color-tertiary);
    font-size: 0.78rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  h2 {
    margin-block-start: var(--space-xs);
    color: var(--color-text);
    font-size: clamp(2rem, 4vw, 3.25rem);
    line-height: 1.1;
  }

  h3 {
    color: var(--color-text);
    font-size: 1.05rem;
    line-height: 1.3;
  }

  p {
    color: var(--color-muted);
    line-height: 1.5;
  }

  .metric {
    display: grid;
    gap: 0.22rem;
    min-inline-size: 8rem;
    border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 72%);
    padding: var(--space-md);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 72%);
  }

  .metric-icon {
    inline-size: 0.75rem;
    block-size: 0.75rem;
    border-radius: 999px;
    background: var(--color-secondary);
    box-shadow: 0 0 0 0.38rem color-mix(in srgb, var(--color-secondary) 16%, transparent);
  }

  .metric-icon.is-ready {
    background: var(--color-tertiary);
    box-shadow: 0 0 0 0.38rem color-mix(in srgb, var(--color-tertiary) 16%, transparent);
  }

  .metric strong {
    color: var(--color-text);
    font-size: 1rem;
    text-transform: capitalize;
  }

  .metric small {
    color: var(--color-muted);
    font-size: 0.78rem;
    font-weight: 700;
  }

  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.85fr);
    gap: var(--space-lg);
    align-items: start;
  }

  .panel {
    position: relative;
    display: grid;
    gap: var(--space-lg);
    margin: 0;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-border) 82%, transparent);
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 82%);
    padding: var(--space-lg);
    box-shadow: 0 1rem 2.5rem rgb(23 32 38 / 8%);
  }

  .panel::before {
    content: '';
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
    block-size: 0.25rem;
    background: linear-gradient(90deg, var(--color-secondary), var(--color-tertiary));
  }

  .secondary-panel::before {
    background: linear-gradient(90deg, var(--color-tertiary), var(--color-primary));
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .panel-icon {
    position: relative;
    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-secondary) 12%, var(--color-surface));
  }

  .panel-icon::before,
  .panel-icon::after,
  .panel-icon span {
    content: '';
    position: absolute;
    background: var(--color-secondary);
  }

  .panel-icon::before {
    inline-size: 1.05rem;
    block-size: 1.05rem;
    border-radius: 999px;
    inset-inline-start: 0.55rem;
  }

  .panel-icon::after {
    inline-size: 1.05rem;
    block-size: 1.05rem;
    border-radius: 999px;
    inset-inline-end: 0.55rem;
  }

  .panel-icon span {
    inline-size: 1.2rem;
    block-size: 2px;
    border-radius: 999px;
  }

  .panel-icon.inbound {
    background: color-mix(in srgb, var(--color-tertiary) 12%, var(--color-surface));
  }

  .panel-icon.inbound::before,
  .panel-icon.inbound::after,
  .panel-icon.inbound span {
    background: var(--color-tertiary);
  }

  .panel-kicker {
    color: var(--color-muted);
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  .pill {
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-tertiary) 10%, var(--color-surface));
    color: var(--color-tertiary);
    font-size: 0.78rem;
    font-weight: 800;
    padding: 0.3rem 0.65rem;
    text-transform: uppercase;
  }

  .form {
    display: grid;
    gap: var(--space-md);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-background) 55%, var(--color-surface));
    padding: var(--space-md);
  }

  .field {
    display: grid;
    gap: var(--space-xs);
    color: var(--color-text);
    font-size: 0.925rem;
    font-weight: 700;
  }

  .recording-row {
    display: flex;
    align-items: center;
    padding: var(--space-xs) 0;
  }

  .recording-label {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text);
    cursor: pointer;
  }

  .recording-label input {
    inline-size: 1.15rem;
    block-size: 1.15rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    cursor: pointer;
  }

  select {
    inline-size: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 1rem;
    line-height: 1.4;
    padding: 0.75rem var(--space-md);
  }

  select {
    min-block-size: 2.75rem;
  }

  select:focus {
    border-color: var(--color-secondary);
    outline: none;
    box-shadow:
      0 0 0 2px var(--color-background),
      0 0 0 5px color-mix(in srgb, var(--color-secondary) 24%, transparent);
  }

  select:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  @media (max-width: 980px) {
    .hero {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .hero-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .content-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 560px) {
    .hero-metrics {
      grid-template-columns: 1fr;
    }

    .panel-header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
