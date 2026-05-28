<script lang="ts" context="module">
  import type { CallType } from '$lib/api/calls.api';

  export interface ActiveCallSession {
    callId: string | null;
    callType: CallType;
    recipients: string[];
    initiatedAt: Date;
    roomName?: string;
  }
</script>

<script lang="ts">
  import { ConnectionState, Track } from 'livekit-client';
  import { createEventDispatcher } from 'svelte';
  import { callStore } from '$lib/stores/call.store';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import LiveKitTrack from './LiveKitTrack.svelte';
  import { onDestroy } from 'svelte';

  export let session: ActiveCallSession;
  export let isEndingCall = false;

  const dispatch = createEventDispatcher<{ endCall: void }>();

  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let isRecordingCall = false;
  let recordingTime = 0;
  let recordingInterval: any;
  let isTogglingAudio = false;
  let isTogglingVideo = false;
  let controlError = '';

  onDestroy(() => {
    if (isRecordingCall) {
      stopRecordingMedia();
    }
  });

  function startRecordingMedia() {
    recordedChunks = [];
    const tracksToRecord: MediaStreamTrack[] = [];

    const localAudioTrack = $callStore.localParticipant?.tracks.find(
      (item) => item.kind === Track.Kind.Audio && item.track
    )?.track?.mediaStreamTrack;
    if (localAudioTrack) tracksToRecord.push(localAudioTrack);

    if (localVideoTrack?.mediaStreamTrack) {
      tracksToRecord.push(localVideoTrack.mediaStreamTrack);
    }

    $callStore.remoteParticipants.forEach((p) => {
      p.tracks.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) {
          tracksToRecord.push(pub.track.mediaStreamTrack);
        }
      });
    });

    if (tracksToRecord.length === 0) {
      alert("No active media tracks found to record.");
      return;
    }

    const stream = new MediaStream(tracksToRecord);
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    } catch (e) {
      mediaRecorder = new MediaRecorder(stream);
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `agcloud-call-${session.callId || 'session'}-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    };

    mediaRecorder.start();
    isRecordingCall = true;
    recordingTime = 0;
    recordingInterval = setInterval(() => {
      recordingTime += 1;
    }, 1000);

    if (session.callId) {
      import('$lib/api/calls.api').then(({ startRecording }) => {
        startRecording(session.callId!).catch(console.error);
      });
    }
  }

  function stopRecordingMedia() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecordingCall = false;
    clearInterval(recordingInterval);

    if (session.callId) {
      import('$lib/api/calls.api').then(({ stopRecording }) => {
        stopRecording(session.callId!).catch(console.error);
      });
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function toggleMicrophone() {
    if (isTogglingAudio || !isConnected) return;

    isTogglingAudio = true;
    controlError = '';

    try {
      await liveKitClient.setMicrophoneEnabled(!isMicrophoneEnabled);
      if ($callStore.room) {
        callStore.syncRoom($callStore.room);
      }
    } catch (error) {
      controlError = getMediaControlError(error, 'microphone');
    } finally {
      isTogglingAudio = false;
    }
  }

  async function toggleCamera() {
    if (isTogglingVideo || !isConnected) return;

    isTogglingVideo = true;
    controlError = '';

    try {
      const publication = await liveKitClient.setCameraEnabled(!isCameraEnabled);
      if (!publication && !isCameraEnabled) {
        controlError = 'Camera unavailable. Check browser permissions or close other apps using the camera.';
      }
      if ($callStore.room) {
        callStore.syncRoom($callStore.room);
      }
    } catch (error) {
      controlError = getMediaControlError(error, 'camera');
    } finally {
      isTogglingVideo = false;
    }
  }

  function getMediaControlError(error: unknown, device: 'microphone' | 'camera') {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return `${capitalize(device)} permission was denied. Allow access in the browser and try again.`;
      }

      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return `No ${device} device was found.`;
      }

      if (error.name === 'NotReadableError' || error.name === 'AbortError') {
        return `The ${device} is already in use or unavailable.`;
      }
    }

    return error instanceof Error && error.message.length > 0
      ? error.message
      : `Unable to update ${device}.`;
  }

  function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  $: localVideoTrack = $callStore.localParticipant?.tracks.find(
    (item) => item.kind === Track.Kind.Video && item.track && !item.isMuted
  )?.track;
  $: localAudioPublication = $callStore.localParticipant?.tracks.find(
    (item) => item.kind === Track.Kind.Audio && item.source === Track.Source.Microphone
  );
  $: localVideoPublication = $callStore.localParticipant?.tracks.find(
    (item) => item.kind === Track.Kind.Video && item.source === Track.Source.Camera
  );
  $: isMicrophoneEnabled = Boolean(localAudioPublication && !localAudioPublication.isMuted);
  $: isCameraEnabled = Boolean(localVideoPublication && !localVideoPublication.isMuted && localVideoPublication.track);
  $: remoteVideoTracks = $callStore.remoteParticipants.flatMap((participant) =>
    participant.tracks
      .filter((item) => item.kind === Track.Kind.Video && item.track && !item.isMuted)
      .map((item) => ({
        id: item.sid,
        participant: participant.name ?? participant.identity,
        track: item.track
      }))
  );
  $: remoteVideoPublicationCount = $callStore.remoteParticipants.reduce(
    (count, participant) =>
      count + participant.tracks.filter((item) => item.kind === Track.Kind.Video).length,
    0
  );
  $: remoteAudioTracks = $callStore.remoteParticipants.flatMap((participant) =>
    participant.tracks
      .filter((item) => item.kind === Track.Kind.Audio && item.track)
      .map((item) => ({
        id: item.sid,
        participant: participant.name ?? participant.identity,
        track: item.track
      }))
  );
  $: remoteParticipantStates = $callStore.remoteParticipants.map((participant) => {
    const name = participant.name ?? participant.identity;
    const audioPublication = participant.tracks.find(
      (item) => item.kind === Track.Kind.Audio && item.source === Track.Source.Microphone
    );
    const videoPublication = participant.tracks.find(
      (item) => item.kind === Track.Kind.Video && item.source === Track.Source.Camera
    );

    return {
      id: participant.sid || participant.identity,
      name,
      isMicrophoneMuted: Boolean(audioPublication?.isMuted),
      isCameraOff: !videoPublication || videoPublication.isMuted || !videoPublication.track
    };
  });
  $: isConnected = $callStore.connectionState === ConnectionState.Connected;
  $: participantCount = $callStore.remoteParticipants.length;
  $: remoteTrackCount = remoteVideoTracks.length + remoteAudioTracks.length;
</script>

<section class="session" aria-labelledby="active-call-title" aria-label="Call in progress">
  <div class="session-header">
    <div>
      <p class="eyebrow">Call in progress</p>
      <h3 id="active-call-title">{isConnected ? 'Active Call' : 'Waiting for response'}</h3>
      <p class="connection-state">
        {$callStore.connectionState}
        {#if session.roomName}
          <span>Room {session.roomName}</span>
        {/if}
      </p>
      {#if isRecordingCall}
        <div class="recording-badge" aria-live="polite">
          <span class="recording-dot"></span>
          <span>Recording: {formatTime(recordingTime)}</span>
        </div>
      {/if}
    </div>
    <div class="header-actions">
      {#if isConnected}
        {#if !isRecordingCall}
          <button class="rec-btn" on:click={startRecordingMedia}>
            <svg class="rec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2"/>
              <circle cx="12" cy="12" r="4" fill="currentColor"/>
            </svg>
            <span>Record Call</span>
          </button>
        {:else}
          <button class="rec-btn is-recording" on:click={stopRecordingMedia}>
            <svg class="rec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2"/>
              <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
            </svg>
            <span>Stop Rec</span>
          </button>
        {/if}
      {/if}
      <slot name="actions" />
    </div>
  </div>

  <div class="stage">
    <article class="local-panel" aria-label="Your side">
      <div class="media-tile local-media">
        {#if localVideoTrack}
          <LiveKitTrack track={localVideoTrack} label="Your video preview" muted mirror />
        {:else}
          <div class="empty-media">
            <strong>{isConnected && !isCameraEnabled ? 'Camera off' : session.callType === 'video' ? 'Starting your camera' : 'Audio connected'}</strong>
            <span>{isConnected ? (isCameraEnabled ? 'Publishing local media...' : 'Your video is not being sent.') : 'Connecting to room...'}</span>
          </div>
        {/if}
      </div>
      <div class="panel-footer">
        <span>{isMicrophoneEnabled ? 'Microphone on' : 'Microphone muted'} · {isCameraEnabled ? 'Camera on' : 'Camera off'}</span>
        {#if session.callId}
          <strong>{session.callId}</strong>
        {/if}
      </div>
    </article>

    <article class="waiting-panel" aria-label="Opposite side">
      {#each remoteAudioTracks as item (item.id)}
        <LiveKitTrack track={item.track} label={`${item.participant} audio`} />
      {/each}

      {#if remoteVideoTracks.length > 0}
        <div class="remote-grid">
          {#each remoteVideoTracks as item (item.id)}
            <div class="media-tile">
              <LiveKitTrack track={item.track} label={`${item.participant} video`} />
              <span class="participant-name">{item.participant}</span>
              {#each remoteParticipantStates.filter((state) => state.name === item.participant) as state (state.id)}
                {#if state.isMicrophoneMuted || state.isCameraOff}
                  <div class="remote-indicators" aria-live="polite">
                    {#if state.isMicrophoneMuted}
                      <span>Microphone muted</span>
                    {/if}
                    {#if state.isCameraOff}
                      <span>Camera off</span>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      {:else}
        <div class="waiting-card">
          <span class="pulse" aria-hidden="true"></span>
          <p class="eyebrow">Opposite side</p>
          <h4>Waiting for the other user to accept</h4>
          <p class="copy">
            {remoteVideoPublicationCount > 0
              ? 'The other user has published video. Waiting for the browser to subscribe to the video stream.'
              : 'The call request has been sent. This side will show video when the recipient joins and publishes media.'}
          </p>
          <p class="copy diagnostics">
            Remote participants: {participantCount}. Remote tracks: {remoteTrackCount}.
          </p>
          <div class="recipient-list" aria-label="Waiting recipients">
            {#each remoteParticipantStates.length > 0 ? remoteParticipantStates : session.recipients.map((recipient) => ({ id: recipient, name: recipient, isMicrophoneMuted: false, isCameraOff: false })) as participant}
              <span>{participant.name}</span>
            {/each}
          </div>
          {#if remoteParticipantStates.some((state) => state.isMicrophoneMuted || state.isCameraOff)}
            <div class="state-list" aria-live="polite">
              {#each remoteParticipantStates as state (state.id)}
                {#if state.isMicrophoneMuted}
                  <span>{state.name}: Microphone muted</span>
                {/if}
                {#if state.isCameraOff}
                  <span>{state.name}: Camera off</span>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </article>
  </div>

  {#if controlError}
    <p class="control-error" role="alert">{controlError}</p>
  {/if}

  <div class="call-controls" aria-label="Call controls">
    <button
      type="button"
      class:active={!isMicrophoneEnabled}
      disabled={!isConnected || isTogglingAudio}
      aria-pressed={!isMicrophoneEnabled}
      aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
      on:click={toggleMicrophone}
    >
      <span class="control-icon" aria-hidden="true">
        {#if isMicrophoneEnabled}
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
            <path d="M19 11a7 7 0 0 1-14 0" />
            <path d="M12 18v4" />
            <path d="M8 22h8" />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 14a3 3 0 0 0 3-3V9" />
            <path d="M9 9v2a3 3 0 0 0 4.6 2.5" />
            <path d="M19 11a7 7 0 0 1-10.4 6.1" />
            <path d="M5 11a7 7 0 0 0 7 7" />
            <path d="M12 18v4" />
            <path d="M8 22h8" />
            <path d="M4 4l16 16" />
          </svg>
        {/if}
      </span>
      <span>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</span>
    </button>

    <button
      type="button"
      class:active={!isCameraEnabled}
      disabled={!isConnected || isTogglingVideo}
      aria-pressed={!isCameraEnabled}
      aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
      on:click={toggleCamera}
    >
      <span class="control-icon" aria-hidden="true">
        {#if isCameraEnabled}
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M15 10l5-3v10l-5-3" />
            <path d="M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M10.7 6H13a2 2 0 0 1 2 2v2.3" />
            <path d="M15 14l5 3V7l-3.2 1.9" />
            <path d="M2 8a2 2 0 0 1 2-2h2" />
            <path d="M2 12v4a2 2 0 0 0 2 2h9a2 2 0 0 0 1.1-.3" />
            <path d="M4 4l16 16" />
          </svg>
        {/if}
      </span>
      <span>{isCameraEnabled ? 'Video off' : 'Video on'}</span>
    </button>

    <button
      type="button"
      class="end-control"
      aria-label="End call"
      disabled={isEndingCall}
      on:click={() => dispatch('endCall')}
    >
      <span class="control-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />
        </svg>
      </span>
      <span>End call</span>
    </button>
  </div>
</section>

<style lang="postcss">
  .session {
    display: grid;
    gap: var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    padding: var(--space-lg);
    box-shadow: 0 1rem 2.5rem rgb(23 32 38 / 8%);
  }

  .session-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .eyebrow,
  h3,
  h4,
  .copy,
  .connection-state {
    margin: 0;
  }

  .eyebrow {
    color: var(--color-tertiary);
    font-size: 0.78rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  h3 {
    margin-block-start: var(--space-xs);
    color: var(--color-text);
    font-size: 1.35rem;
    line-height: 1.2;
  }

  .connection-state {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    margin-block-start: var(--space-xs);
    color: var(--color-muted);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .connection-state span {
    overflow-wrap: anywhere;
  }

  .stage {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(18rem, 0.7fr);
    gap: var(--space-lg);
    align-items: stretch;
  }

  .local-panel,
  .waiting-panel {
    display: grid;
    gap: var(--space-md);
    margin: 0;
  }

  .media-tile {
    position: relative;
    min-block-size: clamp(18rem, 42vw, 32rem);
    overflow: hidden;
    border-radius: var(--radius-md);
    background: #101820;
  }

  .empty-media {
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--space-sm);
    min-block-size: inherit;
    color: var(--color-surface);
    padding: var(--space-lg);
    text-align: center;
  }

  .empty-media span {
    color: rgb(255 255 255 / 72%);
  }

  .panel-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    color: var(--color-muted);
    font-size: 0.925rem;
  }

  .panel-footer strong {
    color: var(--color-text);
    overflow-wrap: anywhere;
  }

  .waiting-panel {
    min-block-size: 100%;
  }

  .remote-grid {
    display: grid;
    gap: var(--space-md);
    min-block-size: 100%;
  }

  .participant-name {
    position: absolute;
    inset-block-end: var(--space-md);
    inset-inline-start: var(--space-md);
    border-radius: 999px;
    background: rgb(16 24 32 / 72%);
    color: var(--color-surface);
    font-size: 0.85rem;
    font-weight: 800;
    padding: 0.35rem 0.7rem;
  }

  .waiting-card {
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--space-md);
    min-block-size: 100%;
    border: 1px dashed color-mix(in srgb, var(--color-secondary) 45%, var(--color-border));
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-secondary) 5%, var(--color-surface));
    padding: clamp(1.25rem, 3vw, 2rem);
    text-align: center;
  }

  .pulse {
    inline-size: 4.25rem;
    block-size: 4.25rem;
    border-radius: 999px;
    background: var(--color-secondary);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-secondary) 35%, transparent);
    animation: pulse 1500ms ease-out infinite;
  }

  h4 {
    color: var(--color-text);
    font-size: 1.25rem;
    line-height: 1.2;
  }

  .copy {
    max-inline-size: 24rem;
    color: var(--color-muted);
    line-height: 1.5;
  }

  .diagnostics {
    font-size: 0.875rem;
  }

  .recipient-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-sm);
  }

  .recipient-list span {
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-surface);
    color: var(--color-muted);
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
  }

  .state-list,
  .remote-indicators {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-xs);
  }

  .state-list span,
  .remote-indicators span {
    border-radius: 999px;
    background: rgb(16 24 32 / 78%);
    color: var(--color-surface);
    font-size: 0.78rem;
    font-weight: 800;
    padding: 0.28rem 0.58rem;
  }

  .remote-indicators {
    position: absolute;
    inset-block-start: var(--space-md);
    inset-inline-start: var(--space-md);
    justify-content: flex-start;
  }

  .control-error {
    margin: 0;
    border: 1px solid color-mix(in srgb, #b42318 28%, var(--color-border));
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, #b42318 7%, var(--color-surface));
    color: #b42318;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 0.65rem 0.8rem;
  }

  .call-controls {
    position: sticky;
    inset-block-end: var(--space-md);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-md);
    border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 88%);
    padding: var(--space-md);
    box-shadow: 0 0.75rem 2rem rgb(23 32 38 / 12%);
    backdrop-filter: blur(12px);
    z-index: 2;
  }

  .call-controls button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    min-inline-size: 8.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.92rem;
    font-weight: 800;
    min-block-size: 3rem;
    padding: 0.65rem 0.9rem;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .call-controls button:hover:not(:disabled) {
    border-color: var(--color-secondary);
    transform: translateY(-1px);
  }

  .call-controls button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .call-controls button.active {
    border-color: color-mix(in srgb, #b42318 38%, var(--color-border));
    background: color-mix(in srgb, #b42318 8%, var(--color-surface));
    color: #b42318;
  }

  .call-controls .end-control {
    border-color: #b42318;
    background: #b42318;
    color: var(--color-surface);
  }

  .control-icon {
    display: inline-grid;
    place-items: center;
    inline-size: 1.6rem;
    block-size: 1.6rem;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 10%, transparent);
  }

  .control-icon svg {
    inline-size: 1.05rem;
    block-size: 1.05rem;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  @keyframes pulse {
    70% {
      box-shadow: 0 0 0 1.5rem color-mix(in srgb, var(--color-secondary) 0%, transparent);
    }

    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-secondary) 0%, transparent);
    }
  }

  @media (max-width: 980px) {
    .stage {
      grid-template-columns: 1fr;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .recording-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    margin-block-start: var(--space-xs);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, #b42318 10%, transparent);
    color: #b42318;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 0.3rem 0.6rem;
  }

  .recording-dot {
    inline-size: 0.55rem;
    block-size: 0.55rem;
    border-radius: 999px;
    background: #b42318;
    box-shadow: 0 0 0 0 rgb(180 35 24 / 56%);
    animation: pulse-red 1.5s ease-out infinite;
  }

  @keyframes pulse-red {
    70% {
      box-shadow: 0 0 0 0.4rem rgb(180 35 24 / 0%);
    }
    100% {
      box-shadow: 0 0 0 0 rgb(180 35 24 / 0%);
    }
  }

  .rec-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9rem;
    font-weight: 700;
    padding: 0.5rem 0.85rem;
    cursor: pointer;
    transition: all 160ms ease;
  }

  .rec-btn:hover {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  }

  .rec-btn.is-recording {
    border-color: #b42318;
    background: color-mix(in srgb, #b42318 8%, transparent);
    color: #b42318;
  }

  .rec-icon {
    inline-size: 1.15rem;
    block-size: 1.15rem;
  }

  @media (max-width: 560px) {
    .session-header,
    .header-actions,
    .panel-footer,
    .call-controls {
      align-items: stretch;
      flex-direction: column;
    }

    .call-controls button {
      inline-size: 100%;
    }
  }
</style>
