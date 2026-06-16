import { browser } from '$app/environment';
import {
  createLocalTracks,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type CreateLocalTracksOptions,
  type LocalTrack,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RoomConnectOptions,
  type RoomOptions,
  type TrackPublishOptions
} from 'livekit-client';

export interface LiveKitTokenResponse {
  token: string;
  url?: string;
}

export interface LiveKitConnectOptions {
  url?: string;
  token?: string;
  tokenProvider?: () => Promise<LiveKitTokenResponse>;
  roomOptions?: RoomOptions;
  connectOptions?: RoomConnectOptions;
  publishDefaults?: {
    audio?: boolean;
    video?: boolean;
  };
}

export interface LiveKitClientEvents {
  connected?: (room: Room) => void;
  disconnected?: (room: Room) => void;
  participantConnected?: (participant: RemoteParticipant, room: Room) => void;
  participantDisconnected?: (participant: RemoteParticipant, room: Room) => void;
  trackPublished?: (publication: RemoteTrackPublication, participant: RemoteParticipant, room: Room) => void;
  trackUnpublished?: (publication: RemoteTrackPublication, participant: RemoteParticipant, room: Room) => void;
  trackSubscribed?: (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
    room: Room
  ) => void;
  trackUnsubscribed?: (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
    room: Room
  ) => void;
  error?: (error: unknown) => void;
}

const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL as string | undefined;

export class LiveKitClient {
  private activeRoom: Room | null = null;
  private removeEventHandlers: (() => void) | null = null;

  constructor(private readonly events: LiveKitClientEvents = {}) {}

  get room(): Room | null {
    return this.activeRoom;
  }

  get isConnected(): boolean {
    return Boolean(this.activeRoom);
  }

