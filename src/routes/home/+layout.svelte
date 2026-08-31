<!--
  home/+layout.svelte — App shell for /home routes
  =================================================
  Wraps the contacts dashboard with the persistent sidebar, mobile
  topbar, and GlobalCallManager. Redirects unauthenticated users.

  NOTE: settings/* uses an identical shell in settings/+layout.svelte.
  The ideal long-term architecture is one shared (app)/+layout.svelte
  that covers both route trees — see routes/(app)/+layout.svelte for
  that target structure.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { authStore } from '$lib/stores/auth.store';
  import { subscriptionStore } from '$lib/stores/subscription.store';
  import { getMySubscription } from '$lib/api/subscription.api';
  import HomeSidebar from '$lib/components/home/HomeSidebar.svelte';
  import type { default as GlobalCallManagerType } from '$lib/components/calls/GlobalCallManager.svelte';

  let mobileNavOpen = false;

  // Loaded lazily post-mount rather than statically imported: GlobalCallManager
  // statically pulls in CallSession, which statically pulls in livekit-client
  // (~120 KB gzipped) — by far the largest dependency in the app. A static
  // import here would put the entire LiveKit SDK on the critical path for
  // every visit to /home, even for users who never make a call. Deferring it
  // to onMount keeps it out of the initial bundle while still having it ready
  // within a tick or two of the page becoming interactive.
  let GlobalCallManager: typeof GlobalCallManagerType | null = null;

  onMount(async () => {
    // ── Subscription fetch ── fire immediately so it runs in parallel with the
    // GlobalCallManager import below. The call screen hides the free-minute chip
    // until this settles, so starting it early minimises the loading window.
    const st = get(subscriptionStore);
    if (!st.loaded && !st.loading) {
      subscriptionStore.setLoading();
      getMySubscription()
        .then((sub) => {
          console.debug('[Subscription] /subscriptions/me →', sub);
          subscriptionStore.setSubscription(sub);
        })
        .catch((err) => {
          console.warn('[Subscription] fetch failed:', err);
          subscriptionStore.setSubscription(null);
        });
    }

    ({ default: GlobalCallManager } = await import('$lib/components/calls/GlobalCallManager.svelte'));
  });

  // Unauthenticated → sign in
  $: if (browser && $authStore.isInitialized && !$authStore.isAuthenticated) {
    goto('/signin', { replaceState: true });
  }

  // Admin role → admin area (keeps user flow unchanged)
  $: if (browser && $authStore.isInitialized && $authStore.isAuthenticated && $authStore.user?.role === 'admin') {
    goto('/admin', { replaceState: true });
  }
</script>

{#if $authStore.isAuthenticated}
  <div class="app-layout">
    <HomeSidebar bind:mobileOpen={mobileNavOpen} />

    <div class="content-shell">
      <!-- Mobile-only topbar with hamburger -->
      <header class="topbar" aria-label="Mobile navigation">
        <button
          class="hamburger"
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          aria-controls="app-sidebar"
          on:click={() => (mobileNavOpen = true)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="topbar-brand">AG Cloud</div>
        <div style="inline-size: 2.25rem;" aria-hidden="true"></div>
      </header>

      <slot />
    </div>
  </div>

  {#if GlobalCallManager}
    <svelte:component this={GlobalCallManager} />
  {/if}
{/if}

<style lang="postcss">
  .app-layout {
    display: flex;
    block-size: 100dvh;
    overflow: hidden;
  }

  .content-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
  }

  .topbar {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border-block-end: 1px solid var(--color-border);
    flex-shrink: 0;
    z-index: 10;
    box-shadow: var(--shadow-xs);
  }

  .hamburger {
    display: grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition:
      background-color 140ms ease,
      border-color 140ms ease;
  }

  .hamburger:hover {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
  }

  .hamburger:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
  }

  .topbar-brand {
    color: var(--color-primary);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  @media (max-width: 800px) {
    .topbar { display: flex; }
  }
</style>
