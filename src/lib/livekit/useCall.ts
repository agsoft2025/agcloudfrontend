import {
  RoomEvent,
  Track,
  VideoQuality,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Room,
  type TrackPublication
} from 'livekit-client';
import type { Action } from 'svelte/action';
import { callStore } from '$lib/stores/call.store';
import { liveKitClient, type LiveKitClient } from './LiveKitClient';

// How long to wait after the last speaker-changed event before committing the
// new active-speaker list.  Prevents rapid flickering when background noise
// briefly crosses the speaking threshold.
const SPEAKER_DEBOUNCE_MS = 600;

export interface UseCallOptions {
  client?: LiveKitClient;
  room?: Room | null;
}

export const useCall: Action<HTMLElement, UseCallOptions | undefined> = (_node, options = {}) => {
  let cleanup = bindCallEvents(options.room ?? options.client?.room ?? liveKitClient.room);

  return {
    update(nextOptions = {}) {
      cleanup();
      cleanup = bindCallEvents(nextOptions.room ?? nextOptions.client?.room ?? liveKitClient.room);
    },
    destroy() {
      cleanup();
    }
  };
};

export function bindCallEvents(room: Room | null): () => void {
  if (!room) {
    callStore.reset();
    return () => undefined;
  }

  const sync = () => callStore.syncRoom(room);
  const setError = (message: string) => callStore.setError(message);

  // Track which publication SIDs have already had video quality configured so
  // we don't renegotiate the stream on every periodic sync tick.
  const qualityConfiguredSids = new Set<string>();

  const onTrackSubscriptionFailed = (trackSid: string, participant: RemoteParticipant) => {
    setError(`Unable to subscribe to ${participant.identity} track ${trackSid}.`);
    sync();
  };

  const subscribeAndSync = () => {
    subscribeToRemotePublications(room, qualityConfiguredSids);
    sync();
  };

  // On connect/reconnect, fire an immediate sync then a few retry syncs to
  // handle the race between connection and track subscription readiness.
  // Spacing is deliberately sparse to avoid hammering the video renderer.
  const subscribeAndSyncSoon = () => {
    subscribeAndSync();
    for (const delay of [300, 1200, 3500]) {
      window.setTimeout(subscribeAndSync, delay);
    }
  };

  // Periodic recovery interval — only re-subscribes to any tracks that slipped
  // through.  Intentionally slow (10s) so we never re-negotiate video quality
  // on tracks that are already streaming fine.
  const subscriptionInterval = window.setInterval(subscribeAndSync, 10_000);

  // Debounced speaker handler — prevents rapid-fire active-speaker switching
  // caused by background noise briefly crossing the detection threshold.
  let speakerDebounceTimer: number | undefined;
  const onActiveSpeakersChanged = (speakers: Participant[]) => {
    window.clearTimeout(speakerDebounceTimer);
    speakerDebounceTimer = window.setTimeout(() => {
      callStore.setActiveSpeakers(speakers.map((s) => s.identity));
    }, SPEAKER_DEBOUNCE_MS);
  };

  // Connection-quality changes: lightweight store update only (no full rebuild).
  const onConnectionQualityChanged = (_quality: unknown, _participant: Participant) => {
    // Quality is visible on the Participant object; picked up on next full sync.
    // We avoid a full syncRoom here to prevent unnecessary track re-renders.
  };

  room
    .on(RoomEvent.Connected, subscribeAndSyncSoon)
    .on(RoomEvent.ConnectionStateChanged, subscribeAndSyncSoon)
    .on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
    .on(RoomEvent.ConnectionQualityChanged, onConnectionQualityChanged)
    .on(RoomEvent.ParticipantConnected, syncParticipant)
    .on(RoomEvent.ParticipantDisconnected, syncParticipant)
    .on(RoomEvent.TrackPublished, syncRemotePublication)
    .on(RoomEvent.TrackUnpublished, syncRemotePublication)
    .on(RoomEvent.TrackSubscribed, syncRemoteTrack)
    .on(RoomEvent.TrackUnsubscribed, syncRemoteTrack)
    .on(RoomEvent.TrackSubscriptionStatusChanged, syncRemoteSubscriptionStatus)
    .on(RoomEvent.TrackSubscriptionPermissionChanged, syncRemoteSubscriptionPermission)
    .on(RoomEvent.TrackStreamStateChanged, syncRemoteStreamState)
    .on(RoomEvent.TrackMuted, syncPublication)
    .on(RoomEvent.TrackUnmuted, syncPublication)
    .on(RoomEvent.LocalTrackPublished, syncLocalPublication)
    .on(RoomEvent.LocalTrackUnpublished, syncLocalPublication)
    .on(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed)
    .on(RoomEvent.DataReceived, onDataReceived)
    .on(RoomEvent.Disconnected, callStore.reset);

  subscribeAndSyncSoon();

  return () => {
    window.clearInterval(subscriptionInterval);
    window.clearTimeout(speakerDebounceTimer);

    room
      .off(RoomEvent.Connected, subscribeAndSyncSoon)
      .off(RoomEvent.ConnectionStateChanged, subscribeAndSyncSoon)
      .off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
      .off(RoomEvent.ConnectionQualityChanged, onConnectionQualityChanged)
      .off(RoomEvent.ParticipantConnected, syncParticipant)
      .off(RoomEvent.ParticipantDisconnected, syncParticipant)
      .off(RoomEvent.TrackPublished, syncRemotePublication)
      .off(RoomEvent.TrackUnpublished, syncRemotePublication)
      .off(RoomEvent.TrackSubscribed, syncRemoteTrack)
      .off(RoomEvent.TrackUnsubscribed, syncRemoteTrack)
      .off(RoomEvent.TrackSubscriptionStatusChanged, syncRemoteSubscriptionStatus)
      .off(RoomEvent.TrackSubscriptionPermissionChanged, syncRemoteSubscriptionPermission)
      .off(RoomEvent.TrackStreamStateChanged, syncRemoteStreamState)
      .off(RoomEvent.TrackMuted, syncPublication)
      .off(RoomEvent.TrackUnmuted, syncPublication)
      .off(RoomEvent.LocalTrackPublished, syncLocalPublication)
      .off(RoomEvent.LocalTrackUnpublished, syncLocalPublication)
      .off(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed)
      .off(RoomEvent.DataReceived, onDataReceived)
      .off(RoomEvent.Disconnected, callStore.reset);
  };

  function onDataReceived(payload: Uint8Array, participant?: Participant) {
    if (!participant) return;
    try {
      const message = JSON.parse(new TextDecoder().decode(payload)) as {
        type?: string;
        raised?: boolean;
      };
      if (message.type === 'raise-hand') {
        callStore.setHandRaised(participant.identity, Boolean(message.raised));
      }
    } catch {
      // Ignore malformed data messages
    }
  }

  function syncParticipant(_participant: RemoteParticipant) {
    subscribeAndSyncSoon();
  }

  function syncRemotePublication(publication: RemoteTrackPublication, _participant: RemoteParticipant) {

    // Mutual exclusion: if a remote participant starts screen sharing while we
    // are also sharing, stop our local share immediately. Only one presenter
    // can be active at a time; the remote presenter takes precedence.
    // The explicit `room &&` guard is needed because TypeScript does not carry
    // flow-narrowing of `room: Room | null` into nested function closures,
    // even though the outer bindCallEvents guard guarantees it is non-null here.
    if (
      room &&
      publication.source === Track.Source.ScreenShare &&
      publication.kind === Track.Kind.Video &&
      !publication.isMuted
    ) {
      const localPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (localPub?.track && !localPub.isMuted) {
        console.warn(
          '[useCall] Remote participant started sharing — stopping local screen share.'
        );
        room.localParticipant.setScreenShareEnabled(false).catch(console.error);
      }
    }

    publication.setSubscribed(true);
    subscribeAndSyncSoon();
  }

  function syncRemoteTrack(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    publication.setSubscribed(true);
    subscribeAndSyncSoon();
  }

  function syncRemoteSubscriptionStatus(
    publication: RemoteTrackPublication,
    status: TrackPublication.SubscriptionStatus,
    participant: RemoteParticipant
  ) {
    publication.setSubscribed(true);
    subscribeAndSyncSoon();
  }

  function syncRemoteSubscriptionPermission(
    publication: RemoteTrackPublication,
    status: TrackPublication.PermissionStatus,
    participant: RemoteParticipant
  ) {
    publication.setSubscribed(true);
    subscribeAndSyncSoon();
  }

  function syncRemoteStreamState(
    publication: RemoteTrackPublication,
    streamState: Track.StreamState,
    participant: RemoteParticipant
  ) {
    sync();
  }

  function syncPublication(_publication: TrackPublication, _participant: Participant) {
    sync();
  }

  function syncLocalPublication(_publication: LocalTrackPublication) {
    sync();
  }
}

