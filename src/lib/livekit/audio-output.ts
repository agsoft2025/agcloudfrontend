import { browser } from '$app/environment';
import type { Room } from 'livekit-client';

export interface AudioOutputDevice {
  deviceId: string;
  groupId: string;
  label: string;
}

type SinkElement = HTMLMediaElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export function supportsAudioOutputSelection(): boolean {
  return browser && typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

export async function enumerateAudioOutputDevices(options: { requestPermission?: boolean } = {}) {
  if (!browser || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  let stream: MediaStream | null = null;

  if (options.requestPermission) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices.filter(isAudioOutputDevice).map((device, index) => ({
      deviceId: device.deviceId,
      groupId: device.groupId,
      label: device.label || `Speaker ${index + 1}`
    }));
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

export async function setAudioOutputDevice(deviceId: string, elements: Iterable<HTMLMediaElement>): Promise<void> {
  if (!supportsAudioOutputSelection()) {
    throw new Error('Audio output selection is not supported in this browser.');
  }

  await Promise.all(
    Array.from(elements).map((element) => {
      const sinkElement = element as SinkElement;

      if (!sinkElement.setSinkId) {
        throw new Error('Audio output selection is not supported for this audio element.');
      }

      return sinkElement.setSinkId(deviceId);
    })
  );
}

export async function switchRoomAudioOutput(room: Room, deviceId: string): Promise<boolean> {
  if (!supportsAudioOutputSelection()) {
    throw new Error('Audio output selection is not supported in this browser.');
  }

  return room.switchActiveDevice('audiooutput', deviceId);
}

function isAudioOutputDevice(device: MediaDeviceInfo): device is MediaDeviceInfo {
  return device.kind === 'audiooutput';
}
