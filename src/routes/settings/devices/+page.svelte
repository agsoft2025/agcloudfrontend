<!--
  /settings/devices — AV Device Preferences
  ==========================================
  Script is UNCHANGED. Layout redesign:
    Grid: [Camera | Microphone] / [Speaker full-width]
    Camera preview: fixed 200px height for balanced card heights
    Speaker body: two-column flex (select left, test right) on desktop
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

  // ── Device lists (UNCHANGED) ──────────────────────────────────────────────────

  interface DeviceOption {
    deviceId: string;
    label: string;
  }

  let cameras: DeviceOption[] = [];
  let microphones: DeviceOption[] = [];
  let speakers: DeviceOption[] = [];

  // ── Core UI state (UNCHANGED) ─────────────────────────────────────────────────

  let permissionGranted = false;
  let isRequesting = false;
  let isSwitchingSpeaker = false;
  let loadError: string | null = null;

  $: hasSpeakerSupport = browser && supportsAudioOutputSelection();
  $: isInCall = $activeCallStore.phase === 'in-call';

  // ── Skeleton state (NEW) ──────────────────────────────────────────────────────

  /** True until the first loadDevices() call resolves, to show loading skeletons */
  let isLoading = true;

  // ── Camera preview state (NEW) ────────────────────────────────────────────────

  let videoEl: HTMLVideoElement;
  let cameraStream: MediaStream | null = null;

  /** Sync the video element's srcObject whenever the stream or the element changes */
  $: if (browser && videoEl) {
    videoEl.srcObject = cameraStream;
  }

  async function startCameraPreview(deviceId: string): Promise<void> {
    stopCameraPreview();
    if (!browser || !permissionGranted) return;
    try {
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : { video: true };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      cameraStream = null; // silently degrade — preview is non-essential
    }
  }

  function stopCameraPreview(): void {
    cameraStream?.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }

  // ── Microphone level meter state (NEW) ───────────────────────────────────────

  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let micStream: MediaStream | null = null;
  /** Live RMS level, 0–100 */
  let micLevel = 0;
  let animFrameId = 0;

  async function startMicMeter(deviceId: string): Promise<void> {
    stopMicMeter();
    if (!browser || !permissionGranted) return;
    try {
      const constraints: MediaStreamConstraints = deviceId
        ? { audio: { deviceId: { exact: deviceId } } }
        : { audio: true };
      micStream = await navigator.mediaDevices.getUserMedia(constraints);
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;

      const source = audioCtx.createMediaStreamSource(micStream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;

      function tick(): void {
        animFrameId = requestAnimationFrame(tick);
        if (++frame % 3 !== 0) return; // throttle to ~20 fps
        if (!analyser) return;
        analyser.getByteTimeDomainData(data);
        // RMS calculation
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const s = (data[i] - 128) / 128;
          sum += s * s;
        }
        micLevel = Math.min(100, Math.sqrt(sum / data.length) * 500);
      }
      tick();
    } catch {
      micLevel = 0; // silently degrade
    }
  }

  function stopMicMeter(): void {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = 0;
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    analyser = null;
    micLevel = 0;
  }

  // ── Speaker test (NEW) ────────────────────────────────────────────────────────

  let isTesting = false;

  async function testSpeaker(): Promise<void> {
    if (isTesting || !browser) return;
    isTesting = true;
    try {
      const ctx = new AudioContext();
      const speakerId = $devicePreferencesStore.speakerId;

      // Chrome 110+ supports AudioContext({ sinkId }) / ctx.setSinkId()
      if (speakerId && hasSpeakerSupport && 'setSinkId' in ctx) {
        await (ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(speakerId);
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // A gentle 880 Hz sine, fades out over 700 ms
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc.start();
      osc.stop(ctx.currentTime + 0.7);

      await new Promise<void>((resolve) => {
        osc.onended = () => {
          ctx.close();
          resolve();
        };
      });
    } catch {
      // silently fail — AudioContext may be unavailable
    } finally {
      isTesting = false;
    }
  }

  // ── Enumerate devices (UNCHANGED logic + skeleton/preview hooks) ──────────────

  async function loadDevices(requestPermission = false): Promise<void> {
    if (!browser || !navigator.mediaDevices?.enumerateDevices) {
      loadError = 'Media devices are not available in this browser.';
      isLoading = false;
      return;
    }

    let stream: MediaStream | null = null;
    try {
      if (requestPermission) {
        isRequesting = true;
        // Request both audio + video to get real labels for all kinds
        stream = await navigator.mediaDevices
          .getUserMedia({ audio: true, video: true })
          .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
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

      // Detect if real labels indicate permission was already granted
      permissionGranted =
        permissionGranted ||
        [...cameras, ...microphones, ...speakers].some(
          (d) => d.label && !d.label.match(/^\w+ \d+$/)
        );

      loadError = null;

      // Start preview + meter once we know permission is available
      if (permissionGranted) {
        startCameraPreview($devicePreferencesStore.cameraId ?? '');
        startMicMeter($devicePreferencesStore.microphoneId ?? '');
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'NotAllowedError') {
        loadError =
          'Permission denied. Please allow camera/microphone access in your browser settings.';
      } else {
        loadError = 'Could not enumerate media devices.';
      }
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      isRequesting = false;
      isLoading = false; // dismiss skeleton
    }
  }

  // ── Selection handlers (UNCHANGED + restart preview/meter) ───────────────────

  function handleCameraChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    devicePreferencesStore.setCamera(val || null);
    if (permissionGranted) startCameraPreview(val);
  }

  function handleMicrophoneChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    devicePreferencesStore.setMicrophone(val || null);
    if (permissionGranted) startMicMeter(val);
  }

  async function handleSpeakerChange(e: Event): Promise<void> {
    const val = (e.target as HTMLSelectElement).value;
    devicePreferencesStore.setSpeaker(val || null);

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

  // ── Hot-plug (UNCHANGED + restart streams) ────────────────────────────────────

  function handleDeviceChange(): void {
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
    stopCameraPreview();
    stopMicMeter();
  });
</script>

<svelte:head>
  <title>Devices | AG Cloud</title>
</svelte:head>

<div class="devices-page">

  <!-- ── Page heading ──────────────────────────────────────────────────────── -->
  <header class="page-header">
    <h1 class="page-title">Devices</h1>
    <p class="page-subtitle">Configure your camera, microphone, and speaker for calls.</p>
  </header>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- LOADING SKELETONS                                                      -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  {#if isLoading}
    <div class="devices-grid" aria-hidden="true">
      <!-- Row 1: camera + mic skeletons -->
      {#each [0, 1] as _i}
        <div class="device-card skeleton-card">
          <div class="card-header">
            <span class="skel skel-icon"></span>
            <div class="card-meta">
              <span class="skel skel-title"></span>
              <span class="skel skel-desc"></span>
            </div>
          </div>
          <div class="card-body">
            <span class="skel skel-label"></span>
            <span class="skel skel-select"></span>
            <span class="skel skel-preview"></span>
          </div>
        </div>
      {/each}
      <!-- Row 2: speaker skeleton, full width -->
      <div class="device-card skeleton-card device-card--full">
        <div class="card-header">
          <span class="skel skel-icon"></span>
          <div class="card-meta">
            <span class="skel skel-title"></span>
            <span class="skel skel-desc"></span>
          </div>
        </div>
        <div class="card-body card-body--speaker">
          <div class="speaker-col">
            <span class="skel skel-label"></span>
            <span class="skel skel-select"></span>
          </div>
          <div class="speaker-col">
            <span class="skel skel-btn"></span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- MAIN CONTENT                                                           -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  {#if !isLoading}

    <!-- Banners ─────────────────────────────────────────────────────────── -->
    {#if loadError}
      <div class="banner banner--error" role="alert">
        <span class="banner-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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

    {#if !permissionGranted && !loadError}
      <div class="banner banner--info">
        <span class="banner-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
            <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </span>
        <div class="banner-body">
          <p class="banner-title">Camera and microphone access required</p>
          <p class="banner-text">
            Grant permission to see your device names and enable live preview
            and input monitoring below.
          </p>
        </div>
        <div class="banner-action">
          <Button variant="secondary" size="sm" loading={isRequesting}
            on:click={() => loadDevices(true)}>
            Allow access
          </Button>
        </div>
      </div>
    {/if}

    {#if isInCall}
      <div class="banner banner--live" role="status" aria-live="polite">
        <span class="banner-icon" aria-hidden="true">
          <span class="live-dot"></span>
        </span>
        <div class="banner-body">
          <p class="banner-title">You're in a call</p>
          <p class="banner-text">Speaker changes take effect immediately.</p>
        </div>
      </div>
    {/if}

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- DEVICE GRID                                                        -->
    <!-- Layout: [Camera | Microphone]                                     -->
    <!--         [Speaker — full width]                                    -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div class="devices-grid">

      <!-- ── CAMERA ────────────────────────────────────────────────────── -->
      <div class="device-card device-card--camera">
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
            <p class="card-desc">Video source for calls and meetings.</p>
          </div>
          {#if cameras.length > 0}
            <span class="status-badge status-badge--active">
              <span class="status-dot" aria-hidden="true"></span>Active
            </span>
          {:else if permissionGranted}
            <span class="status-badge status-badge--unavailable">Unavailable</span>
          {/if}
        </div>

        <div class="card-body">
          <!-- Selector -->
          <div class="select-field">
            <label class="select-label" for="camera-select">Active camera</label>
            <div class="select-wrap">
              <select id="camera-select" class="device-select"
                value={$devicePreferencesStore.cameraId ?? ''}
                on:change={handleCameraChange}
                disabled={cameras.length === 0}>
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
              <p class="field-hint">
                {permissionGranted
                  ? 'No camera detected. Connect one — this page updates automatically.'
                  : 'Allow access above to see available cameras.'}
              </p>
            {/if}
          </div>

          <!-- Live preview panel -->
          <div class="preview-panel" class:preview-panel--active={!!cameraStream}>
            <video
              bind:this={videoEl}
              class="preview-video"
              class:preview-video--visible={!!cameraStream}
              autoplay muted playsinline
              aria-label="Camera preview"
            ></video>

            {#if !cameraStream}
              <div class="preview-placeholder">
                <span class="preview-icon" aria-hidden="true">
                  {#if !permissionGranted}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"
                        stroke="currentColor" stroke-width="1.5" fill="none"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"
                        stroke="currentColor" stroke-width="1.5"
                        stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  {:else}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <line x1="1" y1="1" x2="23" y2="23"
                        stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h3a2 2 0 0 1 2 2v9.34"
                        stroke="currentColor" stroke-width="1.5"
                        stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="12" cy="13" r="3"
                        stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                  {/if}
                </span>
                <p class="preview-placeholder-text">
                  {#if !permissionGranted}Allow access to see preview
                  {:else if cameras.length === 0}No camera connected
                  {:else}Preview unavailable
                  {/if}
                </p>
              </div>
            {/if}

            {#if cameraStream}
              <div class="preview-label" aria-hidden="true">
                <span class="preview-live-dot"></span>Preview
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- ── MICROPHONE ─────────────────────────────────────────────────── -->
      <div class="device-card device-card--mic">
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
            <span class="status-badge status-badge--active">
              <span class="status-dot" aria-hidden="true"></span>Active
            </span>
          {:else if permissionGranted}
            <span class="status-badge status-badge--unavailable">Unavailable</span>
          {/if}
        </div>

        <div class="card-body card-body--mic">
          <!-- Selector -->
          <div class="select-field">
            <label class="select-label" for="mic-select">Active microphone</label>
            <div class="select-wrap">
              <select id="mic-select" class="device-select"
                value={$devicePreferencesStore.microphoneId ?? ''}
                on:change={handleMicrophoneChange}
                disabled={microphones.length === 0}>
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
              <p class="field-hint">
                {permissionGranted
                  ? 'No microphone detected. Connect one — this page updates automatically.'
                  : 'Allow access above to see available microphones.'}
              </p>
            {/if}
          </div>

          <!-- Level meter — grows to fill remaining card height -->
          <div class="meter-section">
            <div class="meter-header">
              <span class="meter-label">Input level</span>
              {#if micStream}
                <span class="meter-status">Monitoring</span>
              {:else}
                <span class="meter-status meter-status--off">
                  {permissionGranted ? 'Inactive' : 'No access'}
                </span>
              {/if}
            </div>

            <div
              class="mic-meter"
              role="meter"
              aria-label="Microphone input level"
              aria-valuenow={Math.round(micLevel)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {#each Array.from({ length: 28 }) as _, segIdx}
                {@const threshold = (segIdx / 28) * 100}
                {@const isActive = micStream && micLevel > threshold}
                {@const isWarn  = threshold >= 70}
                {@const isPeak  = threshold >= 88}
                <span
                  class="meter-seg"
                  class:meter-seg--active={isActive}
                  class:meter-seg--warn={isActive && isWarn && !isPeak}
                  class:meter-seg--peak={isActive && isPeak}
                ></span>
              {/each}
            </div>

            {#if !micStream && permissionGranted && microphones.length > 0}
              <p class="field-hint">Speak to test your microphone input level.</p>
            {/if}
          </div>
        </div>
      </div>

      <!-- ── SPEAKER (full width) ───────────────────────────────────────── -->
      <div class="device-card device-card--full" class:device-card--live={isInCall && hasSpeakerSupport}>
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
          {#if hasSpeakerSupport && speakers.length > 0}
            <span class="status-badge status-badge--active">
              <span class="status-dot" aria-hidden="true"></span>Ready
            </span>
          {:else if !hasSpeakerSupport}
            <span class="status-badge status-badge--unavailable">Limited</span>
          {/if}
        </div>

        {#if hasSpeakerSupport}
          <!-- Two-column body: select left, test right -->
          <div class="card-body card-body--speaker">
            <div class="speaker-col">
              <div class="select-field">
                <label class="select-label" for="speaker-select">Active speaker</label>
                <div class="select-wrap">
                  <select id="speaker-select" class="device-select"
                    value={$devicePreferencesStore.speakerId ?? ''}
                    on:change={handleSpeakerChange}
                    disabled={speakers.length === 0 || isSwitchingSpeaker}>
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
                  <p class="field-hint">
                    {permissionGranted
                      ? 'No speaker detected. Connect one — this page updates automatically.'
                      : 'Allow access above to see available speakers.'}
                  </p>
                {/if}
              </div>
            </div>

            <!-- Test speaker -->
            <div class="speaker-col">
              <div class="speaker-test">
                <div class="speaker-test-info">
                  <p class="speaker-test-title">Test your speaker</p>
                  <p class="speaker-test-hint">
                    Play a short tone through the selected output device to
                    verify your speaker is working correctly.
                  </p>
                </div>
                <Button variant="secondary" size="md"
                  loading={isTesting}
                  disabled={isTesting}
                  on:click={testSpeaker}>
                  {#if !isTesting}
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      aria-hidden="true"
                      style="display:inline-block;vertical-align:middle;margin-inline-end:0.35em"
                    >
                      <polygon points="5 3 19 12 5 21 5 3"
                        stroke="currentColor" stroke-width="1.75"
                        stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Test speaker
                  {:else}
                    Playing…
                  {/if}
                </Button>
              </div>
            </div>
          </div>

        {:else}
          <!-- Non-Chromium: output selection not supported -->
          <div class="card-body">
            <div class="unsupported-state">
              <span class="unsupported-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"
                    stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                </svg>
              </span>
              <div>
                <p class="unsupported-title">Output selection unavailable</p>
                <p class="unsupported-text">
                  Audio output device selection requires Chrome or Edge. Your
                  current browser uses the system default speaker automatically.
                </p>
              </div>
            </div>
          </div>
        {/if}
      </div>

    </div><!-- /devices-grid -->

  {/if}<!-- /!isLoading -->

</div><!-- /devices-page -->

<style lang="postcss">
  /* ══════════════════════════════════════════════════════════════════════════
     PAGE SHELL
  ══════════════════════════════════════════════════════════════════════════ */

  .devices-page {
    max-inline-size: 1100px;
    margin-inline: auto;
    padding: 2.75rem 2.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  /* ── Page heading ──────────────────────────────────────────────────────── */

  .page-header { display: flex; flex-direction: column; gap: 0.4rem; }

  .page-title {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-muted);
    line-height: 1.5;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SKELETON
  ══════════════════════════════════════════════════════════════════════════ */

  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }

  .skel {
    display: block;
    border-radius: 6px;
    background: linear-gradient(
      90deg,
      var(--color-border) 0%,
      var(--color-surface-raised) 50%,
      var(--color-border) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }

  .skel-icon    { inline-size: 2.75rem; block-size: 2.75rem; border-radius: var(--radius-md); flex-shrink: 0; }
  .skel-title   { inline-size: 6rem;    block-size: 0.9rem;  margin-block-end: 0.4rem; }
  .skel-desc    { inline-size: 11rem;   block-size: 0.75rem; }
  .skel-label   { inline-size: 7rem;    block-size: 0.75rem; margin-block-end: 0.5rem; }
  .skel-select  { inline-size: 100%;    block-size: 2.875rem; border-radius: var(--radius-md); }
  .skel-preview { inline-size: 100%;    block-size: 200px;    border-radius: var(--radius-md); margin-block-start: 1.375rem; }
  .skel-btn     { inline-size: 9rem;    block-size: 2.75rem;  border-radius: var(--radius-md); }

  /* ══════════════════════════════════════════════════════════════════════════
     BANNERS
  ══════════════════════════════════════════════════════════════════════════ */

  .banner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 1.375rem;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
  }

  .banner--error {
    background: color-mix(in srgb, var(--color-error, #e53e3e) 8%, transparent);
    border-color: color-mix(in srgb, var(--color-error, #e53e3e) 25%, transparent);
    color: var(--color-error, #c53030);
  }

  .banner--info {
    background: color-mix(in srgb, var(--color-secondary) 7%, var(--color-surface-raised));
    border-color: color-mix(in srgb, var(--color-secondary) 20%, transparent);
    color: var(--color-text);
  }

  .banner--live {
    background: color-mix(in srgb, var(--color-success, #38a169) 8%, var(--color-surface-raised));
    border-color: color-mix(in srgb, var(--color-success, #38a169) 25%, transparent);
    color: var(--color-text);
  }

  .banner-icon  { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; margin-block-start: 0.1rem; }
  .banner-body  { flex: 1; min-inline-size: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .banner-title { margin: 0; font-size: 0.875rem; font-weight: 700; line-height: 1.3; }
  .banner-text  { margin: 0; font-size: 0.8125rem; line-height: 1.5; opacity: 0.8; }
  .banner-action { flex-shrink: 0; align-self: center; }

  .live-dot {
    display: block;
    inline-size: 8px; block-size: 8px;
    border-radius: 999px;
    background: var(--color-success, #38a169);
    animation: pulse-dot 2s infinite;
  }

  @keyframes pulse-dot {
    0%  { box-shadow: 0 0 0 0   color-mix(in srgb, var(--color-success, #38a169) 40%, transparent); }
    70% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-success, #38a169) 0%,  transparent); }
    100%{ box-shadow: 0 0 0 0   color-mix(in srgb, var(--color-success, #38a169) 0%,  transparent); }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DEVICE GRID
     [Camera | Microphone]
     [Speaker — full width ]
  ══════════════════════════════════════════════════════════════════════════ */

  .devices-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.75rem;
    align-items: start;
  }

  /*
    Speaker card spans both columns.
    Cards without this class are in row 1, speaker is in row 2.
  */
  .device-card--full {
    grid-column: 1 / -1;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     DEVICE CARD
  ══════════════════════════════════════════════════════════════════════════ */

  @keyframes card-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }

  .device-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.04);
    transition: border-color 200ms ease, box-shadow 200ms ease;
    animation: card-in 280ms ease both;
  }

  .device-card--camera  { animation-delay:  40ms; }
  .device-card--mic     { animation-delay: 100ms; }
  .device-card--full    { animation-delay: 160ms; }

  .device-card:hover {
    border-color: var(--color-border-strong);
    box-shadow: 0 4px 16px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.05);
  }

  /* In-call accent on speaker */
  .device-card--live {
    border-color: color-mix(in srgb, var(--color-success, #38a169) 35%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-success, #38a169) 12%, transparent),
      0 2px 8px rgba(0,0,0,.06);
  }
  .device-card--live:hover {
    border-color: color-mix(in srgb, var(--color-success, #38a169) 55%, transparent);
  }

  /* ── Card header ──────────────────────────────────────────────────────── */

  .card-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.375rem 1.75rem;
    background: var(--color-surface-raised);
    border-block-end: 1px solid var(--color-border);
  }

  .card-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    inline-size: 2.75rem; block-size: 2.75rem;
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

  .card-meta { flex: 1; min-inline-size: 0; display: flex; flex-direction: column; gap: 0.2rem; }

  .card-title {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
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

  /* Status badges */
  .status-badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25em 0.65em;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: var(--font-sans);
    white-space: nowrap;
    border: 1px solid transparent;
  }

  .status-badge--active {
    background: color-mix(in srgb, var(--color-success, #38a169) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-success, #38a169) 25%, transparent);
    color: var(--color-success, #276749);
  }

  .status-badge--unavailable {
    background: var(--color-border);
    color: var(--color-muted);
  }

  .status-dot {
    display: inline-block;
    inline-size: 6px; block-size: 6px;
    border-radius: 999px;
    background: currentColor;
    animation: pulse-dot 2.5s infinite;
  }

  /* ── Card body ────────────────────────────────────────────────────────── */

  .card-body {
    padding: 1.5rem 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.375rem;
  }

  /*
    Mic card body: flex column, meter section grows to fill the remaining
    height so when the mic card is stretched to match the camera card
    (via align-items: stretch on the grid), the meter fills nicely.
  */
  .card-body--mic {
    flex: 1;
  }

  .card-body--mic .meter-section {
    flex: 1;
  }

  /*
    Speaker card body: two-column flex on desktop (select | test controls).
    Columns are vertically centered for a balanced look.
  */
  .card-body--speaker {
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }

  .speaker-col {
    flex: 1;
    min-inline-size: 0;
  }

  /* Inline badges inside card title */
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

  /* ══════════════════════════════════════════════════════════════════════════
     SELECT FIELD
  ══════════════════════════════════════════════════════════════════════════ */

  .select-field { display: flex; flex-direction: column; gap: 0.45rem; }

  .select-label {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-muted);
    line-height: 1.25;
  }

  .select-wrap { position: relative; display: flex; align-items: center; }

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
    transition: border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
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

  .device-select:disabled { opacity: 0.45; cursor: not-allowed; }

  .select-chevron {
    position: absolute;
    inset-inline-end: 0.75rem;
    inset-block: 0;
    display: inline-flex;
    align-items: center;
    pointer-events: none;
    color: var(--color-muted);
  }

  .field-hint {
    margin: 0.2rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    font-style: italic;
    line-height: 1.45;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CAMERA PREVIEW
     Fixed 200px height so the camera card stays visually balanced with
     the microphone card next to it (no runaway aspect-ratio expansion).
  ══════════════════════════════════════════════════════════════════════════ */

  .preview-panel {
    position: relative;
    block-size: 200px;          /* fixed — keeps row heights balanced      */
    background: #0b0e14;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
    transition: border-color 200ms ease;
  }

  .preview-panel--active { border-color: var(--color-border-strong); }

  .preview-video {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    transform: scaleX(-1);       /* self-view mirror */
    opacity: 0;
    transition: opacity 300ms ease;
  }

  .preview-video--visible { opacity: 1; }

  .preview-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.875rem;
    color: rgba(255,255,255,.35);
    user-select: none;
  }

  .preview-icon { display: inline-flex; }

  .preview-placeholder-text {
    margin: 0;
    font-size: 0.875rem;
    font-family: var(--font-sans);
    text-align: center;
    line-height: 1.45;
    max-inline-size: 14rem;
  }

  .preview-label {
    position: absolute;
    inset-block-start: 0.75rem;
    inset-inline-start: 0.875rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2em 0.6em;
    border-radius: 4px;
    background: rgba(0,0,0,.55);
    color: rgba(255,255,255,.85);
    font-size: 0.6875rem;
    font-weight: 700;
    font-family: var(--font-sans);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    backdrop-filter: blur(4px);
  }

  .preview-live-dot {
    display: inline-block;
    inline-size: 6px; block-size: 6px;
    border-radius: 999px;
    background: #ef4444;
    animation: pulse-dot 2s infinite;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     MICROPHONE METER
  ══════════════════════════════════════════════════════════════════════════ */

  .meter-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    /* flex: 1 is set via .card-body--mic .meter-section above */
  }

  .meter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .meter-label {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-muted);
    line-height: 1.25;
  }

  .meter-status {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-success, #38a169);
  }

  .meter-status--off { color: var(--color-muted); }

  .mic-meter {
    display: flex;
    align-items: stretch;
    gap: 2px;
    block-size: 1.625rem;
    padding: 0.25rem 0;
  }

  .meter-seg {
    flex: 1;
    border-radius: 2px;
    background: var(--color-border);
    transition: background-color 50ms ease;
  }

  .meter-seg--active { background: var(--color-success, #38a169); }
  .meter-seg--warn   { background: #f59e0b; }
  .meter-seg--peak   { background: #ef4444; }

  /* ══════════════════════════════════════════════════════════════════════════
     SPEAKER TEST (inside speaker-col)
  ══════════════════════════════════════════════════════════════════════════ */

  .speaker-test {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.125rem 1.25rem;
    background: color-mix(in srgb, var(--color-border) 35%, transparent);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .speaker-test-info { display: flex; flex-direction: column; gap: 0.25rem; }

  .speaker-test-title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.3;
  }

  .speaker-test-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    line-height: 1.45;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     UNSUPPORTED STATE
  ══════════════════════════════════════════════════════════════════════════ */

  .unsupported-state {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem 1.125rem;
    background: color-mix(in srgb, var(--color-border) 45%, transparent);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
  }

  .unsupported-icon { display: inline-flex; flex-shrink: 0; color: var(--color-muted); margin-block-start: 0.125rem; }
  .unsupported-title { margin: 0 0 0.25rem; font-size: 0.875rem; font-weight: 600; color: var(--color-text); line-height: 1.3; }
  .unsupported-text  { margin: 0; font-size: 0.8125rem; color: var(--color-muted); line-height: 1.5; }

  /* ══════════════════════════════════════════════════════════════════════════
     RESPONSIVE
  ══════════════════════════════════════════════════════════════════════════ */

  /* Tablet — keep two-col grid but tighter padding */
  @media (max-width: 1023px) {
    .devices-page { max-inline-size: 860px; padding: 2rem 2rem 3rem; gap: 1.5rem; }
  }

  /* Narrow tablet — collapse to single column */
  @media (max-width: 800px) {
    .devices-page  { padding: 1.75rem 1.5rem 2.5rem; }
    .devices-grid  { grid-template-columns: 1fr; }
    /* Speaker is already full-width; removing grid-column span is harmless */
    .card-body--speaker {
      flex-direction: column;
      align-items: stretch;
    }
  }

  /* Mobile */
  @media (max-width: 600px) {
    .devices-page  { padding: 1.25rem 1rem 2rem; gap: 1.25rem; }
    .devices-grid  { gap: 1.25rem; }
    .card-header   { padding: 1rem 1.25rem; gap: 0.75rem; }
    .card-icon     { inline-size: 2.25rem; block-size: 2.25rem; }
    .card-body     { padding: 1.125rem 1.25rem; gap: 1rem; }
    .banner        { flex-wrap: wrap; }
    .banner-action { inline-size: 100%; margin-inline-start: calc(18px + 1rem); }
  }
</style>
