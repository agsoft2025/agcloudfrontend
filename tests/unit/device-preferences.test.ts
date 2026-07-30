import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

import { devicePreferencesStore } from '../../src/lib/stores/device-preferences';

const STORAGE_KEY = 'agcloud:device-preferences';

beforeEach(() => {
  localStorage.clear();
  devicePreferencesStore.reset();
});

// ── Initial state ────────────────────────────────────────────────────────────

describe('devicePreferencesStore — initial state (after reset())', () => {
  it('has no camera, microphone, or speaker selected', () => {
    expect(get(devicePreferencesStore)).toEqual({
      cameraId: null,
      microphoneId: null,
      speakerId: null,
    });
  });
});

// ── setCamera() / setMicrophone() / setSpeaker() ────────────────────────────

describe('devicePreferencesStore — individual setters', () => {
  it('setCamera() updates only the camera id', () => {
    devicePreferencesStore.setCamera('cam-1');
    const s = get(devicePreferencesStore);
    expect(s.cameraId).toBe('cam-1');
    expect(s.microphoneId).toBeNull();
    expect(s.speakerId).toBeNull();
  });

  it('setMicrophone() updates only the microphone id', () => {
    devicePreferencesStore.setMicrophone('mic-1');
    expect(get(devicePreferencesStore).microphoneId).toBe('mic-1');
  });

  it('setSpeaker() updates only the speaker id', () => {
    devicePreferencesStore.setSpeaker('spk-1');
    expect(get(devicePreferencesStore).speakerId).toBe('spk-1');
  });

  it('setters persist to localStorage', () => {
    devicePreferencesStore.setCamera('cam-1');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.cameraId).toBe('cam-1');
  });

  it('a device can be cleared by passing null', () => {
    devicePreferencesStore.setCamera('cam-1');
    devicePreferencesStore.setCamera(null);
    expect(get(devicePreferencesStore).cameraId).toBeNull();
  });

  it('multiple setters accumulate rather than overwrite each other', () => {
    devicePreferencesStore.setCamera('cam-1');
    devicePreferencesStore.setMicrophone('mic-1');
    devicePreferencesStore.setSpeaker('spk-1');
    expect(get(devicePreferencesStore)).toEqual({
      cameraId: 'cam-1',
      microphoneId: 'mic-1',
      speakerId: 'spk-1',
    });
  });
});

// ── setAll() ─────────────────────────────────────────────────────────────────

describe('devicePreferencesStore — setAll()', () => {
  it('merges a partial update into the current state', () => {
    devicePreferencesStore.setCamera('cam-1');
    devicePreferencesStore.setAll({ microphoneId: 'mic-2' });
    expect(get(devicePreferencesStore)).toEqual({
      cameraId: 'cam-1',
      microphoneId: 'mic-2',
      speakerId: null,
    });
  });

  it('persists the merged result', () => {
    devicePreferencesStore.setAll({ cameraId: 'cam-x', speakerId: 'spk-x' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual({ cameraId: 'cam-x', microphoneId: null, speakerId: 'spk-x' });
  });
});

// ── reset() ──────────────────────────────────────────────────────────────────

describe('devicePreferencesStore — reset()', () => {
  it('clears all preferences back to defaults', () => {
    devicePreferencesStore.setAll({ cameraId: 'cam-1', microphoneId: 'mic-1', speakerId: 'spk-1' });
    devicePreferencesStore.reset();
    expect(get(devicePreferencesStore)).toEqual({
      cameraId: null,
      microphoneId: null,
      speakerId: null,
    });
  });

  it('removes the persisted entry from localStorage', () => {
    devicePreferencesStore.setCamera('cam-1');
    devicePreferencesStore.reset();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

// ── Persisted preferences on load ───────────────────────────────────────────

describe('devicePreferencesStore — persisted preferences on load', () => {
  it('hydrates from localStorage on module load', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cameraId: 'cam-9', microphoneId: 'mic-9', speakerId: null }));
    vi.resetModules();
    const { devicePreferencesStore: fresh } = await import('../../src/lib/stores/device-preferences');
    expect(get(fresh)).toEqual({ cameraId: 'cam-9', microphoneId: 'mic-9', speakerId: null });
  });

  it('falls back to defaults for missing fields in the stored payload', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cameraId: 'cam-9' }));
    vi.resetModules();
    const { devicePreferencesStore: fresh } = await import('../../src/lib/stores/device-preferences');
    expect(get(fresh)).toEqual({ cameraId: 'cam-9', microphoneId: null, speakerId: null });
  });

  it('falls back to defaults on malformed JSON', async () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    vi.resetModules();
    const { devicePreferencesStore: fresh } = await import('../../src/lib/stores/device-preferences');
    expect(get(fresh)).toEqual({ cameraId: null, microphoneId: null, speakerId: null });
  });
});
