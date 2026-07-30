import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'agcloud:device-preferences';

export interface DevicePreferences {
  cameraId: string | null;
  microphoneId: string | null;
  speakerId: string | null;
}

const defaults: DevicePreferences = {
  cameraId: null,
  microphoneId: null,
  speakerId: null,
};

function loadFromStorage(): DevicePreferences {
  if (!browser) return { ...defaults };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<DevicePreferences>;
    return {
      cameraId: parsed.cameraId ?? null,
      microphoneId: parsed.microphoneId ?? null,
      speakerId: parsed.speakerId ?? null,
    };
  } catch {
    return { ...defaults };
  }
}

function saveToStorage(prefs: DevicePreferences): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

function createDevicePreferencesStore() {
  const { subscribe, set, update } = writable<DevicePreferences>(loadFromStorage());

  return {
    subscribe,

    setCamera(deviceId: string | null) {
      update((prefs) => {
        const next = { ...prefs, cameraId: deviceId };
        saveToStorage(next);
        return next;
      });
    },

    setMicrophone(deviceId: string | null) {
      update((prefs) => {
        const next = { ...prefs, microphoneId: deviceId };
        saveToStorage(next);
        return next;
      });
    },

    setSpeaker(deviceId: string | null) {
      update((prefs) => {
        const next = { ...prefs, speakerId: deviceId };
        saveToStorage(next);
        return next;
      });
    },

    /** Replace all preferences at once and persist. */
    setAll(prefs: Partial<DevicePreferences>) {
      update((current) => {
        const next = { ...current, ...prefs };
        saveToStorage(next);
        return next;
      });
    },

    reset() {
      set({ ...defaults });
      if (browser) {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      }
    },
  };
}

export const devicePreferencesStore = createDevicePreferencesStore();
