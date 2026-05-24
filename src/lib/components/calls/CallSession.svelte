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
  import { callStore } from '$lib/stores/call.store';
  import LiveKitTrack from './LiveKitTrack.svelte';

  export let session: ActiveCallSession;

  $: localVideoTrack = $callStore.localParticipant?.tracks.find(
    (item) => item.kind === Track.Kind.Video && item.track
  )?.track;
  $: remoteVideoTracks = $callStore.remoteParticipants.flatMap((participant) =>
    participant.tracks
      .filter((item) => item.kind === Track.Kind.Video && item.track)
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
  $: isConnected = $callStore.connectionState === ConnectionState.Connected;
  $: participantCount = $callStore.remoteParticipants.length;
  $: remoteTrackCount = remoteVideoTracks.length + remoteAudioTracks.length;
</script>

<section class="session" aria-labelledby="active-call-title" aria-label="Call in progress">
  <div class="session-header">
    <div>
      <p class="eyebrow">Call in progress</p>
      <h3 id="active-call-title">Waiting for response</h3>
      <p class="connection-state">
        {$callStore.connectionState}
        {#if session.roomName}
          <span>Room {session.roomName}</span>
        {/if}
      </p>
    </div>
    <slot name="actions" />
  </div>

  <div class="stage">
    <article class="local-panel" aria-label="Your side">
      <div class="media-tile local-media">
        {#if localVideoTrack}
          <LiveKitTrack track={localVideoTrack} label="Your video preview" muted mirror />
        {:else}
          <div class="empty-media">
            <strong>{session.callType === 'video' ? 'Starting your camera' : 'Audio connected'}</strong>
            <span>{isConnected ? 'Publishing local media...' : 'Connecting to room...'}</span>
          </div>
        {/if}
      </div>
      <div class="panel-footer">
        <span>Your {session.callType} preview</span>
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
            {#each session.recipients as recipient}
              <span>{recipient}</span>
            {/each}
          </div>
        </div>
      {/if}
    </article>
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

  @media (max-width: 560px) {
    .session-header,
    .panel-footer {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
