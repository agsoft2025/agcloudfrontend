<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { billingStore, graceTick, graceSecondsRemaining } from '$lib/stores/billing.store';
  import { fade, scale } from 'svelte/transition';

  let tickInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    tickInterval = setInterval(() => graceTick.update((n) => n + 1), 1000);
  });

  onDestroy(() => {
    if (tickInterval) clearInterval(tickInterval);
  });

  $: secondsLeft = $graceSecondsRemaining;
  $: totalGrace  = $billingStore.graceDurationSeconds;
  $: isUrgent    = secondsLeft <= 15;
</script>

{#if $billingStore.visible}
  <div class="billing-overlay" transition:fade={{ duration: 180 }}>
    <div
      class="billing-popup"
      class:urgent={isUrgent}
      transition:scale={{ start: 0.92, duration: 220 }}
      role="alertdialog"
      aria-live="assertive"
      aria-label="Free call limit reached"
    >
      <div class="popup-icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>

      <div class="popup-body">
        <h3 class="popup-title">Free call limit reached</h3>
        <p class="popup-message">
          {$billingStore.message}
          Call disconnects in <strong class="countdown" class:urgent={isUrgent}>{secondsLeft}s</strong>.
        </p>
        <a href="/settings/subscription" class="subscribe-link" on:click={() => billingStore.dismiss()}>
          View subscription plans →
        </a>
      </div>

      <div class="popup-timer" aria-hidden="true">
        <svg class="timer-ring" width="48" height="48" viewBox="0 0 48 48">
          <circle class="timer-track" cx="24" cy="24" r="20" fill="none" stroke-width="3"/>
          <circle
            class="timer-progress"
            class:urgent={isUrgent}
            cx="24" cy="24" r="20"
            fill="none"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray={2 * Math.PI * 20}
            stroke-dashoffset={2 * Math.PI * 20 * (1 - secondsLeft / totalGrace)}
            transform="rotate(-90 24 24)"
          />
        </svg>
        <span class="timer-label">{secondsLeft}</span>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .billing-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-block-end: max(2rem, env(safe-area-inset-bottom));
    pointer-events: none;
  }

  .billing-popup {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-radius: 14px;
    max-inline-size: 500px;
    inline-size: calc(100% - 2rem);
    background: var(--pico-card-background-color, #1e1e2e);
    border: 1px solid color-mix(in srgb, var(--pico-primary) 35%, transparent);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    color: var(--pico-color, #cdd6f4);
    transition: border-color 300ms ease;
  }

  .billing-popup.urgent {
    border-color: color-mix(in srgb, var(--pico-del-color, #f38ba8) 60%, transparent);
    animation: pulse-border 800ms ease infinite alternate;
  }

  @keyframes pulse-border {
    from { border-color: color-mix(in srgb, var(--pico-del-color, #f38ba8) 40%, transparent); }
    to   { border-color: color-mix(in srgb, var(--pico-del-color, #f38ba8) 80%, transparent); }
  }

  .popup-icon {
    flex-shrink: 0;
    color: var(--pico-primary, #cba6f7);
    display: grid;
    place-items: center;
  }
  .urgent .popup-icon { color: var(--pico-del-color, #f38ba8); }

  .popup-body { flex: 1; min-inline-size: 0; }

  .popup-title {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .popup-message {
    margin: 0;
    font-size: 0.8125rem;
    opacity: 0.85;
    line-height: 1.4;
  }

  .countdown {
    font-variant-numeric: tabular-nums;
    color: var(--pico-primary, #cba6f7);
    transition: color 300ms ease;
  }
  .countdown.urgent { color: var(--pico-del-color, #f38ba8); }

  .subscribe-link {
    display: inline-block;
    margin-block-start: 0.375rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--pico-primary, #cba6f7);
    text-decoration: none;
    opacity: 0.9;
    transition: opacity 120ms ease;
  }
  .subscribe-link:hover { opacity: 1; text-decoration: underline; }

  .popup-timer {
    position: relative;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    inline-size: 48px;
    block-size: 48px;
  }

  .timer-ring { position: absolute; inset: 0; }

  .timer-label {
    font-size: 0.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    z-index: 1;
    line-height: 1;
  }

  .timer-track { stroke: color-mix(in srgb, currentColor 15%, transparent); }

  .timer-progress {
    stroke: var(--pico-primary, #cba6f7);
    transition: stroke-dashoffset 1s linear, stroke 300ms ease;
  }
  .timer-progress.urgent { stroke: var(--pico-del-color, #f38ba8); }
</style>
