<!--
  (app)/+layout.svelte — Authenticated application shell
  =======================================================
  Wraps every protected route with:
    - Auth guard: redirects unauthenticated users to /signin
    - HomeSidebar: persistent left-nav visible on all app pages
    - Mobile topbar: hamburger button shown below 800px
    - GlobalCallManager: handles incoming/active call overlays
    - <slot />: injects the current page's content into the shell

  Route coverage (all share this layout via the (app) group):
    /home              → contacts dashboard
    /settings/profile  → profile edit page
    /settings/*        → future settings pages
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth.store';
  import HomeSidebar from '$lib/components/home/HomeSidebar.svelte';
  import type { default as GlobalCallManagerType } from '$lib/components/calls/GlobalCallManager.svelte';

  let mobileNavOpen = false;

  // See home/+layout.svelte for why this is lazy-loaded rather than a static
  // import: it drags in livekit-client (~120 KB gzipped) transitively via
  // CallSession, and this layout is otherwise unused (no pages currently sit
  // under the (app) route group — see routes/(app)/+layout.svelte's header
  // comment), but keeping it consistent with home/+layout.svelte avoids
  // reintroducing the same bundle regression if/when this group is adopted.
  let GlobalCallManager: typeof GlobalCallManagerType | null = null;

  onMount(async () => {
    ({ default: GlobalCallManager } = await import('$lib/components/calls/GlobalCallManager.svelte'));
  });
</script>

<svelte:head>
  <!-- Prevent layout shift while auth check completes -->
</svelte:head>

<!--
  Auth guard: redirect unauthenticated users away.
  replaceState removes the protected URL from history so Back
  cannot return here after sign-out.
-->
{#if browser && $authStore.isInitialized && !$authStore.isAuthenticated}
  {void goto('/signin', { replaceState: true })}
{/if}

{#if $authStore.isAuthenticated}
  <div class="app-layout">
    <!-- ── Persistent sidebar ──────────────────────────────────── -->
    <HomeSidebar bind:mobileOpen={mobileNavOpen} />

    <!-- ── Main content area ──────────────────────────────────── -->
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
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <div class="topbar-brand">AG Cloud</div>
        <!-- Spacer keeps brand centred on mobile -->
        <div style="inline-size: 2.25rem;" aria-hidden="true"></div>
      </header>

      <!-- Page content injected here -->
      <slot />
    </div>
  </div>

  <!-- Incoming / active call overlay — global, not tied to any route -->
  {#if GlobalCallManager}
    <svelte:component this={GlobalCallManager} />
  {/if}
{/if}

<style lang="postcss">
  /* ── Shell ─────────────────────────────────────────────────── */

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

  /* ── Mobile topbar ─────────────────────────────────────────── */

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
