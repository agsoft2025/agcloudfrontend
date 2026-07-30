<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy, onMount } from 'svelte';
  import type { CallType } from '$lib/api/calls.api';

  export let callType: CallType = 'video';

  let videoElement: HTMLVideoElement;
  let stream: MediaStream | null = null;
  let error = '';
  let isLoading = false;

  $: hasVideo = callType === 'video';

  onMount(() => {
    void startPreview();
  });

  onDestroy(() => {
    stopPreview();
  });

  async function startPreview() {
    if (!browser) return;

    stopPreview();
    error = '';
    isLoading = true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: hasVideo
      });

      if (videoElement && hasVideo) {
        videoElement.srcObject = stream;
      }
    } catch {
      error = hasVideo
        ? 'Camera access is unavailable. Check browser permissions and try again.'
        : 'Microphone access is unavailable. Check browser permissions and try again.';
    } finally {
      isLoading = false;
    }
  }

  function stopPreview() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;

    if (videoElement) {
      videoElement.srcObject = null;
    }
  }
</script>

<div class="preview" data-audio-only={!hasVideo}>
  {#if hasVideo}
    <video bind:this={videoElement} autoplay muted playsinline aria-label="Your video preview"></video>
  {:else}
    <div class="audio-preview" aria-label="Your audio preview">
      <span aria-hidden="true"></span>
      <strong>Audio call</strong>
    </div>
  {/if}

  {#if isLoading}
    <p class="overlay">Starting preview...</p>
  {:else if error}
    <div class="overlay error" role="alert">
      <p>{error}</p>
      <button type="button" on:click={startPreview}>Retry</button>
    </div>
  {/if}
</div>

<style lang="postcss">
  .preview {
    position: relative;
    min-block-size: clamp(18rem, 42vw, 32rem);
    overflow: hidden;
    border-radius: var(--radius-md);
    background: #101820;
  }

  video {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: inherit;
    object-fit: cover;
    transform: scaleX(-1);
  }

  .audio-preview {
    display: grid;
    place-items: center;
    gap: var(--space-md);
    min-block-size: inherit;
    color: var(--color-surface);
  }

  .audio-preview span {
    inline-size: 4rem;
    block-size: 4rem;
    border-radius: 999px;
    background:
      radial-gradient(circle at center, var(--color-secondary) 0 35%, transparent 36%),
      color-mix(in srgb, var(--color-secondary) 18%, transparent);
  }

  .audio-preview strong {
    font-size: 1.2rem;
  }

  .overlay {
    position: absolute;
    inset: var(--space-md);
    display: grid;
    place-items: center;
    margin: 0;
    border-radius: var(--radius-md);
    background: rgb(16 24 32 / 76%);
    color: var(--color-surface);
    font-weight: 800;
    text-align: center;
  }

  .overlay.error {
    align-content: center;
    gap: var(--space-md);
    padding: var(--space-lg);
  }

  .overlay p {
    margin: 0;
    max-inline-size: 24rem;
    line-height: 1.45;
  }

  .overlay button {
    min-block-size: 2.5rem;
    border: 1px solid var(--color-surface);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-primary);
    font-family: var(--font-sans);
    font-weight: 800;
    padding: 0 var(--space-lg);
    cursor: pointer;
  }
</style>
