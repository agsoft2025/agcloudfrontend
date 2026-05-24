import { browser } from '$app/environment';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RoomConnectOptions,
  type RoomOptions
} from 'livekit-client';
import { get, writable } from 'svelte/store';
import { callApi } from './api';

export interface LiveKitTokenRequest {
  roomName: string;
  participantName?: string;
  identity?: string;
  metadata?: string;
}

export interface LiveKitTokenResponse {
  token: string;
  url?: string;
}

export interface ConnectLiveKitOptions extends LiveKitTokenRequest {
  token?: string;
  url?: string;
  tokenPath?: string;
  audio?: boolean;
  video?: boolean;
  roomOptions?: RoomOptions;
  connectOptions?: RoomConnectOptions;
}

export interface LiveKitState {
  room: Room | null;
  connectionState: ConnectionState;
  localParticipantIdentity: string | null;
  remoteParticipants: RemoteParticipant[];
  error: string | null;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isScreenShareEnabled: boolean;
}

const DEFAULT_TOKEN_PATH = '/livekit/token';
const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL as string | undefined;

const initialState: LiveKitState = {
  room: null,
  connectionState: ConnectionState.Disconnected,
  localParticipantIdentity: null,
  remoteParticipants: [],
  error: null,
  isCameraEnabled: false,
  isMicrophoneEnabled: false,
  isScreenShareEnabled: false
};

export const liveKitState = writable<LiveKitState>(initialState);

let activeRoom: Room | null = null;

export async function getLiveKitToken(
  request: LiveKitTokenRequest,
  tokenPath = DEFAULT_TOKEN_PATH
): Promise<LiveKitTokenResponse> {
  const response = await callApi<unknown, LiveKitTokenRequest>(tokenPath, request);

  return parseTokenResponse(response);
}

export async function connectToLiveKit(options: ConnectLiveKitOptions): Promise<Room> {
  if (!browser) {
    throw new Error('LiveKit can only connect in the browser.');
  }

  await disconnectFromLiveKit();

  const tokenResponse = options.token
    ? { token: options.token, url: options.url }
    : await getLiveKitToken(
        {
          roomName: options.roomName,
          participantName: options.participantName,
          identity: options.identity,
          metadata: options.metadata
        },
        options.tokenPath
      );

  const url = options.url ?? tokenResponse.url ?? liveKitUrl;

  if (!url) {
    throw new Error('Missing LiveKit URL. Set VITE_LIVEKIT_URL or return url from the token endpoint.');
  }

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    ...options.roomOptions
  });

  activeRoom = room;
  registerRoomEvents(room);
  updateRoomState(room, { error: null });

  try {
    await room.connect(url, tokenResponse.token, options.connectOptions);

    if (options.audio ?? true) {
      await room.localParticipant.setMicrophoneEnabled(true);
    }

    if (options.video ?? true) {
      await room.localParticipant.setCameraEnabled(true);
    }

    updateRoomState(room, {
      error: null,
      isCameraEnabled: isLocalSourceEnabled(room, Track.Source.Camera),
      isMicrophoneEnabled: isLocalSourceEnabled(room, Track.Source.Microphone)
    });

    return room;
  } catch (error) {
    await disconnectFromLiveKit(room);
    liveKitState.update((state) => ({
      ...state,
      error: getErrorMessage(error)
    }));
    throw error;
  }
}

export async function disconnectFromLiveKit(room = activeRoom): Promise<void> {
  if (!room) return;

  room.disconnect();

  if (room === activeRoom) {
    activeRoom = null;
    liveKitState.set(initialState);
  }
}

export async function setMicrophoneEnabled(
  enabled: boolean,
  room = requireActiveRoom()
): Promise<LocalTrackPublication | undefined> {
  const publication = await room.localParticipant.setMicrophoneEnabled(enabled);
  updateRoomState(room, {
    isMicrophoneEnabled: isLocalSourceEnabled(room, Track.Source.Microphone)
  });

  return publication;
}

