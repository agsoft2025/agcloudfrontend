<script lang="ts" context="module">
  import type { CallType } from "$lib/api/calls.api";

  export interface ActiveCallSession {
    callId: string | null;
    callMode: "one-to-one" | "conference";
    callType: CallType;
    recipients: string[];
    initiatedAt: Date;
    roomName?: string;
  }
</script>

<script lang="ts">
  import {
    ConnectionQuality,
    ConnectionState,
    Track,
    VideoQuality,
  } from "livekit-client";

  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { callStore } from "$lib/stores/call.store";
  import { liveKitClient } from "$lib/livekit/LiveKitClient";
  import { getContacts } from "$lib/api/contacts.api";
  import { addParticipant, getCallApiErrorMessage } from "$lib/api/calls.api";
  import { authStore } from "$lib/stores/auth.store";
  import { toastStore } from "$lib/stores/toast.store";
  import { callLifecycleEvents } from "$lib/realtime/call-signaling";
  import type { UserProfile } from "$lib/stores/user.store";
  import LiveKitTrack from "./LiveKitTrack.svelte";
  import ParticipantTile from "./ParticipantTile.svelte";
  import RoomIdChip from "./RoomIdChip.svelte";

  export let session: ActiveCallSession;
  export let isEndingCall = false;

  const dispatch = createEventDispatcher<{ endCall: void }>();

  let meetingRoomEl: HTMLDivElement;

  // ── Pin / layout state ─────────────────────────────
  let pinnedId: string | null = null;

  // ── Raise hand state ────────────────────────────────
  let isHandRaisedLocal = false;

  // ── Screen share state ──────────────────────────────
  let isTogglingScreenShare = false;

  // ── Full screen state ───────────────────────────────
  let isFullscreen = false;

  function mapNetworkQuality(
    q: ConnectionQuality | undefined,
  ): "excellent" | "good" | "poor" | undefined {
    switch (q) {
      case ConnectionQuality.Excellent:
        return "excellent";
      case ConnectionQuality.Good:
        return "good";
      case ConnectionQuality.Poor:
        return "poor";
      default:
        return undefined;
    }
  }

  function togglePin(id: string) {
    pinnedId = pinnedId === id ? null : id;
  }

  async function toggleScreenShare() {
    if (isTogglingScreenShare || !isConnected) return;
    isTogglingScreenShare = true;
    controlError = "";
    try {
      await liveKitClient.setScreenShareEnabled(!isScreenSharing);
      if ($callStore.room) callStore.syncRoom($callStore.room);
    } catch (e) {
      controlError =
        e instanceof Error ? e.message : "Unable to toggle screen share.";
    } finally {
      isTogglingScreenShare = false;
    }
  }

  function toggleRaiseHand() {
    isHandRaisedLocal = !isHandRaisedLocal;
    const identity = $callStore.localParticipant?.identity;
    if (identity) callStore.setHandRaised(identity, isHandRaisedLocal);

    const room = $callStore.room;
    if (room) {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: "raise-hand", raised: isHandRaisedLocal }),
      );
      room.localParticipant
        .publishData(payload, { reliable: true })
        .catch(() => undefined);
    }
  }

  function handleFullscreenChange() {
    isFullscreen = Boolean(document.fullscreenElement);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await meetingRoomEl?.requestFullscreen();
      }
    } catch {
      // Fullscreen not supported / denied — ignore.
    }
  }

  // ── Add people state ───────────────────────────────
  let showAddPeople = false;
  let contacts: UserProfile[] = [];
  let contactsLoading = false;
  let contactsError = "";
  let contactSearch = "";
  let addingUserId: string | null = null;
  let addPeopleError = "";
  // Per-user invite status shown in the Add people panel.
  // 'inviting'  — API call in flight
  // 'invited'   — invite sent, awaiting response
  // 'rejected'  — person declined (shown briefly, then resets to allow re-invite)
  let inviteStatuses = new Map<string, "inviting" | "invited" | "rejected">();
  let rejectionResetTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // ── Video quality profile ─────────────────────────
  type VideoQualityProfile = "auto" | "data-saver" | "hd" | "fhd";
  let videoQualityProfile: VideoQualityProfile = "hd";
  let showQualityMenu = false;

  const QUALITY_LABELS: Record<VideoQualityProfile, string> = {
    auto: "Auto",
    "data-saver": "Data Saver",
    hd: "HD 720p",
    fhd: "Full HD 1080p",
  };

  function applyVideoQualityProfile(profile: VideoQualityProfile) {
    videoQualityProfile = profile;
    showQualityMenu = false;
    const room = $callStore.room;
    if (!room) return;
    room.remoteParticipants.forEach((p) => {
      p.trackPublications.forEach((pub) => {
        if (pub.kind !== Track.Kind.Video) return;
        switch (profile) {
          case "auto":
            pub.setVideoQuality(VideoQuality.HIGH);
            pub.setVideoDimensions({ width: 1280, height: 720 });
            pub.setVideoFPS(30);
            break;
          case "data-saver":
            pub.setVideoQuality(VideoQuality.LOW);
            pub.setVideoDimensions({ width: 320, height: 240 });
            pub.setVideoFPS(15);
            break;
          case "hd":
            pub.setVideoQuality(VideoQuality.HIGH);
            pub.setVideoDimensions({ width: 1280, height: 720 });
            pub.setVideoFPS(30);
            break;
          case "fhd":
            pub.setVideoQuality(VideoQuality.HIGH);
            pub.setVideoDimensions({ width: 1920, height: 1080 });
            pub.setVideoFPS(30);
            break;
        }
      });
    });
  }

  // ── Recording state ────────────────────────────────
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let isRecordingCall = false;
  let recordingTime = 0;
  let recordingInterval: ReturnType<typeof setInterval> | null = null;

  // ── Media toggle state ─────────────────────────────
  let isTogglingAudio = false;
  let isTogglingVideo = false;
  /** Track which camera is active on mobile; true = front (selfie), false = rear */
  let isFrontCamera = true;
  let isSwitchingCamera = false;
  let controlError = "";

  // ── Elapsed call timer ─────────────────────────────
  let elapsedSeconds = 0;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    elapsedSeconds = 0;
    elapsedTimer = setInterval(() => {
      elapsedSeconds = Math.floor(
        (Date.now() - session.initiatedAt.getTime()) / 1000,
      );
    }, 1000);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
  });

  onDestroy(() => {
    if (isRecordingCall) stopRecordingMedia();
    if (elapsedTimer) clearInterval(elapsedTimer);
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    unsubscribeCallEvents();
    rejectionResetTimers.forEach((t) => clearTimeout(t));
  });

  // ── Recording ──────────────────────────────────────
  function startRecordingMedia() {
    recordedChunks = [];
    const tracksToRecord: MediaStreamTrack[] = [];
    const localAudioTrack = $callStore.localParticipant?.tracks.find(
      (item) => item.kind === Track.Kind.Audio && item.track,
    )?.track?.mediaStreamTrack;
    if (localAudioTrack) tracksToRecord.push(localAudioTrack);
    if (localVideoTrack?.mediaStreamTrack)
      tracksToRecord.push(localVideoTrack.mediaStreamTrack);
    $callStore.remoteParticipants.forEach((p) => {
      p.tracks.forEach((pub) => {
        if (pub.track?.mediaStreamTrack)
          tracksToRecord.push(pub.track.mediaStreamTrack);
      });
    });
    if (tracksToRecord.length === 0) {
      toastStore.error("No active media tracks found to record.");
      return;
    }
    const stream = new MediaStream(tracksToRecord);
    try {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });
    } catch {
      mediaRecorder = new MediaRecorder(stream);
    }
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `agcloud-call-${session.callId ?? "session"}-${Date.now()}.webm`;
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
      import("$lib/api/calls.api").then(({ startRecording }) => {
        startRecording(session.callId!).catch(console.error);
      });
    }
  }

  function stopRecordingMedia() {
    if (mediaRecorder && mediaRecorder.state !== "inactive")
      mediaRecorder.stop();
    isRecordingCall = false;
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
    if (session.callId) {
      import("$lib/api/calls.api").then(({ stopRecording }) => {
        stopRecording(session.callId!).catch(console.error);
      });
    }
  }

  // ── Helpers ────────────────────────────────────────
  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function formatElapsed(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function getMediaControlError(
    error: unknown,
    device: "microphone" | "camera",
  ) {
    if (error instanceof DOMException) {
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      )
        return `${device.charAt(0).toUpperCase() + device.slice(1)} permission denied. Allow access in browser settings.`;
      if (error.name === "NotFoundError") return `No ${device} found.`;
      if (error.name === "NotReadableError" || error.name === "AbortError")
        return `${device.charAt(0).toUpperCase() + device.slice(1)} is already in use.`;
    }
    return error instanceof Error
      ? error.message
      : `Unable to update ${device}.`;
  }

  // ── Media toggles ──────────────────────────────────
  async function toggleMicrophone() {
    if (isTogglingAudio || !isConnected) return;
    isTogglingAudio = true;
    controlError = "";
    try {
      await liveKitClient.setMicrophoneEnabled(!isMicrophoneEnabled);
      if ($callStore.room) callStore.syncRoom($callStore.room);
    } catch (e) {
      controlError = getMediaControlError(e, "microphone");
    } finally {
      isTogglingAudio = false;
    }
  }

  async function toggleCamera() {
    if (isTogglingVideo || !isConnected) return;
    isTogglingVideo = true;
    controlError = "";
    try {
      const pub = await liveKitClient.setCameraEnabled(!isCameraEnabled);
      if (!pub && !isCameraEnabled)
        controlError = "Camera unavailable. Check browser permissions.";
      if ($callStore.room) callStore.syncRoom($callStore.room);
    } catch (e) {
      controlError = getMediaControlError(e, "camera");
    } finally {
      isTogglingVideo = false;
    }
  }

  /**
   * Switch between front (selfie) and rear camera without ending the call.
   * Only meaningful on mobile devices that have both cameras.
   * Uses LiveKit's restartTrack() to re-acquire the camera with the new facingMode
   * and seamlessly republish the updated stream to remote participants.
   */
  async function switchCamera() {
    if (isSwitchingCamera || !isConnected || !isCameraEnabled) return;
    isSwitchingCamera = true;
    controlError = "";
    const nextFacing = isFrontCamera ? "environment" : "user";
    try {
      await liveKitClient.setCameraFacingMode(nextFacing);
      isFrontCamera = !isFrontCamera;
      if ($callStore.room) callStore.syncRoom($callStore.room);
    } catch (e) {
      controlError = "Unable to switch camera.";
    } finally {
      isSwitchingCamera = false;
    }
  }

  // ── Reactive state ─────────────────────────────────
  $: localVideoTrack = $callStore.localParticipant?.tracks.find(
    (t) => t.kind === Track.Kind.Video && t.track && !t.isMuted,
  )?.track;
  $: localAudioPublication = $callStore.localParticipant?.tracks.find(
    (t) => t.kind === Track.Kind.Audio && t.source === Track.Source.Microphone,
  );
  $: localVideoPublication = $callStore.localParticipant?.tracks.find(
    (t) => t.kind === Track.Kind.Video && t.source === Track.Source.Camera,
  );
  $: isMicrophoneEnabled = Boolean(
    localAudioPublication && !localAudioPublication.isMuted,
  );
  $: isCameraEnabled = Boolean(
    localVideoPublication &&
      !localVideoPublication.isMuted &&
      localVideoPublication.track,
  );
  $: isLocalSpeaking = Boolean($callStore.localParticipant?.isSpeaking);

  // Remote audio (for playback — rendered as hidden audio elements)
  $: remoteAudioTracks = $callStore.remoteParticipants.flatMap((p) =>
    p.tracks
      .filter((t) => t.kind === Track.Kind.Audio && t.track)
      .map((t) => ({
        id: t.sid,
        participant: p.name ?? p.identity,
        track: t.track,
      })),
  );

  // Remote participant tiles
  $: remoteTiles = $callStore.remoteParticipants.map((p) => {
    const name = p.name ?? p.identity;
    const videoTrack = p.tracks.find(
      (t) =>
        t.kind === Track.Kind.Video &&
        t.track &&
        !t.isMuted &&
        t.source === Track.Source.Camera,
    )?.track;
    const videoPublication = p.tracks.find(
      (t) => t.kind === Track.Kind.Video && t.source === Track.Source.Camera,
    );
    const audioPublication = p.tracks.find(
      (t) =>
        t.kind === Track.Kind.Audio && t.source === Track.Source.Microphone,
    );
    const screenSharePublication = p.tracks.find(
      (t) =>
        t.kind === Track.Kind.Video &&
        t.source === Track.Source.ScreenShare &&
        t.track &&
        !t.isMuted,
    );
    return {
      id: p.sid || p.identity,
      name,
      videoTrack,
      screenShareTrack: screenSharePublication?.track,
      isMuted: Boolean(audioPublication?.isMuted),
      isCameraOff:
        !videoPublication ||
        videoPublication.isMuted ||
        !videoPublication.track,
      isActive: $callStore.activeSpeakers.includes(p.identity),
      isLocal: false,
      networkQuality: mapNetworkQuality(p.connectionQuality),
      isHandRaised: $callStore.raisedHands.includes(p.identity),
    };
  });

  // Local participant tile
  $: localScreenShareTrack = $callStore.localParticipant?.tracks.find(
    (t) =>
      t.kind === Track.Kind.Video &&
      t.source === Track.Source.ScreenShare &&
      t.track &&
      !t.isMuted,
  )?.track;

  $: localTile = $callStore.localParticipant
    ? {
        id: "local",
        name: "You",
        videoTrack: localVideoTrack,
        screenShareTrack: localScreenShareTrack,
        isMuted: !isMicrophoneEnabled,
        isCameraOff: !isCameraEnabled,
        isActive: isLocalSpeaking,
        isLocal: true,
        networkQuality: mapNetworkQuality(
          $callStore.localParticipant.connectionQuality,
        ),
        isHandRaised: isHandRaisedLocal,
      }
    : null;

  $: allTiles = localTile ? [localTile, ...remoteTiles] : remoteTiles;

  // Screen share — auto-pins the sharer's screen as the main view
  $: screenShareTile = allTiles.find((t) => t.screenShareTrack) ?? null;

  // Reset pin if the pinned participant has left the call
  $: if (pinnedId && !allTiles.find((t) => t.id === pinnedId)) {
    pinnedId = null;
  }

  $: pinnedTile = pinnedId
    ? (allTiles.find((t) => t.id === pinnedId) ?? null)
    : screenShareTile;

  $: isSpotlight = Boolean(pinnedTile);
  $: mainIsScreenShare = Boolean(pinnedTile?.screenShareTrack);
  $: mainTrack = mainIsScreenShare
    ? pinnedTile?.screenShareTrack
    : pinnedTile?.videoTrack;
  $: thumbnailTiles = pinnedTile
    ? allTiles.filter((t) => t.id !== pinnedTile.id)
    : [];

  $: isScreenSharing = Boolean(localScreenShareTrack);

  $: isConnected = $callStore.connectionState === ConnectionState.Connected;
  $: totalParticipants = allTiles.length;
  $: gridCols =
    totalParticipants <= 1
      ? 1
      : totalParticipants <= 2
        ? 2
        : totalParticipants <= 4
          ? 2
          : totalParticipants <= 9
            ? 3
            : 4;
  $: gridRows = Math.ceil(totalParticipants / gridCols);
  // True when the last tile occupies a row by itself (e.g. 3 tiles in 2 cols)
  $: lastTileAlone =
    totalParticipants > 1 && totalParticipants % gridCols !== 0;
  $: roomDisplayId = session.roomName ?? session.callId ?? "N/A";

  // ── Add people ──────────────────────────────────────
  $: existingParticipantIds = new Set(
    [
      $authStore.user?.id,
      $callStore.localParticipant?.identity,
      ...$callStore.remoteParticipants.map((p) => p.identity),
    ].filter((id): id is string => Boolean(id)),
  );

  $: filteredContacts = contacts.filter((c) => {
    if (!c.id || existingParticipantIds.has(c.id)) return false;
    // Hide contacts who have been successfully invited and haven't rejected yet
    const status = inviteStatuses.get(c.id);
    if (status === "invited" || status === "inviting") return false;
    if (!contactSearch.trim()) return true;
    const q = contactSearch.trim().toLowerCase();
    return (
      (c.displayName ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  // Contacts currently showing "Invite Sent" or "Rejected" banners above the list
  $: pendingContacts = contacts.filter((c) => {
    if (!c.id) return false;
    const status = inviteStatuses.get(c.id);
    return (
      status === "invited" || status === "inviting" || status === "rejected"
    );
  });

  async function openAddPeople() {
    showAddPeople = true;
    addPeopleError = "";
    if (contacts.length === 0 && !contactsLoading) {
      contactsLoading = true;
      contactsError = "";
      try {
        contacts = await getContacts();
      } catch (e) {
        contactsError = getCallApiErrorMessage(e, "Unable to load contacts.");
      } finally {
        contactsLoading = false;
      }
    }
  }

  function closeAddPeople() {
    showAddPeople = false;
  }

  async function handleAddParticipant(userId: string) {
    if (!session.callId || addingUserId) return;
    addingUserId = userId;
    addPeopleError = "";
    inviteStatuses = new Map(inviteStatuses).set(userId, "inviting");
    try {
      await addParticipant(session.callId, userId);
      inviteStatuses = new Map(inviteStatuses).set(userId, "invited");
    } catch (e) {
      inviteStatuses.delete(userId);
      inviteStatuses = new Map(inviteStatuses);
      addPeopleError = getCallApiErrorMessage(
        e,
        "Unable to add this person to the call.",
      );
    } finally {
      addingUserId = null;
    }
  }

  // Watch for rejections so we can update the button state in real time.
  const unsubscribeCallEvents = callLifecycleEvents.subscribe((event) => {
    if (!event || event.type !== "call:participant-rejected" || !event.userId)
      return;
    const uid = event.userId;
    // Clear any existing reset timer for this user.
    const existing = rejectionResetTimers.get(uid);
    if (existing) clearTimeout(existing);
    // Show "Rejected" briefly, then reset to "Add" so they can be re-invited.
    inviteStatuses = new Map(inviteStatuses).set(uid, "rejected");
    const timer = setTimeout(() => {
      inviteStatuses.delete(uid);
      inviteStatuses = new Map(inviteStatuses);
      rejectionResetTimers.delete(uid);
    }, 4000);
    rejectionResetTimers.set(uid, timer);
  });
</script>

<!-- Full-screen meeting room overlay -->
<div
  class="meeting-room"
  class:is-fullscreen={isFullscreen}
  aria-label="Meeting room"
  bind:this={meetingRoomEl}
>
  <!-- Hidden audio tracks -->
  <div class="audio-sink" aria-hidden="true">
    {#each remoteAudioTracks as item (item.id)}
      <LiveKitTrack track={item.track} label="{item.participant} audio" />
    {/each}
  </div>

  <!-- ── Top header bar ──────────────────────────── -->
  <header class="meeting-header">
    <div class="header-left">
      <img class="meeting-logo" src="/logo.png" alt="AG Cloud" />
      <div class="header-title">
        <span class="call-type-icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 10l5-3v10l-5-3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <rect
              x="2"
              y="6"
              width="11"
              height="12"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
        </span>
        <span class="connection-badge" class:connected={isConnected}>
          {isConnected ? "Connected" : $callStore.connectionState}
        </span>
      </div>
    </div>

    <div class="header-center">
      <RoomIdChip roomId={roomDisplayId} />
    </div>

    <div class="header-right">
      <!-- Elapsed time -->
      <div class="elapsed-time" aria-label="Call duration">
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            stroke="currentColor"
            stroke-width="1.4"
          />
          <path
            d="M8 5v3l2 2"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {formatElapsed(elapsedSeconds)}
      </div>
      <!-- Participant count -->
      <div
        class="participant-count"
        aria-label="{totalParticipants} participants"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="6"
            cy="5"
            r="2.5"
            stroke="currentColor"
            stroke-width="1.4"
          />
          <path
            d="M1 14a5 5 0 0110 0"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
          <circle
            cx="12"
            cy="5"
            r="2"
            stroke="currentColor"
            stroke-width="1.3"
          />
          <path
            d="M13.5 14a3 3 0 012 2.8"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
        </svg>
        {totalParticipants}
      </div>

      <!-- Recording badge -->
      {#if isRecordingCall}
        <div
          class="rec-badge"
          aria-live="polite"
          title="Recording: {formatTime(recordingTime)}"
        >
          <span class="rec-dot" aria-hidden="true"></span>
          <span>REC {formatTime(recordingTime)}</span>
        </div>
      {/if}
    </div>
  </header>

  <!-- ── Video stage ─────────────────────────────── -->
  <main
    class="video-stage"
    aria-label="Participants"
    class:is-spotlight={isSpotlight}
  >
    {#if isSpotlight && pinnedTile}
      <!-- ── Spotlight layout: main tile + thumbnail strip ── -->
      <div class="spotlight-layout">
        <div class="spotlight-main" in:fade={{ duration: 220 }}>
          <ParticipantTile
            track={mainTrack}
            name={pinnedTile.name}
            label="{pinnedTile.name} {mainIsScreenShare
              ? 'screen share'
              : 'video'}"
            isActive={pinnedTile.isActive}
            isMuted={pinnedTile.isMuted}
            isCameraOff={mainIsScreenShare ? false : pinnedTile.isCameraOff}
            mirror={pinnedTile.isLocal && !mainIsScreenShare}
            isLocal={pinnedTile.isLocal}
            isPinned={true}
            isHandRaised={pinnedTile.isHandRaised}
            networkQuality={pinnedTile.networkQuality}
            isScreenShare={mainIsScreenShare}
            on:togglePin={() => togglePin(pinnedTile.id)}
          />
        </div>

        {#if thumbnailTiles.length > 0}
          <div class="thumbnail-strip" aria-label="Other participants">
            {#each thumbnailTiles as tile (tile.id)}
              <div
                class="thumbnail-item"
                in:scale={{ duration: 200, start: 0.85 }}
                out:fade={{ duration: 150 }}
              >
                <ParticipantTile
                  track={tile.videoTrack}
                  name={tile.name}
                  label="{tile.name} video"
                  isActive={tile.isActive}
                  isMuted={tile.isMuted}
                  isCameraOff={tile.isCameraOff}
                  mirror={tile.isLocal}
                  isLocal={tile.isLocal}
                  isPinned={false}
                  isHandRaised={tile.isHandRaised}
                  networkQuality={tile.networkQuality}
                  on:togglePin={() => togglePin(tile.id)}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <!-- ── Grid layout: responsive grid of all participants ── -->
      <div
        class="participants-grid"
        style="--cols: {gridCols}; --rows: {gridRows}"
        aria-label="{totalParticipants} participant{totalParticipants !== 1
          ? 's'
          : ''}"
      >
        {#each allTiles as tile, i (tile.id)}
          <div
            class="grid-item"
            class:grid-item--center-last={lastTileAlone &&
              i === allTiles.length - 1}
            in:scale={{ duration: 220, start: 0.9 }}
            out:fade={{ duration: 150 }}
          >
            <ParticipantTile
              track={tile.videoTrack}
              name={tile.name}
              label="{tile.name} video"
              isActive={tile.isActive}
              isMuted={tile.isMuted}
              isCameraOff={tile.isCameraOff}
              mirror={tile.isLocal}
              isLocal={tile.isLocal}
              isPinned={false}
              isHandRaised={tile.isHandRaised}
              networkQuality={tile.networkQuality}
              on:togglePin={() => togglePin(tile.id)}
            />
          </div>
        {/each}
      </div>
    {/if}

    <!-- Waiting overlay (shown when no remote participants yet) -->
    {#if remoteTiles.length === 0}
      <div class="waiting-overlay" aria-live="polite">
        <div class="waiting-content">
          <div class="waiting-ring" aria-hidden="true">
            <div class="waiting-pulse"></div>
          </div>
          <p class="waiting-label">Waiting for others to join</p>
          <p class="waiting-hint">
            Share the room ID with {session.recipients.join(", ")} to invite them
          </p>
        </div>
      </div>
    {/if}
  </main>

  <!-- Control error (above controls bar) -->
  {#if controlError}
    <div class="control-error" role="alert">
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M8 5v3.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <circle cx="8" cy="11" r="0.75" fill="currentColor" />
      </svg>
      {controlError}
      <button
        type="button"
        class="error-dismiss"
        on:click={() => (controlError = "")}>✕</button
      >
    </div>
  {/if}

  <!-- ── Bottom controls bar ─────────────────────── -->
  <!--
    .controls-inner uses width:max-content + margin-inline:auto to fix the
    classic justify-content:center + overflow-x:auto clipping bug:
    When buttons overflow the bar, centering would push the start of the flex
    content past the left viewport edge, making Mic/Camera unreachable.
    width:max-content makes the inner as wide as its content; margin-inline:auto
    centers it when it fits and becomes a no-op when it overflows, so scroll
    always starts from the left (Mic visible first).
  -->
  <div class="controls-bar" aria-label="Meeting controls">
    <div class="controls-inner">
    <!-- Left group -->
    <div class="ctrl-group">
      <!-- Mic -->
      <button
        type="button"
        class="ctrl-btn"
        class:ctrl-off={!isMicrophoneEnabled}
        disabled={!isConnected || isTogglingAudio}
        aria-pressed={!isMicrophoneEnabled}
        aria-label={isMicrophoneEnabled
          ? "Mute microphone"
          : "Unmute microphone"}
        title={isMicrophoneEnabled ? "Mute" : "Unmute"}
        on:click={toggleMicrophone}
      >
        {#if isMicrophoneEnabled}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M19 10a7 7 0 01-14 0M12 19v3M8 22h8"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line
              x1="1"
              y1="1"
              x2="23"
              y2="23"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v3M8 22h8"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
        <span>{isMicrophoneEnabled ? "Mute" : "Unmute"}</span>
      </button>

      <!-- Camera -->
      <button
        type="button"
        class="ctrl-btn"
        class:ctrl-off={!isCameraEnabled}
        disabled={!isConnected || isTogglingVideo}
        aria-pressed={!isCameraEnabled}
        aria-label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
        title={isCameraEnabled ? "Camera off" : "Camera on"}
        on:click={toggleCamera}
      >
        {#if isCameraEnabled}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 10l5-3v10l-5-3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <rect
              x="2"
              y="6"
              width="11"
              height="12"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line
              x1="1"
              y1="1"
              x2="23"
              y2="23"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M10.7 6H13a2 2 0 012 2v2.3M15 14l5 3V7l-3.2 1.9M2 8a2 2 0 012-2h2M2 12v4a2 2 0 002 2h9a2 2 0 001.1-.3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
        <span>{isCameraEnabled ? "Cam off" : "Cam on"}</span>
      </button>

      <!-- Switch camera — only useful on mobile; hidden via CSS on desktop -->
      <button
        type="button"
        class="ctrl-btn ctrl-flip"
        disabled={!isConnected || !isCameraEnabled || isSwitchingCamera}
        aria-label={isFrontCamera ? "Switch to rear camera" : "Switch to front camera"}
        title={isFrontCamera ? "Use rear camera" : "Use front camera"}
        on:click={switchCamera}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 7h-3.5L15 5H9L7.5 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="2"/>
          <path d="M10 3l2-2 2 2M14 3l-2 2-2-2"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Flip</span>
      </button>
    </div>

    <!-- Center: end call -->
    <button
      type="button"
      class="ctrl-btn ctrl-end"
      disabled={isEndingCall}
      aria-label="End call"
      title="End call"
      on:click={() => dispatch("endCall")}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1A19.4 19.4 0 013.1 10.8 19.8 19.8 0 012.1 2.2 2 2 0 014.1 0h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8.1 7.9a16 16 0 006 6l1.2-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0122 14.9z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
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
        aria-label={isRecordingCall ? "Stop recording" : "Start recording"}
        title={isRecordingCall ? "Stop recording" : "Record"}
        on:click={isRecordingCall ? stopRecordingMedia : startRecordingMedia}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="2"
          />
          {#if isRecordingCall}
            <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
          {:else}
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          {/if}
        </svg>
        <span>{isRecordingCall ? "Stop rec" : "Record"}</span>
      </button>

      <!-- Add people -->
      <button
        type="button"
        class="ctrl-btn"
        aria-label="Add people to this call"
        title="Add people"
        on:click={openAddPeople}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle
            cx="9"
            cy="8"
            r="3.5"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            d="M2 20a6.5 6.5 0 0114 0"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M18 8v6M15 11h6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <span>Add</span>
      </button>

      <!-- Screen share -->
      <button
        type="button"
        class="ctrl-btn"
        class:ctrl-active={isScreenSharing}
        disabled={!isConnected || isTogglingScreenShare}
        aria-pressed={isScreenSharing}
        aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
        title={isScreenSharing ? "Stop sharing" : "Share screen"}
        on:click={toggleScreenShare}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="2"
            y="4"
            width="20"
            height="14"
            rx="2"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            d="M8 20h8M12 18v2"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M10 10l2-2 2 2M12 8v6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{isScreenSharing ? "Sharing" : "Share"}</span>
      </button>

      <!-- Raise hand -->
      <button
        type="button"
        class="ctrl-btn"
        class:ctrl-active={isHandRaisedLocal}
        disabled={!isConnected}
        aria-pressed={isHandRaisedLocal}
        aria-label={isHandRaisedLocal ? "Lower hand" : "Raise hand"}
        title={isHandRaisedLocal ? "Lower hand" : "Raise hand"}
        on:click={toggleRaiseHand}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9 11.5V4.5a1.5 1.5 0 013 0v6M12 10.5V3a1.5 1.5 0 013 0v7.5M15 10.5V5a1.5 1.5 0 013 0v9a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L4 13.8a1.4 1.4 0 012.3-1.6L8 14"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{isHandRaisedLocal ? "Lower" : "Raise"}</span>
      </button>

      <!-- Video quality -->
      <div class="quality-picker-wrap">
        <button
          type="button"
          class="ctrl-btn"
          class:ctrl-active={videoQualityProfile !== "auto"}
          aria-label="Video quality: {QUALITY_LABELS[videoQualityProfile]}"
          title="Video quality"
          on:click={() => (showQualityMenu = !showQualityMenu)}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="2"
              y="5"
              width="20"
              height="14"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M8 12h4M14 9l2 3-2 3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span
            >{videoQualityProfile === "auto"
              ? "Auto"
              : videoQualityProfile === "data-saver"
                ? "Save"
                : videoQualityProfile === "hd"
                  ? "HD"
                  : "FHD"}</span
          >
        </button>

        {#if showQualityMenu}
          <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
          <div
            class="quality-backdrop"
            on:click={() => (showQualityMenu = false)}
          ></div>
          <div
            class="quality-menu"
            role="menu"
            aria-label="Select video quality"
          >
            {#each ["auto", "data-saver", "hd", "fhd"] as VideoQualityProfile[] as profile}
              <button
                type="button"
                role="menuitem"
                class="quality-option"
                class:quality-option--active={videoQualityProfile === profile}
                on:click={() => applyVideoQualityProfile(profile)}
              >
                <span class="quality-check" aria-hidden="true"
                  >{videoQualityProfile === profile ? "✓" : ""}</span
                >
                {QUALITY_LABELS[profile]}
                {#if profile === "hd"}
                  <span class="quality-badge">Recommended</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Full screen -->
      <button
        type="button"
        class="ctrl-btn"
        class:ctrl-active={isFullscreen}
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
        title={isFullscreen ? "Exit full screen" : "Full screen"}
        on:click={toggleFullscreen}
      >
        {#if isFullscreen}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 4H5a1 1 0 00-1 1v4M15 4h4a1 1 0 011 1v4M9 20H5a1 1 0 01-1-1v-4M15 20h4a1 1 0 001-1v-4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
        <span>{isFullscreen ? "Exit" : "Full"}</span>
      </button>
    </div>
    </div><!-- /controls-inner -->
  </div>

  <!-- ── Add people modal ────────────────────────────── -->
  {#if showAddPeople}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      class="add-people-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add people to call"
      tabindex="-1"
      on:click={closeAddPeople}
    >
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div class="add-people-card" on:click|stopPropagation>
        <header class="add-people-header">
          <h2>Add people</h2>
          <button
            type="button"
            class="add-people-close"
            aria-label="Close"
            on:click={closeAddPeople}>✕</button
          >
        </header>

        <input
          type="search"
          class="add-people-search"
          placeholder="Search contacts…"
          bind:value={contactSearch}
          aria-label="Search contacts"
        />

        {#if addPeopleError}
          <p class="add-people-error" role="alert">{addPeopleError}</p>
        {/if}

        <div class="add-people-list">
          <!-- Pending rows (Invite Sent / Rejected) always shown at the top -->
          {#each pendingContacts as contact (contact.id)}
            {@const status = inviteStatuses.get(contact.id)}
            <div
              class="add-people-row"
              class:add-people-row-rejected={status === "rejected"}
            >
              <div class="add-people-avatar" aria-hidden="true">
                {#if status === "invited"}
                  <span>✓</span>
                {:else if status === "rejected"}
                  <span>✕</span>
                {:else if contact.avatarUrl}
                  <img src={contact.avatarUrl} alt="" />
                {:else}
                  <span
                    >{(contact.displayName ?? contact.email ?? "?")
                      .slice(0, 1)
                      .toUpperCase()}</span
                  >
                {/if}
              </div>
              <div class="add-people-name">
                <span class="add-people-display-name"
                  >{contact.displayName ?? contact.email}</span
                >
                {#if contact.displayName}
                  <span class="add-people-email">{contact.email}</span>
                {/if}
              </div>
              {#if status === "invited"}
                <span class="add-people-status-label add-people-status-invited"
                  >Invite Sent</span
                >
              {:else if status === "rejected"}
                <span class="add-people-status-label add-people-status-rejected"
                  >Declined</span
                >
              {:else}
                <span class="add-people-status-label add-people-status-invited"
                  >Sending…</span
                >
              {/if}
            </div>
          {/each}

          <!-- Separator when both pending and available contacts exist -->
          {#if pendingContacts.length > 0 && filteredContacts.length > 0}
            <div class="add-people-divider" aria-hidden="true"></div>
          {/if}

          {#if contactsLoading}
            <p class="add-people-status">Loading contacts…</p>
          {:else if contactsError}
            <p class="add-people-status add-people-error">{contactsError}</p>
          {:else if filteredContacts.length === 0 && pendingContacts.length === 0}
            <p class="add-people-status">No contacts to add.</p>
          {:else}
            {#each filteredContacts as contact (contact.id)}
              {@const status = inviteStatuses.get(contact.id)}
              <div class="add-people-row">
                <div class="add-people-avatar" aria-hidden="true">
                  {#if contact.avatarUrl}
                    <img src={contact.avatarUrl} alt="" />
                  {:else}
                    <span
                      >{(contact.displayName ?? contact.email ?? "?")
                        .slice(0, 1)
                        .toUpperCase()}</span
                    >
                  {/if}
                </div>
                <div class="add-people-name">
                  <span class="add-people-display-name"
                    >{contact.displayName ?? contact.email}</span
                  >
                  {#if contact.displayName}
                    <span class="add-people-email">{contact.email}</span>
                  {/if}
                </div>
                <button
                  type="button"
                  class="add-people-add-btn"
                  class:add-people-add-btn--retry={status === "rejected"}
                  disabled={Boolean(addingUserId)}
                  on:click={() => handleAddParticipant(contact.id)}
                >
                  {status === "rejected" ? "Add Again" : "Add"}
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
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
    gap: 0.75rem;
    min-inline-size: 0;
    flex: 1;
  }

  .meeting-logo {
    display: block;
    flex-shrink: 0;
    inline-size: auto;
    block-size: 2.15rem;
    max-inline-size: 9.5rem;
    object-fit: contain;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-inline-size: 0;
    overflow: hidden;
  }

  .call-type-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: 10px;
    color: #7ecfff;
    background: linear-gradient(
      135deg,
      rgba(126, 207, 255, 0.18),
      rgba(78, 135, 255, 0.08)
    );
    border: 1px solid rgba(126, 207, 255, 0.24);
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
    transition:
      color 300ms ease,
      background-color 300ms ease;
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

  .elapsed-time {
    font-family: var(--font-mono, monospace);
  }

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
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
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
    transition: padding 220ms ease;
  }

  .video-stage.is-spotlight {
    align-items: stretch;
    justify-content: stretch;
  }

  .participants-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr));
    grid-template-rows: repeat(var(--rows, 1), minmax(0, 1fr));
    gap: 0.5rem;
    inline-size: 100%;
    block-size: 100%;
  }

  /* Single participant: cap width so the tile doesn't stretch too wide */
  .participants-grid[style*="--cols: 1"] {
    max-inline-size: min(100%, 72rem);
    margin-inline: auto;
  }

  /* Tiles inside the grid fill their cell; aspect-ratio is enforced by the
     cell dimensions, not by the tile itself, so nothing gets clipped. */
  .participants-grid :global(.tile) {
    aspect-ratio: auto;
    inline-size: 100%;
    block-size: 100%;
  }

  .grid-item {
    min-block-size: 0;
    min-inline-size: 0;
  }

  /* Last tile that sits alone in its row (e.g. 3 tiles in a 2-col grid):
     span the full row and center it at half-width so it matches its siblings. */
  .grid-item--center-last {
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
  }

  .grid-item--center-last :global(.tile) {
    max-inline-size: calc(100% / var(--cols) - var(--cols) * 0.25rem);
  }

  /* ── Spotlight layout: large main view + thumbnail strip ── */
  .spotlight-layout {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    block-size: 100%;
    gap: 0.5rem;
    min-block-size: 0;
  }

  .spotlight-main {
    flex: 1;
    min-block-size: 0;
    min-inline-size: 0;
    display: flex;
  }

  .spotlight-main :global(.tile) {
    inline-size: 100%;
    block-size: 100%;
    aspect-ratio: auto;
  }

  /* Thumbnail strip — horizontal row at the bottom on narrow/medium screens */
  .thumbnail-strip {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    padding-block-end: 0.25rem;
    scrollbar-width: thin;
  }

  .thumbnail-item {
    flex: 0 0 auto;
    inline-size: clamp(7rem, 18vw, 11rem);
    aspect-ratio: 16 / 9;
  }

  .thumbnail-item :global(.tile) {
    inline-size: 100%;
    block-size: 100%;
  }

  /* Wide screens: thumbnail strip becomes a vertical sidebar on the right */
  @media (min-width: 1024px) {
    .spotlight-layout {
      flex-direction: row;
    }

    .thumbnail-strip {
      flex-direction: column;
      flex: 0 0 auto;
      inline-size: clamp(10rem, 16vw, 14rem);
      block-size: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      padding-block-end: 0;
      padding-inline-end: 0.25rem;
    }

    .thumbnail-item {
      inline-size: 100%;
      flex: 0 0 auto;
    }
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
    0%,
    100% {
      transform: scale(0.85);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.1);
      opacity: 1;
    }
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

  .error-dismiss:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  /* ── Controls bar ────────────────────────────────── */
  /*
   * .controls-bar: provides background, border, and clips the scrollable inner.
   *   No overflow here — overflow is handled by .controls-inner.
   *
   * .controls-inner: the scrollable flex row.
   *   width:max-content → always exactly as wide as its buttons.
   *   margin-inline:auto → centers it when the bar is wider (desktop).
   *   When the bar is narrower (mobile overflow), auto margins become 0 and
   *   content starts from the LEFT edge — Mic & Camera are the first visible
   *   buttons, which is the correct scroll start position.
   */
  .controls-bar {
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: thin;
    background: rgba(10, 15, 26, 0.92);
    border-block-start: 1px solid rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(16px);
  }

  .controls-inner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 1.5rem 0.875rem;
    width: max-content;
    margin-inline: auto;
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

  .ctrl-btn:hover:not(:disabled) span {
    color: rgba(255, 255, 255, 0.75);
  }

  .ctrl-btn:active:not(:disabled) {
    transform: translateY(0);
  }

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


  /* End call — red pill, larger */
  .ctrl-btn.ctrl-end {
    background: #dc2626;
    color: #ffffff;
    border-radius: 999px;
    min-inline-size: 5.5rem;
    padding-block: 0.875rem;
    box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35);
  }

  .ctrl-btn.ctrl-end:hover:not(:disabled) {
    background: #b91c1c;
    box-shadow: 0 6px 20px rgba(220, 38, 38, 0.45);
  }

  /* ── Quality picker ─────────────────────────────── */
  .quality-picker-wrap {
    position: relative;
  }

  .quality-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
  }

  .quality-menu {
    position: absolute;
    inset-block-end: calc(100% + 0.5rem);
    inset-inline-end: 0;
    z-index: 65;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-inline-size: 11rem;
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    padding: 0.375rem;
    animation: quality-pop 120ms ease both;
  }

  @keyframes quality-pop {
    from {
      opacity: 0;
      transform: translateY(4px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .quality-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.75);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .quality-option:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .quality-option--active {
    color: #7ecfff;
    background: rgba(78, 135, 255, 0.12);
  }

  .quality-check {
    inline-size: 0.875rem;
    font-size: 0.6875rem;
    color: #7ecfff;
    flex-shrink: 0;
  }

  .quality-badge {
    margin-inline-start: auto;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #34d399;
    background: rgba(52, 211, 153, 0.12);
    border-radius: 999px;
    padding: 0.1rem 0.375rem;
    flex-shrink: 0;
  }

  /* ── Add people modal ────────────────────────────── */
  .add-people-overlay {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
    background: rgba(10, 15, 26, 0.72);
    backdrop-filter: blur(6px);
    padding: 1rem;
  }

  .add-people-card {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
    max-width: 24rem;
    max-height: 70vh;
    border-radius: var(--radius-lg, 16px);
    background: #111827;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    padding: 1.25rem;
    color: rgba(255, 255, 255, 0.88);
    font-family: var(--font-sans);
  }

  .add-people-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .add-people-header h2 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
  }

  .add-people-close {
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    border-radius: 999px;
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    cursor: pointer;
    font-size: 0.75rem;
    margin-bottom: 0;
    display: flex;
    justify-content: center;
  }

  .add-people-close:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
  }

  .add-people-search {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.625rem 0.75rem;
    color: #fff;
    font-size: 0.875rem;
    font-family: var(--font-sans);
  }

  .add-people-search:focus {
    outline: 2px solid rgba(78, 135, 255, 0.6);
    outline-offset: 1px;
  }

  .add-people-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    overflow-y: auto;
  }

  .add-people-status {
    margin: 0.5rem 0;
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
  }

  .add-people-error {
    color: #fca5a5;
    font-size: 0.8125rem;
    margin: 0;
  }

  .add-people-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem;
    border-radius: 10px;
  }

  .add-people-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .add-people-avatar {
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    overflow: hidden;
    display: grid;
    place-items: center;
    background: var(--color-secondary);
    color: #fff;
    font-weight: 700;
    font-size: 0.9375rem;
  }

  .add-people-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .add-people-name {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    flex: 1;
    overflow: hidden;
  }

  .add-people-display-name {
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .add-people-email {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .add-people-add-btn {
    flex-shrink: 0;
    border: none;
    border-radius: 999px;
    background: rgba(78, 135, 255, 0.18);
    color: #7ecfff;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.375rem 0.875rem;
    cursor: pointer;
  }

  .add-people-add-btn:hover:not(:disabled) {
    background: rgba(78, 135, 255, 0.3);
  }

  .add-people-add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-people-row-rejected {
    opacity: 0.75;
  }

  .add-people-status-label {
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .add-people-status-invited {
    color: #34d399;
  }

  .add-people-status-rejected {
    color: #f87171;
  }

  .add-people-add-btn--retry {
    background: rgba(251, 146, 60, 0.18);
    color: #fb923c;
  }

  .add-people-add-btn--retry:hover:not(:disabled) {
    background: rgba(251, 146, 60, 0.3);
  }

  .add-people-divider {
    block-size: 1px;
    background: rgba(255, 255, 255, 0.07);
    margin-block: 0.25rem;
  }

  /* ── Responsive ──────────────────────────────────── */
  @media (max-width: 640px) {
    .meeting-header {
      padding: 0.5rem 0.75rem;
    }

    .header-center {
      order: 3;
      flex: 1 1 100%;
    }

    .meeting-header {
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    /* Mobile: single column, one tile per row stacked vertically */
    .participants-grid {
      grid-template-columns: 1fr !important;
      grid-template-rows: repeat(var(--count, auto), minmax(0, 1fr)) !important;
    }

    /* On mobile every tile spans its own row, so centering is irrelevant */
    .grid-item--center-last {
      grid-column: auto;
      display: block;
    }

    .grid-item--center-last :global(.tile) {
      max-inline-size: 100%;
    }

    /* controls-inner overrides on mobile: tighter gap and padding */
    .controls-inner {
      gap: 0.375rem;
      padding: 0.5rem 0.75rem 0.75rem;
    }

    .ctrl-btn {
      min-inline-size: 3rem;
      padding: 0.625rem;
    }

    /* Hide text labels on mobile — icons only to save space */
    .ctrl-btn span {
      display: none;
    }

    .ctrl-btn.ctrl-end {
      min-inline-size: 3.5rem;
    }

    .waiting-overlay {
      inset-inline-end: 0.5rem;
      inset-block-end: 5rem;
    }
  }

  /* Switch-camera button: only useful on mobile (touchscreen devices with
     multiple cameras). Hidden on desktop where facingMode is not applicable. */
  @media (min-width: 641px) {
    .ctrl-flip {
      display: none;
    }
  }

  /* Tablet: reduce 3-col grid to 2 cols, and recompute rows on the spot */
  @media (max-width: 900px) {
    .participants-grid[style*="--cols: 3"] {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
</style>
