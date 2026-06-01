<script lang="ts">
  import CallWorkspace from '$lib/components/calls/CallWorkspace.svelte';
  import HomeSidebar, {
    type HomeSection,
    type HomeSidebarItem
  } from '$lib/components/home/HomeSidebar.svelte';

  const sidebarItems: HomeSidebarItem[] = [
    {
      id: 'one-to-one',
      label: 'One-to-One Call',
      description: 'Secure encrypted line'
    }
  ];

  let selectedSection: HomeSection = 'one-to-one';
  let mobileNavOpen = false;
</script>

<svelte:head>
  <title>Home | AG Cloud</title>
  <meta name="description" content="Manage AG Cloud calls." />
</svelte:head>

<div class="app-layout">
  <HomeSidebar
    items={sidebarItems}
    bind:selected={selectedSection}
    bind:mobileOpen={mobileNavOpen}
  />

  <div class="content-shell">
    <!-- Mobile top bar -->
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
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
      </button>

      <div class="topbar-brand">
        <svg width="16" height="16" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M4.5 6.5C4.5 5.12 5.62 4 7 4H15C16.38 4 17.5 5.12 17.5 6.5C17.5 7.88 16.38 9 15 9H13L9.5 12.5V9H7C5.62 9 4.5 7.88 4.5 6.5Z" fill="currentColor" opacity="0.9"/>
          <circle cx="16" cy="16" r="4.5" fill="currentColor" opacity="0.4"/>
          <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
        </svg>
        <span>AG Cloud</span>
      </div>

      <!-- Spacer to visually centre brand -->
      <div style="inline-size: 2.25rem;" aria-hidden="true"></div>
    </header>

    <!-- Main content -->
    <main class="main-content" aria-live="polite">
      <CallWorkspace />
    </main>
  </div>
</div>

<style lang="postcss">
  .app-layout {
    display: flex;
    min-block-size: 100dvh;
    background:
      radial-gradient(circle at 85% 8%, rgba(78, 135, 255, 0.07) 0%, transparent 28rem),
      linear-gradient(135deg, #f8fafc 0%, #f0f7f5 100%);
  }

  .content-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
  }

  /* Mobile-only top bar */
  .topbar {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #ffffff;
    border-block-end: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .hamburger {
    display: grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background-color 140ms ease, border-color 140ms ease;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-primary);
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .topbar-brand svg {
    color: var(--color-secondary);
  }

  .main-content {
    flex: 1;
    min-inline-size: 0;
    min-block-size: 0;
    padding: clamp(0.75rem, 2vw, 1.5rem);
    overflow: auto;
  }

  @media (max-width: 800px) {
    .topbar { display: flex; }
  }
</style>
