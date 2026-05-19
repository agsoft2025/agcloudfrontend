import { writable } from 'svelte/store';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastInput {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

const DEFAULT_DURATION = 4_000;

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function dismiss(id: string) {
    const timer = timers.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }

    update((items) => items.filter((toast) => toast.id !== id));
  }

  function show(input: ToastInput) {
    const id = crypto.randomUUID();
    const duration = input.duration ?? DEFAULT_DURATION;
    const toast: Toast = {
      id,
      message: input.message,
      variant: input.variant ?? 'info',
      duration
    };

    update((items) => [...items, toast]);

    if (duration > 0) {
      timers.set(id, setTimeout(() => dismiss(id), duration));
    }

    return id;
  }

  return {
    subscribe,
    show,
    success: (message: string, duration?: number) => show({ message, duration, variant: 'success' }),
    error: (message: string, duration?: number) => show({ message, duration, variant: 'error' }),
    info: (message: string, duration?: number) => show({ message, duration, variant: 'info' }),
    dismiss,
    clear: () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      update(() => []);
    }
  };
}

export const toastStore = createToastStore();
