<!--
  settings/+layout.svelte — App shell for /settings/* routes
  ===========================================================
  Identical shell to home/+layout.svelte: persistent sidebar,
  mobile topbar, auth guard. No GlobalCallManager here — that
  lives in home/+layout.svelte for call-capable pages.

  NOTE: The ideal long-term architecture is one shared
  (app)/+layout.svelte covering both home and settings route
  trees — see routes/(app)/+layout.svelte for that target.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth.store';
  import HomeSidebar from '$lib/components/home/HomeSidebar.svelte';

  let mobileNavOpen = false;

  $: if (browser && $authStore.isInitialized && !$authStore.isAuthenticated) {
    goto('/signin', { replaceState: true });
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
