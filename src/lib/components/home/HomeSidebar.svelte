<script lang="ts" context="module">
  export type HomeSection = 'one-to-one';

  export interface HomeSidebarItem {
    id: HomeSection;
    label: string;
    description: string;
  }
</script>

<script lang="ts">
  import NavItem from './NavItem.svelte';

  export let items: HomeSidebarItem[] = [];
  export let selected: HomeSection;
  export let mobileOpen = false;

  let collapsed = false;

  // SVG icon paths keyed by section id
  const icons: Record<string, string> = {
    'one-to-one': `<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none" transform="translate(1,1) scale(0.9)"/>`,
  };

  function handleSelect(id: HomeSection) {
    selected = id;
    mobileOpen = false;
  }

  function closeMobile() {
    mobileOpen = false;
  }
</script>

<!-- Mobile backdrop -->
{#if mobileOpen}
  <div
    class="sidebar-backdrop"
    aria-hidden="true"
    on:click={closeMobile}
    on:keydown={(e) => e.key === 'Escape' && closeMobile()}
  ></div>
{/if}

<aside
  class="sidebar"
  class:collapsed
  class:mobile-open={mobileOpen}
  aria-label="Application navigation"
>
  <!-- Header: brand + controls -->
  <div class="sidebar-header">
    <div class="brand" class:brand-collapsed={collapsed}>
      <div class="brand-mark" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <path d="M4.5 6.5C4.5 5.12 5.62 4 7 4H15C16.38 4 17.5 5.12 17.5 6.5C17.5 7.88 16.38 9 15 9H13L9.5 12.5V9H7C5.62 9 4.5 7.88 4.5 6.5Z" fill="#7ecfff" opacity="0.9"/>
          <circle cx="16" cy="16" r="4.5" fill="#7ecfff" opacity="0.35"/>
          <circle cx="16" cy="16" r="2.5" fill="#7ecfff"/>
        </svg>
      </div>
      {#if !collapsed}
        <div class="brand-text">
          <span class="brand-name">AG Cloud</span>
          <span class="brand-sub">Call Console</span>
        </div>
      {/if}
    </div>

    <!-- Desktop collapse toggle -->
    <button
      class="icon-btn collapse-btn"
      type="button"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand' : 'Collapse'}
      on:click={() => (collapsed = !collapsed)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {#if collapsed}
          <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        {:else}
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        {/if}
      </svg>
    </button>

    <!-- Mobile close button -->
    <button
      class="icon-btn close-btn"
      type="button"
      aria-label="Close navigation"
      on:click={closeMobile}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <!-- Scrollable nav area -->
  <div class="sidebar-body">
    <!-- Workspace section -->
    <nav class="nav-section" aria-label="Workspace">
      {#if !collapsed}
        <p class="section-label">Workspace</p>
      {/if}

      {#each items as item (item.id)}
        <NavItem
          label={item.label}
          description={item.description}
          active={selected === item.id}
          {collapsed}
          on:click={() => handleSelect(item.id)}
        >
          <svelte:fragment slot="icon">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              {@html icons[item.id] ?? ''}
            </svg>
          </svelte:fragment>
        </NavItem>
      {/each}
    </nav>

    <!-- Settings section (structural placeholder) -->
    <nav class="nav-section nav-section--bottom" aria-label="System">
      {#if !collapsed}
        <p class="section-label">System</p>
      {/if}

      <NavItem label="Settings" {collapsed}>
        <svelte:fragment slot="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.75"/>
          </svg>
        </svelte:fragment>
      </NavItem>
    </nav>
  </div>

  <!-- Footer: connection status -->
  <div class="sidebar-footer" class:footer-collapsed={collapsed}>
    <span class="status-pulse" aria-hidden="true"></span>
    {#if !collapsed}
      <div class="status-info">
        <strong>Connected</strong>
        <small>Audio and video ready</small>
      </div>
    {/if}
  </div>
</aside>

<style lang="postcss">
  /* ── Sidebar shell ──────────────────────────────── */
  .sidebar {
    --sidebar-width: 248px;
    --sidebar-collapsed-width: 64px;
    --sidebar-bg: #0c1829;
    --sidebar-border: rgba(255, 255, 255, 0.07);
    --sidebar-transition: 260ms cubic-bezier(0.16, 1, 0.3, 1);

    position: sticky;
    inset-block-start: 0;
    block-size: 100dvh;
    inline-size: var(--sidebar-width);
    display: flex;
    flex-direction: column;
    background: var(--sidebar-bg);
    border-inline-end: 1px solid var(--sidebar-border);
    overflow: hidden;
    flex-shrink: 0;
    transition: inline-size var(--sidebar-transition);

    /* Subtle radial glow top-right */
    background-image:
      radial-gradient(ellipse 80% 40% at 110% 5%, rgba(78, 135, 255, 0.08) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at -10% 85%, rgba(44, 110, 99, 0.07) 0%, transparent 60%);
  }

  .sidebar.collapsed {
    inline-size: var(--sidebar-collapsed-width);
  }

  /* ── Mobile backdrop ────────────────────────────── */
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 39;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    animation: fade-in 200ms ease both;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Header ─────────────────────────────────────── */
  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0.875rem 0.75rem;
    border-block-end: 1px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
  }

  .brand-collapsed {
    justify-content: center;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    flex-shrink: 0;
    border-radius: var(--radius-md);
    background: rgba(126, 207, 255, 0.1);
    border: 1px solid rgba(126, 207, 255, 0.18);
  }

  .brand-text {
    display: grid;
    gap: 0.05rem;
    min-inline-size: 0;
    overflow: hidden;
    animation: fade-slide-in 200ms ease both;
  }

  .brand-name {
    font-size: 0.9375rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .brand-sub {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.38);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    white-space: nowrap;
  }

  /* Icon buttons */
  .icon-btn {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 0;
    transition: background-color 140ms ease, color 140ms ease;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }

  .icon-btn:focus-visible {
    outline: 2px solid rgba(78, 135, 255, 0.6);
    outline-offset: 1px;
  }

  /* Close button: mobile only */
  .close-btn { display: none; }

  /* ── Body ────────────────────────────────────────── */
  .sidebar-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.75rem 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .nav-section {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .nav-section--bottom {
    margin-block-start: auto;
    padding-block-start: 0.75rem;
    border-block-start: 1px solid var(--sidebar-border);
  }

  .section-label {
    margin: 0 0 0.25rem 0.625rem;
    color: rgba(255, 255, 255, 0.28);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    animation: fade-slide-in 180ms ease both;
  }

  /* ── Footer ──────────────────────────────────────── */
  .sidebar-footer {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-shrink: 0;
    padding: 0.875rem 1rem;
    border-block-start: 1px solid var(--sidebar-border);
    background: rgba(0, 0, 0, 0.12);
  }

  .footer-collapsed {
    justify-content: center;
  }

  .status-pulse {
    position: relative;
    flex-shrink: 0;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 999px;
    background: #34d399;
    box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5);
    animation: status-pulse 2.2s ease-out infinite;
  }

  .status-info {
    display: grid;
    gap: 0.1rem;
    min-inline-size: 0;
    overflow: hidden;
    animation: fade-slide-in 200ms ease both;
  }

  .status-info strong {
    margin: 0;
    color: rgba(255, 255, 255, 0.88);
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .status-info small {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.6875rem;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @keyframes status-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.45); }
    70%  { box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }
    100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
  }

  /* ── Shared animation ────────────────────────────── */
  @keyframes fade-slide-in {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  /* ── Mobile (≤800px): drawer behavior ───────────── */
  @media (max-width: 800px) {
    .sidebar {
      position: fixed;
      inset-block: 0;
      inset-inline-start: 0;
      block-size: 100dvh;
      inline-size: var(--sidebar-width) !important;
      z-index: 40;
      transform: translateX(-100%);
      transition:
        transform var(--sidebar-transition),
        box-shadow var(--sidebar-transition);
      box-shadow: none;
    }

    .sidebar.mobile-open {
      transform: translateX(0);
      box-shadow: 12px 0 48px rgba(0, 0, 0, 0.4);
    }

    .collapse-btn { display: none; }
    .close-btn    { display: grid; }
  }
</style>
