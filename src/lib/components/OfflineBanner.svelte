<!--
  OfflineBanner.svelte
  Shows a sticky top banner when the browser loses internet connection.
  Automatically hides when connectivity returns.
  Only rendered in the browser (no SSR flicker).
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  let offline = false;
  let visible = false; // separate flag so we can animate out before hiding

  function handleOffline() {
    offline = true;
    visible = true;
  }

  function handleOnline() {
    offline = false;
    // Keep banner briefly visible with "reconnected" state, then hide.
    setTimeout(() => { visible = false; }, 2000);
  }

  onMount(() => {
    if (!browser) return;
    // Check current state immediately (handles page load while offline).
    if (!navigator.onLine) {
      offline = true;
      visible = true;
    }
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online',  handleOnline);
  });
</script>

{#if visible}
  <div
    class="ob-banner"
    class:ob-banner--offline={offline}
    class:ob-banner--online={!offline}
    role="status"
    aria-live="polite"
    aria-label={offline ? 'You are currently offline' : 'Connection restored'}
  >
    <span class="ob-icon" aria-hidden="true">
      {#if offline}
        <!-- Wifi-off icon -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
          <circle cx="12" cy="20" r="1" fill="currentColor"/>
        </svg>
      {:else}
        <!-- Wifi / check icon -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      {/if}
    </span>

    <span class="ob-text">
      {#if offline}
        You are currently offline
      {:else}
        Connection restored
      {/if}
    </span>
  </div>
{/if}

<style>
  .ob-banner {
    position: fixed;
    inset-block-start: 0;
    inset-inline: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    animation: ob-slide-in 220ms ease;
  }

  .ob-banner--offline {
    background: #ef4444;
    color: #fff;
  }

  .ob-banner--online {
    background: #16a34a;
    color: #fff;
  }

  .ob-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .ob-text {
    white-space: nowrap;
  }

  @keyframes ob-slide-in {
    from { transform: translateY(-100%); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ob-banner { animation: none; }
  }
</style>
