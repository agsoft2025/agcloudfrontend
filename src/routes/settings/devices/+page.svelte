<!--
  /settings/devices — AV Device Preferences
  ==========================================
  Camera / Microphone / Speaker selection with:
  - localStorage persistence via devicePreferencesStore
  - Permission gating + grant flow
  - Hot-plug detection via navigator.mediaDevices.ondevicechange
  - Active-call speaker switching via liveKitClient + switchRoomAudioOutput

  UI redesign: individual cards per device type, wider layout, polished states.
  Script is 100% unchanged from original.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { devicePreferencesStore } from '$lib/stores/device-preferences';
  import { toastStore } from '$lib/stores/toast.store';
  import { activeCallStore } from '$lib/stores/active-call.store';
  import { liveKitClient } from '$lib/livekit/LiveKitClient';
  import { switchRoomAudioOutput, supportsAudioOutputSelection } from '$lib/livekit/audio-output';
  import Button from '$lib/components/atoms/Button.svelte';

  // ── Device lists ──────────────────────────────────────────────────────────────

  interface DeviceOption {
    deviceId: string;
    label: string;
  }

  let cameras: DeviceOption[] = [];
  let microphones: DeviceOption[] = [];
  let speakers: DeviceOption[] = [];

  // ── UI state ──────────────────────────────────────────────────────────────────

  let permissionGranted = false;
  let isRequesting = false;
  let isSwitchingSpeaker = false;
  let loadError: string | null = null;

  $: hasSpeakerSupport = browser && supportsAudioOutputSelection();
  $: isInCall = $activeCallStore.phase === 'in-call';

  // ── Enumerate devices ─────────────────────────────────────────────────────────

  async function loadDevices(requestPermission = false) {
    if (!browser || !navigator.mediaDevices?.enumerateDevices) {
      loadError = 'Media devices are not available in this browser.';
      return;
    }

    let stream: MediaStream | null = null;
    try {
      if (requestPermission) {
        isRequesting = true;
        // Request both audio and video so we get labels for all device kinds
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() =>
          // Fall back to audio-only if camera is unavailable
          navigator.mediaDevices.getUserMedia({ audio: true })
        );
        permissionGranted = true;
      }

      const raw = await navigator.mediaDevices.enumerateDevices();

      cameras = raw
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));

      microphones = raw
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));

      speakers = raw
        .filter((d) => d.kind === 'audiooutput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` }));

      // Detect if we already had labels (permission was previously granted)
      permissionGranted =
        permissionGranted ||
        [...cameras, ...microphones, ...speakers].some((d) => d.label && !d.label.match(/^\w+ \d+$/));

      loadError = null;
    } catch (err) {
      if ((err as DOMException)?.name === 'NotAllowedError') {
        loadError = 'Permission denied. Please allow camera/microphone access in your browser settings.';
      } else {
        loadError = 'Could not enumerate media devices.';
      }
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      isRequesting = false;
    }
  }

  // ── Selection handlers ────────────────────────────────────────────────────────

  function handleCameraChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    devicePreferencesStore.setCamera(val || null);
  }

  function handleMicrophoneChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    devicePreferencesStore.setMicrophone(val || null);
  }

  async function handleSpeakerChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    devicePreferencesStore.setSpeaker(val || null);

    // If there's an active LiveKit room, switch the speaker immediately
    if (isInCall && val) {
      isSwitchingSpeaker = true;
      try {
        const room = liveKitClient.room;
        if (room) {
          await switchRoomAudioOutput(room, val);
          toastStore.success('Speaker switched.');
        }
      } catch (err) {
        toastStore.error('Could not switch speaker during the call.');
        console.error('[DeviceSettings] Speaker switch failed:', err);
      } finally {
        isSwitchingSpeaker = false;
      }
    }
  }

  // ── Hot-plug: re-enumerate when devices connect/disconnect ───────────────────

  function handleDeviceChange() {
    loadDevices(false);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  onMount(() => {
    loadDevices(false);
    if (browser && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }
  });

  onDestroy(() => {
    if (browser && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    }
  });
</script>

<svelte:head>
  <title>Devices | AG Cloud</title>
</svelte:head>

<div class="devices-page">

  <!-- ── Page heading ──────────────────────────────────────────────────────────── -->
  <header class="page-header">
    <h1 class="page-title">Devices</h1>
    <p class="page-subtitle">Configure your camera, microphone, and speaker for calls.</p>
  </header>

  <!-- ── Error banner ──────────────────────────────────────────────────────────── -->
  {#if loadError}
    <div class="banner banner--error" role="alert">
      <span class="banner-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>
      <div class="banner-body">
        <p class="banner-title">Device access error</p>
        <p class="banner-text">{loadError}</p>
      </div>
    </div>
  {/if}

  <!-- ── Permission banner ─────────────────────────────────────────────────────── -->
  {#if !permissionGranted && !loadError}
    <div class="banner banner--info">
      <span class="banner-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
      </span>
      <div class="banner-body">
        <p class="banner-title">Allow device access</p>
        <p class="banner-text">
          Grant microphone and camera permission to see your device names and
          configure them below.
        </p>
      </div>
      <div class="banner-action">
        <Button
          variant="secondary"
          size="sm"
          loading={isRequesting}
          on:click={() => loadDevices(true)}
        >
          Allow access
        </Button>
      </div>
    </div>
  {/if}

  <!-- ── In-call banner ────────────────────────────────────────────────────────── -->
  {#if isInCall}
    <div class="banner banner--live" role="status" aria-live="polite">
      <span class="banner-icon" aria-hidden="true">
        <!-- Animated live dot -->
        <span class="live-dot" aria-hidden="true"></span>
      </span>
      <div class="banner-body">
        <p class="banner-title">You're in a call</p>
        <p class="banner-text">Speaker changes take effect immediately.</p>
      </div>
    </div>
  {/if}

  <!-- ── Device cards ───────────────────────────────────────────────────────────── -->
  <div class="device-cards">

    <!-- Camera card -->
    <div class="device-card">
      <div class="card-header">
        <span class="card-icon card-icon--camera" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M23 7l-7 5 7 5V7z"
              stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"
              stroke="currentColor" stroke-width="1.75" fill="none"/>
          </svg>
        </span>
        <div class="card-meta">
          <h2 class="card-title">Camera</h2>
          <p class="card-desc">Used for video during calls and meetings.</p>
        </div>
        {#if cameras.length > 0}
          <span class="card-count">{cameras.length} found</span>
        {/if}
      </div>

      <div class="card-body">
        <div class="select-field">
          <label class="select-label" for="camera-select">Active camera</label>
          <div class="select-wrap">
            <select
              id="camera-select"
              class="device-select"
              value={$devicePreferencesStore.cameraId ?? ''}
              on:change={handleCameraChange}
              disabled={cameras.length === 0}
            >
              <option value="">
                {cameras.length === 0 ? 'No camera detected' : 'System default'}
              </option>
              {#each cameras as cam (cam.deviceId)}
                <option value={cam.deviceId}>{cam.label}</option>
              {/each}
            </select>
            <span class="select-chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="6 9 12 15 18 9"
                  stroke="currentColor" stroke-width="2.25"
                  stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
          {#if cameras.length === 0 && !loadError}
            <p class="select-hint">
              {permissionGranted
                ? 'No camera was found. Connect a camera and this page will update automatically.'
                : 'Grant access above to see available cameras.'}
            </p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Microphone card -->
    <div class="device-card">
      <div class="card-header">
        <span class="card-icon card-icon--mic" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
              stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"
              stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="19" x2="12" y2="23"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
            <line x1="8" y1="23" x2="16" y2="23"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </span>
        <div class="card-meta">
          <h2 class="card-title">Microphone</h2>
          <p class="card-desc">Captures your voice during calls.</p>
        </div>
        {#if microphones.length > 0}
          <span class="card-count">{microphones.length} found</span>
        {/if}
      </div>

      <div class="card-body">
        <div class="select-field">
          <label class="select-label" for="mic-select">Active microphone</label>
          <div class="select-wrap">
            <select
              id="mic-select"
              class="device-select"
              value={$devicePreferencesStore.microphoneId ?? ''}
              on:change={handleMicrophoneChange}
              disabled={microphones.length === 0}
            >
              <option value="">
                {microphones.length === 0 ? 'No microphone detected' : 'System default'}
              </option>
              {#each microphones as mic (mic.deviceId)}
                <option value={mic.deviceId}>{mic.label}</option>
              {/each}
            </select>
            <span class="select-chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polyline points="6 9 12 15 18 9"
                  stroke="currentColor" stroke-width="2.25"
                  stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </div>
          {#if microphones.length === 0 && !loadError}
            <p class="select-hint">
              {permissionGranted
                ? 'No microphone was found. Connect one and this page will update automatically.'
                : 'Grant access above to see available microphones.'}
            </p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Speaker card -->
    <div class="device-card" class:device-card--live={isInCall && hasSpeakerSupport}>
      <div class="card-header">
        <span class="card-icon card-icon--spk" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
              stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"
              stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"
              stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <div class="card-meta">
          <h2 class="card-title">
            Speaker
            {#if isSwitchingSpeaker}
              <span class="inline-badge inline-badge--switching">Switching…</span>
            {:else if isInCall && hasSpeakerSupport}
              <span class="inline-badge inline-badge--live">Live</span>
            {/if}
          </h2>
          <p class="card-desc">Audio output for call participants.</p>
        </div>
        {#if speakers.length > 0}
          <span class="card-count">{speakers.length} found</span>
        {/if}
      </div>

      <div class="card-body">
        {#if hasSpeakerSupport}
          <div class="select-field">
            <label class="select-label" for="speaker-select">Active speaker</label>
            <div class="select-wrap">
              <select
                id="speaker-select"
                class="device-select"
                value={$devicePreferencesStore.speakerId ?? ''}
                on:change={handleSpeakerChange}
                disabled={speakers.length === 0 || isSwitchingSpeaker}
              >
                <option value="">
                  {speakers.length === 0 ? 'No speaker detected' : 'System default'}
                </option>
                {#each speakers as spk (spk.deviceId)}
                  <option value={spk.deviceId}>{spk.label}</option>
                {/each}
              </select>
              <span class="select-chevron" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <polyline points="6 9 12 15 18 9"
                    stroke="currentColor" stroke-width="2.25"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </div>
            {#if speakers.length === 0 && !loadError}
              <p class="select-hint">
                {permissionGranted
                  ? 'No speaker was found. Connect one and this page will update automatically.'
                  : 'Grant access above to see available speakers.'}
              </p>
            {/if}
          </div>
        {:else}
          <!-- Browser doesn't support audio output selection (non-Chromium) -->
          <div class="unsupported-state">
            <span class="unsupported-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10"
                  stroke="currentColor" stroke-width="1.5"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
            </span>
            <div>
              <p class="unsupported-title">Not supported in this browser</p>
              <p class="unsupported-text">
                Audio output device selection requires Chrome or Edge. Your current
                browser uses the system default speaker.
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>

  </div><!-- /device-cards -->

</div>

<style lang="postcss">
  /* ── Page shell ─────────────────────────────────────────────────────────────── */

  .devices-page {
    max-inline-size: 680px;
    margin-inline: auto;
    padding: 2.5rem 2rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ── Page heading ───────────────────────────────────────────────────────────── */

  .page-header {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .page-title {
    margin: 0;
    font-size: 1.625rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-muted);
    line-height: 1.5;
  }

  /* ── Banners ────────────────────────────────────────────────────────────────── */

  .banner {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem 1.125rem;
    border-radius: var(--radius-md);
    border-width: 1px;
    border-style: solid;
  }

  /* Error */
  .banner--error {
    background: color-mix(in srgb, var(--color-error, #e53e3e) 8%, transparent);
    border-color: color-mix(in srgb, var(--color-error, #e53e3e) 25%, transparent);
    color: var(--color-error, #c53030);
  }

  /* Info / permission */
  .banner--info {
    background: color-mix(in srgb, var(--color-secondary) 7%, var(--color-surface-raised));
    border-color: color-mix(in srgb, var(--color-secondary) 20%, transparent);
    color: var(--color-text);
  }

  /* In-call (green) */
  .banner--live {
    background: color-mix(in srgb, var(--color-success, #38a169) 8%, var(--color-surface-raised));
    border-color: color-mix(in srgb, var(--color-success, #38a169) 25%, transparent);
    color: var(--color-text);
  }

  .banner-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-block-start: 0.125rem;
    /* inherits the banner's color for the svg stroke */
  }

  .banner-body {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .banner-title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .banner-text {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: inherit;
    opacity: 0.8;
  }

  .banner-action {
    flex-shrink: 0;
    align-self: center;
  }

  /* ── Live dot ───────────────────────────────────────────────────────────────── */

  .live-dot {
    display: block;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 999px;
    background: var(--color-success, #38a169);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success, #38a169) 40%, transparent);
    animation: pulse-dot 2s infinite;
  }

  @keyframes pulse-dot {
    0%   { box-shadow: 0 0 0 0    color-mix(in srgb, var(--color-success, #38a169) 40%, transparent); }
    70%  { box-shadow: 0 0 0 6px  color-mix(in srgb, var(--color-success, #38a169) 0%,  transparent); }
    100% { box-shadow: 0 0 0 0    color-mix(in srgb, var(--color-success, #38a169) 0%,  transparent); }
  }

  /* ── Device cards list ──────────────────────────────────────────────────────── */

  .device-cards {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ── Device card ────────────────────────────────────────────────────────────── */

  .device-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.05),
      0 1px 2px rgba(0, 0, 0, 0.03);
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .device-card:hover {
    border-color: var(--color-border-strong);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.07),
      0 1px 3px rgba(0, 0, 0, 0.04);
  }

  /* In-call accent on speaker card */
  .device-card--live {
    border-color: color-mix(in srgb, var(--color-success, #38a169) 35%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-success, #38a169) 15%, transparent),
      0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .device-card--live:hover {
    border-color: color-mix(in srgb, var(--color-success, #38a169) 55%, transparent);
  }

  /* ── Card header ────────────────────────────────────────────────────────────── */

  .card-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    background: var(--color-surface-raised);
    border-block-end: 1px solid var(--color-border);
  }

  /* Device type icon */
  .card-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
  }

  .card-icon--camera {
    background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-secondary) 20%, transparent);
    color: var(--color-secondary);
  }

  .card-icon--mic {
    background: color-mix(in srgb, #a855f7 12%, transparent);
    border-color: color-mix(in srgb, #a855f7 20%, transparent);
    color: #a855f7;
  }

  .card-icon--spk {
    background: color-mix(in srgb, var(--color-success, #38a169) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-success, #38a169) 20%, transparent);
    color: var(--color-success, #38a169);
  }

  .card-meta {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .card-title {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.01em;
    line-height: 1.3;
  }

  .card-desc {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    line-height: 1.4;
  }

  /* "N found" chip */
  .card-count {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 0.2em 0.6em;
    border-radius: 999px;
    background: var(--color-border);
    color: var(--color-muted);
    font-size: 0.75rem;
    font-weight: 600;
    font-family: var(--font-sans);
    white-space: nowrap;
  }

  /* ── Card body ──────────────────────────────────────────────────────────────── */

  .card-body {
    padding: 1.375rem 1.5rem;
  }

  /* ── Inline badges (on card-title) ──────────────────────────────────────────── */

  .inline-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.1em 0.5em;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    vertical-align: middle;
    line-height: 1.6;
  }

  .inline-badge--live {
    background: color-mix(in srgb, var(--color-success, #38a169) 15%, transparent);
    color: var(--color-success, #276749);
  }

  .inline-badge--switching {
    background: color-mix(in srgb, var(--color-secondary) 15%, transparent);
    color: var(--color-secondary);
  }

  /* ── Select field ───────────────────────────────────────────────────────────── */

  .select-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .select-label {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary, var(--color-muted));
    line-height: 1.25;
  }

  /* Wrapper provides the custom chevron via absolute positioning */
  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .device-select {
    inline-size: 100%;
    block-size: 2.875rem;
    padding-inline: 0.875rem 2.5rem;
    background: var(--color-surface-raised);
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    appearance: none;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease,
      background-color 140ms ease;
  }

  .device-select:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-secondary) 18%, transparent);
    background: var(--color-surface);
  }

  .device-select:hover:not(:disabled):not(:focus) {
    border-color: var(--color-border-strong);
    background: var(--color-surface);
  }

  .device-select:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Custom chevron */
  .select-chevron {
    position: absolute;
    inset-inline-end: 0.75rem;
    inset-block: 0;
    display: inline-flex;
    align-items: center;
    pointer-events: none;
    color: var(--color-muted);
  }

  .select-hint {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    font-style: italic;
    line-height: 1.4;
  }

  /* ── Unsupported state (non-Chromium speaker) ───────────────────────────────── */

  .unsupported-state {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    background: color-mix(in srgb, var(--color-border) 60%, transparent);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
  }

  .unsupported-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--color-muted);
    margin-block-start: 0.125rem;
  }

  .unsupported-title {
    margin: 0 0 0.2rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.3;
  }

  .unsupported-text {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    line-height: 1.5;
  }

  /* ── Responsive ─────────────────────────────────────────────────────────────── */

  @media (max-width: 640px) {
    .devices-page {
      padding: 1.5rem 1rem 2rem;
      gap: 1.25rem;
    }

    .card-header {
      padding: 1rem 1.25rem;
      gap: 0.75rem;
    }

    .card-icon {
      inline-size: 2.25rem;
      block-size: 2.25rem;
    }

    .card-body {
      padding: 1.125rem 1.25rem;
    }

    .banner {
      flex-wrap: wrap;
    }

    .banner-action {
      inline-size: 100%;
      margin-inline-start: calc(16px + 0.875rem); /* align with banner-body */
    }
  }

  @media (min-width: 641px) and (max-width: 900px) {
    .devices-page {
      padding: 2rem 1.5rem;
    }
  }
</style>