function subscribeToRemotePublications(room: Room, qualityConfiguredSids: Set<string>) {
  room.remoteParticipants.forEach((participant) => {
    participant.trackPublications.forEach((publication) => {
      publication.setEnabled(true);
      publication.setSubscribed(true);

      // Only configure simulcast quality hints for camera video tracks.
      // Screen share publications are typically published as a single layer
      // (no simulcast). Calling setVideoQuality / setVideoDimensions on them
      // tells the SFU "I can only accept up to W×H pixels", which — when the
      // presenter's screen is larger than those dimensions — causes the server
      // to find no suitable simulcast layer and stall the subscription for that
      // subscriber. Skipping these calls lets the SFU forward the single
      // screen share layer to every subscriber unconditionally.
      if (
        publication.kind === Track.Kind.Video &&
        publication.source !== Track.Source.ScreenShare
      ) {
        const sid = publication.trackSid;
        if (!qualityConfiguredSids.has(sid)) {
          // Set quality only once per subscription to prevent stream
          // renegotiation on every periodic sync tick (which causes blinking).
          publication.setVideoQuality(VideoQuality.HIGH);
          publication.setVideoDimensions({ width: 1280, height: 720 });
          publication.setVideoFPS(30);
          qualityConfiguredSids.add(sid);

        }
      }
    });
  });
}