  async connect(options: LiveKitConnectOptions): Promise<Room> {
    if (!browser) {
      throw new Error('LiveKit can only connect in the browser.');
    }

    await this.disconnect();

    const credentials = await this.resolveCredentials(options);
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      // Default video capture at 720p 30fps; publishers override per-track.
      videoCaptureDefaults: {
        resolution: { width: 1280, height: 720, frameRate: 30 }
      },
      // Default publish settings — individual track publishes can override.
      publishDefaults: {
        videoEncoding: { maxBitrate: 2_000_000, maxFramerate: 30 },
        screenShareEncoding: { maxBitrate: 3_000_000, maxFramerate: 15 },
        audioPreset: undefined
      },
      ...options.roomOptions
    });

    this.activeRoom = room;
    this.removeEventHandlers = this.bindRoomEvents(room);

    try {
      await room.connect(credentials.url, credentials.token, options.connectOptions);
    } catch (error) {
      this.events.error?.(error);
      await this.disconnect();
      throw error;
    }

    const publishResults = await Promise.allSettled([
      options.publishDefaults?.audio ? this.setMicrophoneEnabled(true) : Promise.resolve(undefined),
      options.publishDefaults?.video ? this.setCameraEnabled(true) : Promise.resolve(undefined)
    ]);

    publishResults.forEach((result) => {
      if (result.status === 'rejected') {
        this.events.error?.(result.reason);
        console.warn('LiveKit media publishing failed.', result.reason);
      }
    });

    return room;
  }

  async disconnect(): Promise<void> {
    const room = this.activeRoom;

    if (!room) return;

    this.removeEventHandlers?.();
    this.removeEventHandlers = null;
    this.activeRoom = null;
    room.disconnect();
  }

  async createLocalTracks(options?: CreateLocalTracksOptions): Promise<LocalTrack[]> {
    return createLocalTracks(options);
  }

  async publishLocalTracks(
    tracks: LocalTrack[] | MediaStreamTrack[],
    options?: TrackPublishOptions
  ): Promise<LocalTrackPublication[]> {
    const room = this.requireRoom();
    const publications = await Promise.all(
      tracks.map((track) => room.localParticipant.publishTrack(track, options))
    );

    return publications;
  }

  async unpublishLocalTracks(tracks: LocalTrack[] | MediaStreamTrack[]): Promise<LocalTrackPublication[]> {
    return this.requireRoom().localParticipant.unpublishTracks(tracks);
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<LocalTrackPublication | undefined> {
    return this.requireRoom().localParticipant.setMicrophoneEnabled(enabled);
  }

  async setCameraEnabled(enabled: boolean): Promise<LocalTrackPublication | undefined> {
    try {
      return await this.requireRoom().localParticipant.setCameraEnabled(
        enabled,
        {
          // Capture at 720p 30fps; device will downscale for simulcast layers.
          resolution: { width: 1280, height: 720, frameRate: 30 }
        },
        {
          videoCodec: 'vp8',
          // Simulcast sends three quality layers (low/mid/high) so receivers
          // automatically get the best quality their bandwidth supports, without
          // the publisher needing to re-negotiate the stream.
          simulcast: true,
          // Three simulcast layers: low → mid → high (720p at 2 Mbps).
          // LiveKit's adaptive stream picks the appropriate layer per receiver.
          videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720]
        }
      );
    } catch (e) {
      if (isCameraUnavailableError(e)) {
        console.warn('Camera device unavailable, disabling video for this participant.', e);
        return undefined;
      }
      throw e;
    }
  }

  async setScreenShareEnabled(enabled: boolean): Promise<LocalTrackPublication | undefined> {
    return this.requireRoom().localParticipant.setScreenShareEnabled(enabled);
  }

  subscribeToPublication(publication: RemoteTrackPublication, subscribed = true): void {
    publication.setSubscribed(subscribed);
  }

  subscribeToParticipant(participant: RemoteParticipant, subscribed = true): void {
    participant.trackPublications.forEach((publication) => {
      publication.setSubscribed(subscribed);
    });
  }

  subscribeToAllRemoteTracks(subscribed = true): void {
    this.requireRoom().remoteParticipants.forEach((participant) => {
      this.subscribeToParticipant(participant, subscribed);
    });
  }

  getLocalTrackPublication(source: Track.Source): LocalTrackPublication | undefined {
    return this.requireRoom().localParticipant.getTrackPublication(source);
  }

  private async resolveCredentials(options: LiveKitConnectOptions): Promise<{ url: string; token: string }> {
    const tokenResponse = options.token
      ? { token: options.token, url: options.url }
      : await options.tokenProvider?.();

    const token = tokenResponse?.token;
    const url = options.url ?? tokenResponse?.url ?? liveKitUrl;

    if (!token) {
      throw new Error('Missing LiveKit token.');
    }

    if (!url) {
      throw new Error('Missing LiveKit URL. Set VITE_LIVEKIT_URL or provide a room URL.');
    }

    return { url, token };
  }

  private bindRoomEvents(room: Room): () => void {
    const onConnected = () => this.events.connected?.(room);
    const onDisconnected = () => this.events.disconnected?.(room);
    const onParticipantConnected = (participant: RemoteParticipant) =>
      this.events.participantConnected?.(participant, room);
    const onParticipantDisconnected = (participant: RemoteParticipant) =>
      this.events.participantDisconnected?.(participant, room);
    const onTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) =>
      this.events.trackPublished?.(publication, participant, room);
    const onTrackUnpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) =>
      this.events.trackUnpublished?.(publication, participant, room);
    const onTrackSubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => this.events.trackSubscribed?.(track, publication, participant, room);
    const onTrackUnsubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant
    ) => this.events.trackUnsubscribed?.(track, publication, participant, room);

    room
      .on(RoomEvent.Connected, onConnected)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.ParticipantConnected, onParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      .on(RoomEvent.TrackPublished, onTrackPublished)
      .on(RoomEvent.TrackUnpublished, onTrackUnpublished)
      .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);

    return () => {
      room
        .off(RoomEvent.Connected, onConnected)
        .off(RoomEvent.Disconnected, onDisconnected)
        .off(RoomEvent.ParticipantConnected, onParticipantConnected)
        .off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
        .off(RoomEvent.TrackPublished, onTrackPublished)
        .off(RoomEvent.TrackUnpublished, onTrackUnpublished)
        .off(RoomEvent.TrackSubscribed, onTrackSubscribed)
        .off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    };
  }

  private requireRoom(): Room {
    if (!this.activeRoom) {
      throw new Error('LiveKit room is not connected.');
    }

    return this.activeRoom;
  }
}

function isCameraUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    error.name === 'NotReadableError' ||
    error.name === 'AbortError' ||
    message.includes('could not start video source') ||
    message.includes('device in use') ||
    message.includes('currently in use')
  );
}

export const liveKitClient = new LiveKitClient();
