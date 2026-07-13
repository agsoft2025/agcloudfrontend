<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Track } from 'livekit-client';
  import type { Track as LiveKitTrack } from 'livekit-client';

  export let track: LiveKitTrack | undefined;
  export let label: string;
  export let muted = false;
  export let mirror = false;

  let videoElement: HTMLVideoElement;
  let audioElement: HTMLAudioElement;
  let attachedTrack: LiveKitTrack | undefined;
  let attachedElement: HTMLMediaElement | undefined;

  $: isVideo = track?.kind === Track.Kind.Video;
  $: currentElement = isVideo ? videoElement : audioElement;
  $: attachTrack(track, currentElement);

  onDestroy(() => {
    detachTrack();
  });

  async function attachTrack(nextTrack: LiveKitTrack | undefined, element: HTMLMediaElement | undefined) {
    if (!nextTrack || !element) return;

    if (attachedTrack === nextTrack && attachedElement === element) {
      return;
    }

    detachTrack();
    nextTrack.attach(element);

    if (!element.srcObject && 'mediaStreamTrack' in nextTrack) {
      const mediaStreamTrack = nextTrack.mediaStreamTrack;
      if (mediaStreamTrack instanceof MediaStreamTrack) {
        element.srcObject = new MediaStream([mediaStreamTrack]);
      }
    }

    attachedTrack = nextTrack;
    attachedElement = element;

    try {
      await element.play();
    } catch (error) {
      console.warn('LiveKit media playback did not start automatically.', error);
    }
  }

  function detachTrack() {
    if (attachedTrack && attachedElement) {
      attachedTrack.detach(attachedElement);
      attachedElement.srcObject = null;
    }

    attachedTrack = undefined;
    attachedElement = undefined;
  }
</script>

{#if isVideo}
  <video
    class:mirror
    bind:this={videoElement}
    autoplay
    muted
    playsinline
    aria-label={label}
  ></video>
{:else}
  <audio bind:this={audioElement} autoplay {muted} aria-label={label}></audio>
{/if}

<style lang="postcss">
  video {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: inherit;
    /* contain shows the full camera/screen-share frame without cropping */
    object-fit: contain;
    background: transparent; /* letterbox colour comes from the parent tile */
  }

  .mirror {
    transform: scaleX(-1);
  }
</style>
