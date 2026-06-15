/**
 * ringtone.ts
 *
 * Lightweight Web Audio ringtone/ringback generator — no audio files needed.
 *
 *   startRingback()  — caller side: "Calling… Ringing" (US ringback cadence)
 *   startRingtone()  — callee side: incoming call ringtone (faster, attention-grabbing)
 *   stopRingtone()   — stop whichever is currently playing
 */

let audioCtx: AudioContext | null = null;
let activeNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let scheduleTimer: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctor();
  }

  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }

  return audioCtx;
}

function stopTones() {
  for (const { osc, gain } of activeNodes) {
    try {
      gain.gain.cancelScheduledValues(0);
      osc.stop();
      osc.disconnect();
      gain.disconnect();
    } catch {
      // already stopped
    }
  }
  activeNodes = [];
}

/** Play a chord of `frequencies` for `durationMs`, ramped to avoid clicks. */
function playTone(frequencies: number[], durationMs: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = durationMs / 1000;

  for (const freq of frequencies) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.linearRampToValueAtTime(0.12, now + duration - 0.03);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);

    activeNodes.push({ osc, gain });
  }
}

function loop(pattern: () => number) {
  stopRingtone();

  const tick = () => {
    const waitMs = pattern();
    scheduleTimer = setTimeout(tick, waitMs);
  };

  tick();
}

/** Caller side: standard US ringback — 440Hz + 480Hz, 2s on / 4s off. */
export function startRingback(): void {
  loop(() => {
    playTone([440, 480], 2000);
    return 6000;
  });
}

/** Callee side: incoming call ringtone — short double-beep, 1.5s repeat. */
export function startRingtone(): void {
  loop(() => {
    playTone([480, 620], 400);
    setTimeout(() => playTone([480, 620], 400), 500);
    return 1500;
  });
}

/** Stop any currently playing ringtone/ringback. */
export function stopRingtone(): void {
  if (scheduleTimer !== null) {
    clearTimeout(scheduleTimer);
    scheduleTimer = null;
  }
  stopTones();
}
