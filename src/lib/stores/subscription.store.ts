import { writable, derived } from 'svelte/store';
import type { UserSubscription } from '$lib/api/subscription.api';

interface SubscriptionState {
  subscription: UserSubscription | null;
  loading: boolean;
  error: string;
  /** True once at least one fetch has completed (success or failure). */
  loaded: boolean;
}

function createSubscriptionStore() {
  const { subscribe, update, set } = writable<SubscriptionState>({
    subscription: null,
    loading: false,
    error: '',
    loaded: false,
  });

  return {
    subscribe,
    set,

    setLoading() {
      update((s) => ({ ...s, loading: true, error: '' }));
    },

    setSubscription(sub: UserSubscription | null) {
      update(() => ({ subscription: sub, loading: false, error: '', loaded: true }));
    },

    setError(msg: string) {
      update((s) => ({ ...s, loading: false, error: msg, loaded: true }));
    },

    clear() {
      set({ subscription: null, loading: false, error: '', loaded: false });
    },
  };
}

export const subscriptionStore = createSubscriptionStore();

/** True if the user has an active, non-expired subscription. */
export const hasActiveSubscription = derived(subscriptionStore, ($s) => {
  if (!$s.subscription || $s.subscription.status !== 'active') return false;
  if (!$s.subscription.endDate) return false;
  return new Date($s.subscription.endDate) > new Date();
});

/** Days remaining for the current active subscription (0 if none/expired). */
export const daysRemaining = derived(subscriptionStore, ($s) => {
  if (!$s.subscription?.endDate) return 0;
  const ms = new Date($s.subscription.endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
});
