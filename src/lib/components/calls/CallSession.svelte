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
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { callStore } from '$lib/stores/call.store';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import LiveKitTrack from './LiveKitTrack.svelte';
  import ParticipantTile from './ParticipantTile.svelte';
  import RoomIdChip from './RoomIdChip.svelte';

  export let session: ActiveCallSession;
  export let isEndingCall = false;

  const dispatch = createEventDispatcher<{ endCall: void }>();

  // ── Recording state ────────────────────────────────
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let isRecordingCall = false;
  let recordingTime = 0;
  let recordingInterval: ReturnType<typeof setInterval> | null = null;

  // ── Media toggle state ─────────────────────────────
  let isTogglingAudio = false;
  let isTogglingVideo = false;
  let controlError = '';

  // ── Elapsed call timer ─────────────────────────────
  let elapsedSeconds = 0;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    elapsedSeconds = 0;
    elapsedTimer = setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - session.initiatedAt.getTime()) / 1000);
    }, 1000);
  });

  onDestroy(() => {
    if (isRecordingCall) stopRecordingMedia();
    if (elapsedTimer) clearInterval(elapsedTimer);
  });

  // ── Recording ──────────────────────────────────────
  function startRecordingMedia() {
    recordedChunks = [];
    const tracksToRecord: MediaStreamTrack[] = [];
    const localAudioTrack = $callStore.localParticipant?.tracks.find(
      (item) => item.kind === Track.Kind.Audio && item.track
    )?.track?.mediaStreamTrack;
    if (localAudioTrack) tracksToRecord.push(localAudioTrack);
    if (localVideoTrack?.mediaStreamTrack) tracksToRecord.push(localVideoTrack.mediaStreamTrack);
    $callStore.remoteParticipants.forEach((p) => {
      p.tracks.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) tracksToRecord.push(pub.track.mediaStreamTrack);
      });
    });
    if (tracksToRecord.length === 0) { alert('No active media tracks found to record.'); return; }
    const stream = new MediaStream(tracksToRecord);
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    } catch {
      mediaRecorder = new MediaRecorder(stream);
    }
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `agcloud-call-${session.callId ?? 'session'}-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    };
    mediaRecorder.start();
    isRecordingCall = true;
    recordingTime = 0;
    recordingInterval = setInterval(() => { recordingTime += 1; }, 1000);
    if (session.callId) {
      import('$lib/api/calls.api').then(({ startRecording }) => {
        startRecording(session.callId!).catch(console.error);
      });
    }
  }

  function stopRecordingMedia() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    isRecordingCall = false;
    if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null; }
    if (session.callId) {
      import('$lib/api/calls.api').then(({ stopRecording }) => {
        stopRecording(session.callId!).catch(console.error);
      });
    }
  }

  // ── Helpers ────────────────────────────────────────
  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function formatElapsed(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function getMediaControlError(error: unknown, device: 'microphone' | 'camera') {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
        return `${device.charAt(0).toUpperCase() + device.slice(1)} permission denied. Allow access in browser settings.`;
      if (error.name === 'NotFoundError') return `No ${device} found.`;
      if (error.name === 'NotReadableError' || error.name === 'AbortError')
        return `${device.charAt(0).toUpperCase() + device.slice(1)} is already in use.`;
    }
    return error instanceof Error ? error.message : `Unable to update ${device}.`;
  }

  // ── Media toggles ──────────────────────────────────
  async function toggleMicrophone() {
    if (isTogglingAudio || !isConnected) return;
    isTogglingAudio = true;
    controlError = '';
    try {
      await liveKitClient.setMicrophoneEnabled(!isMicrophoneEnabled);
      if ($callStore.room) callStore.syncRoom($callStore.room);
    } catch (e) {
      controlError = getMediaControlError(e, 'microphone');
    } finally {
      isTogglingAudio = false;
    }
  }

  async function toggleCamera() {
    if (isTogglingVideo || !isConnected) return;
    isTogglingVideo = true;
    controlError = '';
    try {
      const pub = await liveKitClient.setCameraEnabled(!isCameraEnabled);
      if (!pub && !isCameraEnabled)
        controlError = 'Camera unavailable. Check browser permissions.';
      if ($callStore.room) callStore.syncRoom($callStore.room);
    } catch (e) {
      controlError = getMediaControlError(e, 'camera');
    } finally {
      isTogglingVideo = false;
    }
  }

  // ── Reactive state ─────────────────────────────────
  $: localVideoTrack = $callStore.localParticipant?.tracks.find(
    (t) => t.kind === Track.Kind.Video && t.track && !t.isMuted
  )?.track;
  $: localAudioPublication = $callStore.localParticipant?.tracks.find(
    (t) => t.kind === Track.Kind.Audio && t.source === Track.Source.Microphone
  );
  $: localVideoPublication = $callStore.localParticipant?.tracks.find(
    (t) => t.kind === Track.Kind.Video && t.source === Track.Source.Camera
  );
  $: isMicrophoneEnabled = Boolean(localAudioPublication && !localAudioPublication.isMuted);
  $: isCameraEnabled = Boolean(localVideoPublication && !localVideoPublication.isMuted && localVideoPublication.track);
  $: isLocalSpeaking = Boolean($callStore.localParticipant?.isSpeaking);

  // Remote audio (for playback — rendered as hidden audio elements)
  $: remoteAudioTracks = $callStore.remoteParticipants.flatMap((p) =>
    p.tracks
      .filter((t) => t.kind === Track.Kind.Audio && t.track)
      .map((t) => ({ id: t.sid, participant: p.name ?? p.identity, track: t.track }))
  );

  // Remote participant tiles
  $: remoteTiles = $callStore.remoteParticipants.map((p) => {
    const name = p.name ?? p.identity;
    const videoTrack = p.tracks.find(
      (t) => t.kind === Track.Kind.Video && t.track && !t.isMuted
    )?.track;
    const videoPublication = p.tracks.find(
      (t) => t.kind === Track.Kind.Video && t.source === Track.Source.Camera
    );
    const audioPublication = p.tracks.find(
      (t) => t.kind === Track.Kind.Audio && t.source === Track.Source.Microphone
    );
    return {
      id: p.sid || p.identity,
      name,
      videoTrack,
      isMuted: Boolean(audioPublication?.isMuted),
      isCameraOff: !videoPublication || videoPublication.isMuted || !videoPublication.track,
      isActive: $callStore.activeSpeakers.includes(p.identity)
    };
  });

  $: isConnected = $callStore.connectionState === ConnectionState.Connected;
  $: totalParticipants = 1 + remoteTiles.length;
  $: gridCols = totalParticipants <= 1 ? 1 : totalParticipants <= 4 ? 2 : 3;
  $: roomDisplayId = session.roomName ?? session.callId ?? 'N/A';
</script>

<!-- Full-screen meeting room overlay -->
<div class="meeting-room" aria-label="Meeting room">

  <!-- Hidden audio tracks -->
  <div class="audio-sink" aria-hidden="true">
    {#each remoteAudioTracks as item (item.id)}
      <LiveKitTrack track={item.track} label="{item.participant} audio" />
    {/each}
  </div>

  <!-- ── Top header bar ──────────────────────────── -->
  <header class="meeting-header">
    <div class="header-left">
      <!-- Brand mark -->
      <div class="brand-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
          <path d="M4.5 6.5C4.5 5.12 5.62 4 7 4H15C16.38 4 17.5 5.12 17.5 6.5C17.5 7.88 16.38 9 15 9H13L9.5 12.5V9H7C5.62 9 4.5 7.88 4.5 6.5Z" fill="#7ecfff" opacity="0.9"/>
          <circle cx="16" cy="16" r="4.5" fill="#7ecfff" opacity="0.35"/>
          <circle cx="16" cy="16" r="2.5" fill="#7ecfff"/>
        </svg>
      </div>
      <div class="header-title">
        <span class="meeting-title">One-to-One Call</span>
        <span class="connection-badge" class:connected={isConnected}>
          {isConnected ? 'Connected' : $callStore.connectionState}
        </span>
      </div>
    </div>

    <div class="header-center">
      <RoomIdChip roomId={roomDisplayId} />
    </div>

    <div class="header-right">
      <!-- Elapsed time -->
      <div class="elapsed-time" aria-label="Call duration">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {formatElapsed(elapsedSeconds)}
      </div>
      <!-- Participant count -->
      <div class="participant-count" aria-label="{totalParticipants} participants">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M1 14a5 5 0 0110 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <circle cx="12" cy="5" r="2" stroke="currentColor" stroke-width="1.3"/>
          <path d="M13.5 14a3 3 0 012 2.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        {totalParticipants}
      </div>

      <!-- Recording badge -->
      {#if isRecordingCall}
        <div class="rec-badge" aria-live="polite" title="Recording: {formatTime(recordingTime)}">
          <span class="rec-dot" aria-hidden="true"></span>
          <span>REC {formatTime(recordingTime)}</span>
        </div>
      {/if}
    </div>
  </header>

  <!-- ── Video stage ─────────────────────────────── -->
  <main class="video-stage" aria-label="Participants">
    <div
      class="participants-grid"
      style="--cols: {gridCols}"
      aria-label="{totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}"
    >
      <!-- Local tile -->
      <ParticipantTile
        track={localVideoTrack}
        name="You"
        label="Your video"
        isActive={isLocalSpeaking}
        isMuted={!isMicrophoneEnabled}
        isCameraOff={!isCameraEnabled}
        mirror={true}
        isLocal={true}
      />

      <!-- Remote tiles -->
      {#each remoteTiles as tile (tile.id)}
        <ParticipantTile
          track={tile.videoTrack}
          name={tile.name}
          label="{tile.name} video"
          isActive={tile.isActive}
          isMuted={tile.isMuted}
          isCameraOff={tile.isCameraOff}
        />
      {/each}
    </div>

    <!-- Waiting overlay (shown when no remote participants yet) -->
    {#if remoteTiles.length === 0}
      <div class="waiting-overlay" aria-live="polite">
        <div class="waiting-content">
          <div class="waiting-ring" aria-hidden="true">
            <div class="waiting-pulse"></div>
          </div>
          <p class="waiting-label">Waiting for others to join</p>
          <p class="waiting-hint">
            Share the room ID with {session.recipients.join(', ')} to invite them
          </p>
        </div>
      </div>
    {/if}
  </main>

  <!-- Control error (above controls bar) -->
  {#if controlError}
    <div class="control-error" role="alert">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 5v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
      </svg>
      {controlError}
      <button type="button" class="error-dismiss" on:click={() => (controlError = '')}>✕</button>
    </div>
  {/if}

  <!-- ── Bottom controls bar ─────────────────────── -->
  <div class="controls-bar" aria-label="Meeting controls">
    <!-- Left group -->
    <div class="ctrl-group">
      <!-- Mic -->
      <button
        type="button"
        class="ctrl-btn"
        class:ctrl-off={!isMicrophoneEnabled}
        disabled={!isConnected || isTogglingAudio}
        aria-pressed={!isMicrophoneEnabled}
        aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
        title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        on:click={toggleMicrophone}
      >
        {#if isMicrophoneEnabled}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M19 10a7 7 0 01-14 0M12 19v3M8 22h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v3M8 22h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
        <span>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</span>
      </button>

      <!-- Camera -->
      <button
        type="button"
        class="ctrl-btn"
        class:ctrl-off={!isCameraEnabled}
        disabled={!isConnected || isTogglingVideo}
        aria-pressed={!isCameraEnabled}
        aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
        title={isCameraEnabled ? 'Camera off' : 'Camera on'}
        on:click={toggleCamera}
      >
        {#if isCameraEnabled}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 10l5-3v10l-5-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="2" y="6" width="11" height="12" rx="2" stroke="currentColor" stroke-width="2"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M10.7 6H13a2 2 0 012 2v2.3M15 14l5 3V7l-3.2 1.9M2 8a2 2 0 012-2h2M2 12v4a2 2 0 002 2h9a2 2 0 001.1-.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
        <span>{isCameraEnabled ? 'Cam off' : 'Cam on'}</span>
      </button>
    </div>

    <!-- Center: end call -->
    <button
      type="button"
      class="ctrl-btn ctrl-end"
      disabled={isEndingCall}
      aria-label="End call"
      title="End call"
      on:click={() => dispatch('endCall')}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1A19.4 19.4 0 013.1 10.8 19.8 19.8 0 012.1 2.2 2 2 0 014.1 0h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8.1 7.9a16 16 0 006 6l1.2-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0122 14.9z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>End call</span>
    </button>

    <!-- Right group -->
    <div class="ctrl-group">
      <!-- Record -->
      <button
        type="button"
        class="ctrl-btn"
        class:ctrl-active={isRecordingCall}
        disabled={!isConnected}
        aria-pressed={isRecordingCall}
        aria-label={isRecordingCall ? 'Stop recording' : 'Start recording'}
        title={isRecordingCall ? 'Stop recording' : 'Record'}
        on:click={isRecordingCall ? stopRecordingMedia : startRecordingMedia}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          {#if isRecordingCall}
            <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor"/>
          {:else}
            <circle cx="12" cy="12" r="4" fill="currentColor"/>
          {/if}
        </svg>
        <span>{isRecordingCall ? 'Stop rec' : 'Record'}</span>
      </button>

      <!-- Screen share (placeholder) -->
      <button
        type="button"
        class="ctrl-btn ctrl-disabled-feature"
        disabled
        aria-label="Share screen (coming soon)"
        title="Share screen (coming soon)"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="4" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
          <path d="M8 20h8M12 18v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M10 10l2-2 2 2M12 8v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Share</span>
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  /* ── Meeting room — full-screen overlay ──────────── */
  .meeting-room {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    background: #0a0f1a;
    color: rgba(255, 255, 255, 0.88);
    font-family: var(--font-sans);
  }

  /* Hidden audio sink */
  .audio-sink {
    position: absolute;
    inline-size: 0;
    block-size: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* ── Header ──────────────────────────────────────── */
  .meeting-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: var(--space-md);
    padding: 0.625rem 1rem;
    background: rgba(10, 15, 26, 0.92);
    border-block-end: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(12px);
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-inline-size: 0;
    flex: 1;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: 8px;
    background: rgba(126, 207, 255, 0.1);
    border: 1px solid rgba(126, 207, 255, 0.18);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-inline-size: 0;
    overflow: hidden;
  }

  .meeting-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: -0.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .connection-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    white-space: nowrap;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: color 300ms ease, background-color 300ms ease;
  }

  .connection-badge.connected {
    color: #34d399;
    background: rgba(52, 211, 153, 0.1);
    border-color: rgba(52, 211, 153, 0.25);
  }

  .header-center {
    flex-shrink: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex: 1;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .elapsed-time,
  .participant-count {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8125rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .elapsed-time { font-family: var(--font-mono, monospace); }

  /* Recording badge */
  .rec-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: 1px solid rgba(220, 38, 38, 0.4);
    border-radius: 999px;
    background: rgba(220, 38, 38, 0.12);
    color: #f87171;
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    letter-spacing: 0.04em;
    font-family: var(--font-mono, monospace);
  }

  .rec-dot {
    inline-size: 0.375rem;
    block-size: 0.375rem;
    border-radius: 999px;
    background: #f87171;
    animation: rec-blink 1.2s ease-in-out infinite;
  }

  @keyframes rec-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.25; }
  }

  /* ── Video stage ─────────────────────────────────── */
  .video-stage {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    min-block-size: 0;
    overflow: hidden;
  }

  .participants-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr));
    gap: 0.5rem;
    inline-size: 100%;
    block-size: 100%;
    align-content: center;
  }

  /* Single participant: max width constraint + center */
  .participants-grid[style*='--cols: 1'] {
    max-inline-size: min(100%, 72rem);
    margin-inline: auto;
  }

  /* ── Waiting overlay ─────────────────────────────── */
  .waiting-overlay {
    position: absolute;
    inset-inline-end: 0.75rem;
    inset-block-end: 5.5rem;
    pointer-events: none;
  }

  .waiting-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    background: rgba(15, 22, 38, 0.88);
    padding: 1.25rem 1.5rem;
    backdrop-filter: blur(12px);
    max-inline-size: 18rem;
    text-align: center;
  }

  .waiting-ring {
    position: relative;
    inline-size: 3rem;
    block-size: 3rem;
    border-radius: 999px;
    border: 2px solid rgba(78, 135, 255, 0.3);
    display: grid;
    place-items: center;
  }

  .waiting-pulse {
    inline-size: 1.25rem;
    block-size: 1.25rem;
    border-radius: 999px;
    background: rgba(78, 135, 255, 0.5);
    animation: waiting-pulse 1.8s ease-in-out infinite;
  }

  @keyframes waiting-pulse {
    0%, 100% { transform: scale(0.85); opacity: 0.5; }
    50%       { transform: scale(1.1); opacity: 1; }
  }

  .waiting-label {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .waiting-hint {
    margin: 0;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.4;
  }

  /* ── Control error ───────────────────────────────── */
  .control-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 1rem;
    border-radius: var(--radius-md);
    background: rgba(220, 38, 38, 0.12);
    border: 1px solid rgba(220, 38, 38, 0.3);
    color: #fca5a5;
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.625rem 0.875rem;
  }

  .error-dismiss {
    margin-inline-start: auto;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0 0.25rem;
    line-height: 1;
  }

  .error-dismiss:hover { color: rgba(255, 255, 255, 0.8); }

  /* ── Controls bar ────────────────────────────────── */
  .controls-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.625rem 1.5rem 0.875rem;
    background: rgba(10, 15, 26, 0.92);
    border-block-start: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(16px);
  }

  .ctrl-group {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  /* ── Control button ──────────────────────────────── */
  .ctrl-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    border: none;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.82);
    font-family: var(--font-sans);
    padding: 0.75rem;
    cursor: pointer;
    transition:
      background-color 140ms ease,
      color 140ms ease,
      transform 120ms ease,
      box-shadow 140ms ease;
    min-inline-size: 3.75rem;
  }

  .ctrl-btn svg {
    inline-size: 1.375rem;
    block-size: 1.375rem;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  .ctrl-btn span {
    font-size: 0.6875rem;
    font-weight: 600;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.55);
  }

  .ctrl-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.95);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .ctrl-btn:hover:not(:disabled) span { color: rgba(255, 255, 255, 0.75); }

  .ctrl-btn:active:not(:disabled) { transform: translateY(0); }

  .ctrl-btn:focus-visible {
    outline: 2px solid rgba(78, 135, 255, 0.7);
    outline-offset: 2px;
  }

  .ctrl-btn:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }

  /* Off state — mic/camera muted */
  .ctrl-btn.ctrl-off {
    background: rgba(220, 38, 38, 0.15);
    color: #fca5a5;
  }

  .ctrl-btn.ctrl-off:hover:not(:disabled) {
    background: rgba(220, 38, 38, 0.25);
  }

  /* Active state — e.g. recording on */
  .ctrl-btn.ctrl-active {
    background: rgba(220, 38, 38, 0.15);
    color: #f87171;
  }

  /* Disabled-feature state */
  .ctrl-btn.ctrl-disabled-feature {
    opacity: 0.3;
  }

  /* End call — red pill, larger */
  .ctrl-btn.ctrl-end {
    background: #dc2626;
    color: #ffffff;
    border-radius: 999px;
    min-inline-size: 5.5rem;
    padding-block: 0.875rem;
    box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35);
  }

  .ctrl-btn.ctrl-end span { color: rgba(255, 255, 255, 0.85); }

  .ctrl-btn.ctrl-end:hover:not(:disabled) {
    background: #b91c1c;
    box-shadow: 0 6px 20px rgba(220, 38, 38, 0.45);
  }

  /* ── Responsive ──────────────────────────────────── */
  @media (max-width: 640px) {
    .meeting-header { padding: 0.5rem 0.75rem; }

    .header-center { order: 3; flex: 1 1 100%; }

    .meeting-header {
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .participants-grid {
      grid-template-columns: 1fr !important;
    }

    .controls-bar { gap: 0.375rem; padding: 0.5rem 0.75rem 0.75rem; }

    .ctrl-btn { min-inline-size: 3rem; padding: 0.625rem; }

    .ctrl-btn span { display: none; }

    .ctrl-btn.ctrl-end { min-inline-size: 3.5rem; }

    .waiting-overlay {
      inset-inline-end: 0.5rem;
      inset-block-end: 5rem;
    }
  }

  @media (max-width: 900px) {
    .participants-grid[style*='--cols: 3'] {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
</style>
