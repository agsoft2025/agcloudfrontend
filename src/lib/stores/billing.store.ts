import { writable, derived } from 'svelte/store';

export interface BillingWarningState {
  visible:            boolean;
  graceStartedAt:     number | null;
  graceDurationSeconds: number;
}

const DEFAULT_GRACE = 60;

function createBillingStore() {
  const { subscribe, set } = writable<BillingWarningState>({
    visible:              false,
    graceStartedAt:       null,
    graceDurationSeconds: DEFAULT_GRACE,
  });

  return {
    subscribe,

    /** Show the warning popup.
     *  @param gracePeriodSeconds  Received from the call:billing:warning socket event.
     *                             Falls back to 60 s if not provided.
     */
    showWarning(gracePeriodSeconds = DEFAULT_GRACE) {
      set({
        visible:              true,
        graceStartedAt:       Date.now(),
        graceDurationSeconds: gracePeriodSeconds,
      });
    },

    dismiss() {
      set({ visible: false, graceStartedAt: null, graceDurationSeconds: DEFAULT_GRACE });
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
