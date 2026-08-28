import { writable, derived } from 'svelte/store';

export interface BillingWarningState {
  visible:              boolean;
  graceStartedAt:       number | null;
  graceDurationSeconds: number;
  message:              string;
}

const DEFAULT_GRACE   = 60;
const DEFAULT_MESSAGE = "Your free call limit is over. Please subscribe to continue.";

function createBillingStore() {
  const { subscribe, set } = writable<BillingWarningState>({
    visible:              false,
    graceStartedAt:       null,
    graceDurationSeconds: DEFAULT_GRACE,
    message:              DEFAULT_MESSAGE,
  });

  return {
    subscribe,

    /**
     * Show the warning popup.
     * @param gracePeriodSeconds  From the call:billing:warning socket event. Defaults to 60 s.
     * @param message             Custom warning text from the server.
     */
    showWarning(gracePeriodSeconds = DEFAULT_GRACE, message = DEFAULT_MESSAGE) {
      set({
        visible:              true,
        graceStartedAt:       Date.now(),
        graceDurationSeconds: gracePeriodSeconds,
        message,
      });
    },

    dismiss() {
      set({ visible: false, graceStartedAt: null, graceDurationSeconds: DEFAULT_GRACE, message: DEFAULT_MESSAGE });
    },
  };
}

export const billingStore = createBillingStore();

/** Tick store — increment every second to drive countdown re-derivation. */
export const graceTick = writable<number>(0);

export const graceSecondsRemaining = derived(
  [billingStore, graceTick],
  ([$billing]) => {
    if (!$billing.visible || $billing.graceStartedAt === null) return 0;
    const elapsed = Math.floor((Date.now() - $billing.graceStartedAt) / 1000);
    return Math.max(0, $billing.graceDurationSeconds - elapsed);
  },
);
