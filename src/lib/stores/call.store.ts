import {
  ConnectionQuality,
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
  connectionQuality: ConnectionQuality;
  tracks: CallTrackState[];
  participant: Participant;
}

export interface CallState {
  room: Room | null;
  connectionState: ConnectionState;
  localParticipant: CallParticipantState | null;
  remoteParticipants: CallParticipantState[];
  activeSpeakers: string[];
  raisedHands: string[];
  error: string | null;
}

const initialState: CallState = {
  room: null,
  connectionState: ConnectionState.Disconnected,
  localParticipant: null,
  remoteParticipants: [],
  activeSpeakers: [],
  raisedHands: [],
  error: null
};

function createCallStore() {
  const { subscribe, set, update } = writable<CallState>(initialState);

  function syncRoom(room: Room) {
    update((state) => ({ ...snapshotRoom(room), raisedHands: state.raisedHands }));
  }

  function setHandRaised(identity: string, raised: boolean) {
    update((state) => {
      const raisedHands = new Set(state.raisedHands);
      if (raised) {
        raisedHands.add(identity);
      } else {
        raisedHands.delete(identity);
      }
      return { ...state, raisedHands: [...raisedHands] };
    });
  }

  /**
   * Lightweight speaker update — does NOT rebuild tracks or participant lists.
   * Use this instead of syncRoom when only active speakers changed so video
   * elements are never detached/reattached on each audio-level tick.
   */
  function setActiveSpeakers(identities: string[]) {
    update((state) => {
      const identitySet = new Set(identities);
      // Skip if nothing actually changed (avoid spurious re-renders)
      const currentSet = new Set(state.activeSpeakers);
      if (
        identities.length === state.activeSpeakers.length &&
        identities.every((id) => currentSet.has(id))
      ) {
        return state;
      }
      return {
        ...state,
        activeSpeakers: identities,
        localParticipant: state.localParticipant
          ? {
              ...state.localParticipant,
              isSpeaking: identitySet.has(state.localParticipant.identity)
            }
          : null,
        remoteParticipants: state.remoteParticipants.map((p) =>
          p.isSpeaking !== identitySet.has(p.identity)
            ? { ...p, isSpeaking: identitySet.has(p.identity) }
            : p
        )
      };
    });
  }

  return {
    subscribe,
    syncRoom,
    setRoom: syncRoom,
    setActiveSpeakers,
    setHandRaised,
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
    raisedHands: [],
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
    connectionQuality: participant.connectionQuality,
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