export async function setCameraEnabled(
  enabled: boolean,
  room = requireActiveRoom()
): Promise<LocalTrackPublication | undefined> {
  const publication = await room.localParticipant.setCameraEnabled(enabled);
  updateRoomState(room, {
    isCameraEnabled: isLocalSourceEnabled(room, Track.Source.Camera)
  });

  return publication;
}

export async function setScreenShareEnabled(
  enabled: boolean,
  room = requireActiveRoom()
): Promise<LocalTrackPublication | undefined> {
  const publication = await room.localParticipant.setScreenShareEnabled(enabled);
  updateRoomState(room, {
    isScreenShareEnabled: isLocalSourceEnabled(room, Track.Source.ScreenShare)
  });

  return publication;
}

export function attachTrack(track: RemoteTrack, element?: HTMLMediaElement): HTMLMediaElement {
  return element ? track.attach(element) : track.attach();
}

export function detachTrack(track: RemoteTrack, element?: HTMLMediaElement): HTMLMediaElement[] {
  if (element) {
    return [track.detach(element)];
  }

  return track.detach();
}

function registerRoomEvents(room: Room) {
  room
    .on(RoomEvent.ConnectionStateChanged, () => updateRoomState(room))
    .on(RoomEvent.ParticipantConnected, () => updateRoomState(room))
    .on(RoomEvent.ParticipantDisconnected, () => updateRoomState(room))
    .on(RoomEvent.LocalTrackPublished, () => updateLocalTrackState(room))
    .on(RoomEvent.LocalTrackUnpublished, () => updateLocalTrackState(room))
    .on(RoomEvent.TrackMuted, () => updateLocalTrackState(room))
    .on(RoomEvent.TrackUnmuted, () => updateLocalTrackState(room))
    .on(RoomEvent.TrackSubscribed, (_track: RemoteTrack, _publication: RemoteTrackPublication) =>
      updateRoomState(room)
    )
    .on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, _publication: RemoteTrackPublication) =>
      updateRoomState(room)
    )
    .on(RoomEvent.Disconnected, () => {
      if (room === activeRoom) {
        activeRoom = null;
        liveKitState.set(initialState);
      }
    });
}

function updateLocalTrackState(room: Room) {
  updateRoomState(room, {
    isCameraEnabled: isLocalSourceEnabled(room, Track.Source.Camera),
    isMicrophoneEnabled: isLocalSourceEnabled(room, Track.Source.Microphone),
    isScreenShareEnabled: isLocalSourceEnabled(room, Track.Source.ScreenShare)
  });
}

function updateRoomState(room: Room, patch: Partial<LiveKitState> = {}) {
  liveKitState.update((state) => ({
    ...state,
    room,
    connectionState: room.state,
    localParticipantIdentity: room.localParticipant.identity || null,
    remoteParticipants: Array.from(room.remoteParticipants.values()),
    ...patch
  }));
}

function isLocalSourceEnabled(room: Room, source: Track.Source) {
  const publication = room.localParticipant.getTrackPublication(source);

  return Boolean(publication && !publication.isMuted);
}

function requireActiveRoom() {
  const room = get(liveKitState).room ?? activeRoom;

  if (!room) {
    throw new Error('LiveKit room is not connected.');
  }

  return room;
}

function parseTokenResponse(response: unknown): LiveKitTokenResponse {
  if (!response || typeof response !== 'object') {
    throw new Error('LiveKit token response is invalid.');
  }

  const value = response as { token?: unknown; accessToken?: unknown; url?: unknown; serverUrl?: unknown };
  const token = value.token ?? value.accessToken;
  const url = value.url ?? value.serverUrl;

  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('LiveKit token response did not include a token.');
  }

  return {
    token,
    url: typeof url === 'string' && url.length > 0 ? url : undefined
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to connect to LiveKit.';
}
