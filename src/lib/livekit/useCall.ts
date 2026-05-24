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
  const onTrackSubscriptionFailed = (trackSid: string, participant: RemoteParticipant) => {
    setError(`Unable to subscribe to ${participant.identity} track ${trackSid}.`);
    sync();
  };
  const subscribeAndSync = () => {
    subscribeToRemotePublications(room);
    sync();
  };
  const subscribeAndSyncSoon = () => {
    subscribeAndSync();

    for (const delay of [100, 500, 1500, 3000]) {
      window.setTimeout(subscribeAndSync, delay);
    }
  };
  const subscriptionInterval = window.setInterval(subscribeAndSync, 1000);

  room
    .on(RoomEvent.Connected, subscribeAndSyncSoon)
    .on(RoomEvent.ConnectionStateChanged, subscribeAndSyncSoon)
    .on(RoomEvent.ActiveSpeakersChanged, sync)
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
    .on(RoomEvent.Disconnected, callStore.reset);

  subscribeAndSyncSoon();

  return () => {
    window.clearInterval(subscriptionInterval);

    room
      .off(RoomEvent.Connected, subscribeAndSyncSoon)
      .off(RoomEvent.ConnectionStateChanged, subscribeAndSyncSoon)
      .off(RoomEvent.ActiveSpeakersChanged, sync)
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
      .off(RoomEvent.Disconnected, callStore.reset);
  };

  function syncParticipant(_participant: RemoteParticipant) {
    subscribeAndSyncSoon();
  }

  function syncRemotePublication(publication: RemoteTrackPublication, _participant: RemoteParticipant) {
    console.log('Remote track publication changed:', {
      participant: _participant.identity,
      kind: publication.kind,
      source: publication.source,
      sid: publication.trackSid,
      subscribed: publication.isSubscribed
    });
    publication.setSubscribed(true);
    subscribeAndSyncSoon();
  }

  function syncRemoteTrack(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    publication.setSubscribed(true);
    console.log('Remote track subscribed:', {
      participant: participant.identity,
      kind: track.kind,
      source: publication.source,
      sid: publication.trackSid
    });
    subscribeAndSyncSoon();
  }

  function syncRemoteSubscriptionStatus(
    publication: RemoteTrackPublication,
    status: TrackPublication.SubscriptionStatus,
    participant: RemoteParticipant
  ) {
    console.log('Remote track subscription status changed:', {
      participant: participant.identity,
      kind: publication.kind,
      source: publication.source,
      sid: publication.trackSid,
      status
    });
    publication.setSubscribed(true);
    subscribeAndSyncSoon();
  }

  function syncRemoteSubscriptionPermission(
    publication: RemoteTrackPublication,
    status: TrackPublication.PermissionStatus,
    participant: RemoteParticipant
  ) {
    console.log('Remote track subscription permission changed:', {
      participant: participant.identity,
      kind: publication.kind,
      source: publication.source,
      sid: publication.trackSid,
      status
    });
    publication.setSubscribed(true);
    subscribeAndSyncSoon();
  }

  function syncRemoteStreamState(
    publication: RemoteTrackPublication,
    streamState: Track.StreamState,
    participant: RemoteParticipant
  ) {
    console.log('Remote track stream state changed:', {
      participant: participant.identity,
      kind: publication.kind,
      source: publication.source,
      sid: publication.trackSid,
      streamState
    });
    sync();
  }

  function syncPublication(_publication: TrackPublication, _participant: Participant) {
    sync();
  }

  function syncLocalPublication(_publication: LocalTrackPublication) {
    sync();
  }
}

function subscribeToRemotePublications(room: Room) {
  room.remoteParticipants.forEach((participant) => {
    participant.trackPublications.forEach((publication) => {
      publication.setEnabled(true);
      publication.setSubscribed(true);

      if (publication.kind === Track.Kind.Video) {
        publication.setVideoQuality(VideoQuality.HIGH);
        publication.setVideoDimensions({ width: 1280, height: 720 });
        publication.setVideoFPS(30);

        console.log('Remote video publication sync:', {
          participant: participant.identity,
          sid: publication.trackSid,
          source: publication.source,
          desired: publication.isDesired,
          enabled: publication.isEnabled,
          subscribed: publication.isSubscribed,
          hasTrack: Boolean(publication.track),
          permissionStatus: publication.permissionStatus,
          subscriptionStatus: publication.subscriptionStatus
        });
      }
    });
  });
}
