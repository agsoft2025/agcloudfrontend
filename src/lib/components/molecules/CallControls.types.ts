/**
 * CallControls — shared TypeScript types
 *
 * State is read directly from callStore — no state props needed.
 * The parent supplies action callbacks so the component stays
 * decoupled from the LiveKit transport layer.
 */

/**
 * Async action contract the parent must fulfil.
 * Wire these to liveKitClient.set*Enabled() in the integration layer.
 *
 * @example
 *   const actions: CallControlsActions = {
 *     onToggleMic:         () => liveKitClient.setMicrophoneEnabled(!isMicEnabled),
 *     onToggleCamera:      () => liveKitClient.setCameraEnabled(!isCameraEnabled),
 *     onToggleScreenShare: () => liveKitClient.setScreenShareEnabled(!isScreenSharing),
 *     onEndCall:           () => handleEndActiveCall(),
 *   };
 */
export interface CallControlsActions {
  /** Toggle local microphone mute state. */
  onToggleMic: () => Promise<void>;
  /** Toggle local camera on/off. */
  onToggleCamera: () => Promise<void>;
  /** Toggle screen share. Optional — omit to hide the screen share button. */
  onToggleScreenShare?: () => Promise<void>;
  /** Leave / end the active call. */
  onEndCall: () => void | Promise<void>;
  /** Open / close the participants panel. Optional. */
  onToggleParticipants?: () => void;
  /** Open / close the chat panel. Optional. */
  onToggleChat?: () => void;
}

/** Runtime error that surfaced while executing a control action. */
export interface CallControlError {
  action: 'mic' | 'camera' | 'screen-share' | 'end-call';
  message: string;
}
