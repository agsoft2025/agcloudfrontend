<!--
  CallControlsExample — integration of CallControls with liveKitClient
  =====================================================================
  Shows exactly how to wire CallControls.svelte into an existing
  CallSession-style component that uses liveKitClient and callStore.

  Drop-in replacement for the controls bar in CallSession.svelte:
    1. Import this component (or inline the wiring pattern).
    2. Remove the inline toggle functions from CallSession.
    3. Pass onEndCall from the parent via event / prop.

  State flow:
    liveKitClient.set*Enabled()
         ↓  (triggers RoomEvent)
    bindCallEvents / useCall.ts
         ↓  (calls callStore.syncRoom)
    callStore
         ↓  ($derived in CallControls)
    Button variant + aria-label update
-->
<script lang="ts">
  import { Track, ConnectionState } from 'livekit-client';
  import { callStore } from '$lib/stores/call.store';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import CallControls from '../CallControls.svelte';
  import type { CallControlError } from '../CallControls.types.ts';

  // ── Props from parent (e.g. CallSession) ─────────────────────
  type Props = {
    onEndCall: () => void | Promise<void>;
    /** Whether the participants panel is open (parent tracks this) */
    participantsOpen?: boolean;
    onToggleParticipants?: () => void;
  };

  let {
    onEndCall,
    participantsOpen = false,
    onToggleParticipants,
  }: Props = $props();

  // ── Error display ─────────────────────────────────────────────
  let controlError = $state('');

  function handleError(err: CallControlError) {
    controlError = err.message;
    // Auto-clear after 4s
    setTimeout(() => { controlError = ''; }, 4000);
  }

  // ── Derive current media state from callStore ─────────────────
  //    (used to determine the next toggle target)
  const localTracks = $derived($callStore.localParticipant?.tracks ?? []);

  const isMicOn = $derived(
    Boolean(
      localTracks.find(
        (t) => t.kind === Track.Kind.Audio &&
               t.source === Track.Source.Microphone &&
               !t.isMuted
      )
    )
  );

  const isCameraOn = $derived(
    Boolean(
      localTracks.find(
        (t) => t.kind === Track.Kind.Video &&
               t.source === Track.Source.Camera &&
               !t.isMuted &&
               t.track
      )
    )
  );

  const isScreenSharing = $derived(
    Boolean(
      localTracks.find(
        (t) => t.kind === Track.Kind.Video &&
               t.source === Track.Source.ScreenShare &&
               !t.isMuted &&
               t.track
      )
    )
  );

  // ── Action implementations ────────────────────────────────────
  //    These delegate to liveKitClient and let bindCallEvents /
  //    useCall.ts propagate the state back into callStore.

  async function toggleMic() {
    await liveKitClient.setMicrophoneEnabled(!isMicOn);
    // callStore syncs automatically via RoomEvent.TrackMuted/Unmuted
  }

  async function toggleCamera() {
    const pub = await liveKitClient.setCameraEnabled(!isCameraOn);
    if (!pub && !isCameraOn) {
      throw new Error('Camera unavailable. Check browser permissions.');
    }
  }

  async function toggleScreenShare() {
    await liveKitClient.setScreenShareEnabled(!isScreenSharing);
  }
</script>

<!-- Error banner (optional — swap for Toast if the store is wired) -->
{#if controlError}
  <div
    class="ctrl-error"
    role="alert"
    aria-live="assertive"
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 5v3.5M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    {controlError}
    <button
      type="button"
      class="ctrl-error-dismiss"
      aria-label="Dismiss error"
      onclick={() => (controlError = '')}
    >✕</button>
  </div>
{/if}

<!--
  CallControls wired to real liveKitClient actions.
  Position: parent should render this inside a fixed/absolute container.
-->
<CallControls
  onToggleMic={toggleMic}
  onToggleCamera={toggleCamera}
  onToggleScreenShare={toggleScreenShare}
  {onEndCall}
  {participantsOpen}
  {onToggleParticipants}
  allowScreenShare={true}
  onError={handleError}
/>

<style lang="postcss">
  /* Error banner — matches CallSession.svelte's .control-error style */
  .ctrl-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius-md, 10px);
    background: var(--color-error-bg, #fef2f2);
    border: 1px solid var(--color-error-border, #fecaca);
    color: var(--color-error, #dc2626);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
    animation: fade-in 180ms ease both;
  }

  .ctrl-error-dismiss {
    margin-inline-start: auto;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    padding: 0 0.25rem;
    font-size: 0.75rem;
    line-height: 1;
  }

  .ctrl-error-dismiss:hover {
    opacity: 1;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
