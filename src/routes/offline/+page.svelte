<!--
  /offline — Offline fallback page
  Served by the service worker when a navigation request fails offline.
  Self-contained: no external fonts, no API calls, works with or without JS.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let isOnline = true;
  let returning = false;

  function getReturnUrl(): string {
    if (typeof window === 'undefined') return '/';
    const params = new URLSearchParams(window.location.search);
    return params.get('from') ?? document.referrer ?? '/';
  }

  function handleOnline() {
    isOnline = true;
    returning = true;
    setTimeout(() => {
      const dest = getReturnUrl();
      window.location.replace(dest && dest !== window.location.href ? dest : '/');
    }, 600);
  }

  function handleOffline() {
    isOnline = false;
    returning = false;
  }

  onMount(() => {
    isOnline = navigator.onLine;
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online',  handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  function retry() {
    window.location.reload();
  }
</script>

<svelte:head>
  <title>You're offline — AG Cloud</title>
</svelte:head>

<div class="offline-root" role="main" aria-live="polite">
  <div class="offline-card">
    <div class="offline-icon" aria-hidden="true">
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </svg>
    </div>

    {#if returning}
      <h1 class="offline-title offline-title--connected">Connected!</h1>
      <p class="offline-desc">Redirecting you back...</p>
    {:else}
      <h1 class="offline-title">You're offline</h1>
      <p class="offline-desc">
        Your device appears to have lost its internet connection.<br />
        Please check your network and try again.
      </p>

      <div class="offline-actions">
        <button class="offline-btn offline-btn--primary" type="button" onclick={retry}>
          Try Again
        </button>
      </div>

      <p class="offline-hint">
        We'll automatically take you back as soon as you're reconnected.
      </p>
    {/if}
  </div>
</div>

<style>
  .offline-root {
    min-block-size: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    background: var(--pico-background-color, #f6f8fb);
    font-family: var(--font-sans, system-ui, sans-serif);
  }

  .offline-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    max-inline-size: 28rem;
    text-align: center;
    padding: 2.5rem 2rem;
    background: var(--pico-card-background-color, #fff);
    border-radius: 1rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  }

  .offline-icon {
    color: var(--pico-muted-color, #999);
    opacity: 0.75;
    margin-block-end: 0.25rem;
  }

  .offline-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--pico-color, #1a1a2e);
    line-height: 1.2;
  }

  .offline-title--connected {
    color: #16a34a;
  }

  .offline-desc {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--pico-muted-color, #666);
  }

  .offline-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-block-start: 0.5rem;
  }

  .offline-btn {
    padding: 0.625rem 1.5rem;
    border-radius: 999px;
    border: none;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 150ms ease, transform 100ms ease;
  }

  .offline-btn:active { transform: scale(0.97); }
  .offline-btn:hover  { opacity: 0.88; }

  .offline-btn--primary {
    background: var(--color-primary, #2563eb);
    color: #fff;
  }

  .offline-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--pico-muted-color, #999);
    line-height: 1.5;
  }

  @media (prefers-color-scheme: dark) {
    .offline-root  { background: #0f172a; }
    .offline-card  { background: #1e293b; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
    .offline-title { color: #f1f5f9; }
    .offline-desc  { color: #94a3b8; }
    .offline-hint  { color: #64748b; }
  }

  /* data-theme is set on <html> — needs :global() to escape Svelte scoping */
  :global([data-theme="dark"]) .offline-root  { background: #0f172a; }
  :global([data-theme="dark"]) .offline-card  { background: #1e293b; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
  :global([data-theme="dark"]) .offline-title { color: #f1f5f9; }
  :global([data-theme="dark"]) .offline-desc  { color: #94a3b8; }
  :global([data-theme="dark"]) .offline-hint  { color: #64748b; }
</style>
