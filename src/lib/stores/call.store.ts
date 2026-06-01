import {
  ConnectionState,
  type LocalParticipant,
  type Participant,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Room,
  type Track,
  type TrackPublication
} from 'livekit-client';
import { writable } from 'svelte/store';

export type CallParticipantKind = 'local' | 'remote';

export interface CallTrackState {
  sid: string;
  participantIdentity: string;
  kind: Track.Kind;
  source: Track.Source;
  isMuted: boolean;
  isSubscribed: boolean;
  publication: TrackPublication;
  track: Track | undefined;
}

export interface CallParticipantState {
  sid: string;
  identity: string;
  name: string | undefined;
  metadata: string | undefined;
  kind: CallParticipantKind;
  isSpeaking: boolean;
  audioLevel: number;
  tracks: CallTrackState[];
  participant: Participant;
}

export interface CallState {
  room: Room | null;
  connectionState: ConnectionState;
  localParticipant: CallParticipantState | null;
  remoteParticipants: CallParticipantState[];
  activeSpeakers: string[];
  error: string | null;
}

const initialState: CallState = {
  room: null,
  connectionState: ConnectionState.Disconnected,
  localParticipant: null,
  remoteParticipants: [],
  activeSpeakers: [],
  error: null
};

function createCallStore() {
  const { subscribe, set, update } = writable<CallState>(initialState);

  function syncRoom(room: Room) {
    set(snapshotRoom(room));
  }

  return {
    subscribe,
    syncRoom,
    setRoom: syncRoom,
    setError: (error: string | null) => update((state) => ({ ...state, error })),
    reset: () => set(initialState)
  };
}

export const callStore = createCallStore();

export function snapshotRoom(room: Room): CallState {
  return {
    room,
    connectionState: room.state,
    localParticipant: mapParticipant(room.localParticipant, 'local'),
    remoteParticipants: Array.from(room.remoteParticipants.values()).map((participant) =>
      mapParticipant(participant, 'remote')
    ),
    activeSpeakers: room.activeSpeakers.map((participant) => participant.identity),
    error: null
  };
}

function mapParticipant(
  participant: LocalParticipant | RemoteParticipant,
  kind: CallParticipantKind
): CallParticipantState {
  return {
    sid: participant.sid,
    identity: participant.identity,
    name: participant.name,
    metadata: participant.metadata,
    kind,
    isSpeaking: participant.isSpeaking,
    audioLevel: participant.audioLevel,
    tracks: participant.getTrackPublications().map((publication) =>
      mapTrackPublication(publication, participant.identity)
    ),
    participant
  };
}

function mapTrackPublication(publication: TrackPublication, participantIdentity: string): CallTrackState {
  const remotePublication = publication.isLocal ? null : (publication as RemoteTrackPublication);

  return {
    sid: publication.trackSid,
    participantIdentity,
    kind: publication.kind,
    source: publication.source,
    isMuted: publication.isMuted,
    isSubscribed: publication.isLocal || Boolean(remotePublication?.isSubscribed),
    publication,
    track: publication.track
  };
}
