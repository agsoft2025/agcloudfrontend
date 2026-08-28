<!--
  SettingsNavItem — Grouped, SaaS-grade settings navigation
  ==========================================================
  Redesigned from a flat collapsible list to a properly grouped,
  always-visible-when-active settings nav.

  Structure:
    [gear] Settings  [chevron]          ← collapses when away from settings
      ┌─ ACCOUNT ─────────────────┐
      │  Profile                   │
      │  Privacy                   │
      └────────────────────────────┘
      ┌─ PREFERENCES ─────────────┐
      │  Devices                   │
      │  Notifications             │
      └────────────────────────────┘

  Active state: left 2px accent bar + bg highlight + icon accent color.
  Auto-expands when any /settings/* route is active.
  Keyboard: Enter/Space → toggle; Escape → close.
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  // ── Link + group types ────────────────────────────────────────────────────────

  interface SettingsLink {
    id: string;
    label: string;
    href: string;
    /** Raw SVG path/shape markup for a 24×24 viewBox */
    icon: string;
  }

  interface SettingsGroup {
    id: string;
    /** Section heading shown above the links */
    label: string;
    links: SettingsLink[];
  }

  // ── Navigation groups ─────────────────────────────────────────────────────────
  //   Account   → identity + data control
  //   Preferences → device + notification config

  const groups: SettingsGroup[] = [
    {
      id: 'account',
      label: 'Account',
      links: [
        {
          id: 'profile',
          label: 'Profile',
          href: '/settings/profile',
          icon:
            '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/>',
        },
        {
          id: 'privacy',
          label: 'Privacy',
          href: '/settings/privacy',
          icon:
            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="1.75" fill="none"/>' +
            '<path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
        },
        {
          id: 'subscription',
          label: 'Subscription',
          href: '/settings/subscription',
          icon:
            '<rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>' +
            '<path d="M2 10h20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
        },
      ],
    },
    {
      id: 'preferences',
      label: 'Preferences',
      links: [
        {
          id: 'devices',
          label: 'Devices',
          href: '/settings/devices',
          icon:
            '<path d="M23 7l-7 5 7 5V7z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<rect x="1" y="5" width="15" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="1.75" fill="none"/>',
        },
        {
          id: 'notifications',
          label: 'Notifications',
          href: '/settings/notifications',
          icon:
            '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
        },
      ],
    },
  ];

  // Flattened for active-route detection
  const allLinks = groups.flatMap((g) => g.links);

  // ── State ─────────────────────────────────────────────────────────────────────

  let isOpen = false;
  let triggerEl: HTMLButtonElement;
  let rootEl: HTMLDivElement;

  $: isOnSettingsRoute = allLinks.some((l) => $page.url.pathname.startsWith(l.href));
  // Auto-expand when navigating into any settings page
  $: if (isOnSettingsRoute) isOpen = true;

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function toggle() {
    isOpen = !isOpen;
  }

  function navigate(href: string) {
    goto(href);
  }

  function handleTriggerKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isOpen = false;
      triggerEl?.focus();
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen && !isOnSettingsRoute) {
      // Only close via Escape when not on a settings route
      // (on a settings route the nav should stay open)
      isOpen = false;
      triggerEl?.focus();
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div bind:this={rootEl} class="settings-nav">

  <!-- ── Trigger button ───────────────────────────────────────────────────────── -->
  <button
    bind:this={triggerEl}
    class="nav-trigger"
    class:is-active={isOnSettingsRoute || isOpen}
    type="button"
    aria-expanded={isOpen}
    aria-haspopup="true"
    on:click={toggle}
    on:keydown={handleTriggerKeydown}
  >
    <span class="trigger-icon" aria-hidden="true">
      <!-- Gear / Settings icon -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
                 a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
                 A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06
                 a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15
                 a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
                 A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06
                 a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68
                 a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
                 a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06
                 a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9
                 a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
                 a1.65 1.65 0 0 0-1.51 1z"
          stroke="currentColor" stroke-width="1.75"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>

    <span class="trigger-label">Settings</span>

    <span class="trigger-chevron" class:is-rotated={isOpen} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <polyline points="6 9 12 15 18 9"
          stroke="currentColor" stroke-width="2.25"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
  </button>

  <!-- ── Grouped panel ─────────────────────────────────────────────────────────── -->
  {#if isOpen}
    <nav class="settings-panel" aria-label="Settings navigation">
      {#each groups as group (group.id)}
        <div class="nav-group">

          <!-- Section heading -->
          <p class="group-label" aria-hidden="true">{group.label}</p>

          <ul class="group-list" role="list">
            {#each group.links as link (link.id)}
              {@const isActive = $page.url.pathname.startsWith(link.href)}
              <li>
                <button
                  class="nav-item"
                  class:is-active={isActive}
                  type="button"
                  role="link"
                  aria-current={isActive ? 'page' : undefined}
                  on:click={() => navigate(link.href)}
                >
                  <span class="item-icon" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      {@html link.icon}
                    </svg>
                  </span>
                  <span class="item-label">{link.label}</span>
                </button>
              </li>
            {/each}
          </ul>

        </div>
      {/each}
    </nav>
  {/if}

</div>

<style lang="postcss">
  /* ── Root container ────────────────────────────────────────────────────────── */

  .settings-nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  /* ── Trigger ───────────────────────────────────────────────────────────────── */

  .nav-trigger {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    inline-size: 100%;
    min-block-size: 2.5rem;
    padding: 0.375rem 0.625rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sidebar-text);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: start;
    cursor: pointer;
    /* No translateX — clean, desktop-appropriate */
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .nav-trigger:hover {
    background: var(--sidebar-hover-bg);
    color: var(--sidebar-text-active);
  }

  .nav-trigger:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
    border-radius: 8px;
  }

  .nav-trigger.is-active {
    color: var(--sidebar-text-active);
  }

  /* ── Trigger internals ─────────────────────────────────────────────────────── */

  .trigger-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    inline-size: 1.125rem;
    block-size: 1.125rem;
    color: var(--sidebar-icon-color);
    transition: color 120ms ease;
  }

  .nav-trigger.is-active .trigger-icon,
  .nav-trigger:hover .trigger-icon {
    color: var(--sidebar-icon-active);
  }

  .trigger-label {
    flex: 1;
    min-inline-size: 0;
    line-height: 1;
  }

  .trigger-chevron {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--sidebar-muted);
    transition: transform 180ms ease;
  }

  .trigger-chevron.is-rotated {
    transform: rotate(180deg);
  }

  /* ── Settings panel ────────────────────────────────────────────────────────── */

  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    /* Smooth reveal */
    animation: panel-in 160ms ease both;
  }

  @keyframes panel-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Navigation group ──────────────────────────────────────────────────────── */

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding-block-start: 0.5rem;
  }

  .nav-group:first-child {
    padding-block-start: 0.25rem;
  }

  /* Section label — uppercase, tracked, muted */
  .group-label {
    margin: 0 0 0.25rem;
    padding-inline: 0.625rem;
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--sidebar-muted);
    user-select: none;
    line-height: 1.5;
  }

  .group-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.0625rem;
    align-items: flex-start;
  }

  /* ── Nav item ──────────────────────────────────────────────────────────────── */

  .nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5625rem;
    inline-size: 100%;
    min-block-size: 2.375rem;
    padding: 0.375rem 0.625rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sidebar-text);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 500;
    text-align: start;
    cursor: pointer;
    /* Left accent bar via pseudo-element */
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .nav-item::before {
    content: '';
    position: absolute;
    inset-block: 20%;
    inset-inline-start: 0;
    inline-size: 2px;
    border-radius: 0 2px 2px 0;
    background: transparent;
    transition: background-color 120ms ease, inset-block 120ms ease;
  }

  /* Hover */
  .nav-item:hover {
    background: var(--sidebar-hover-bg);
    color: var(--sidebar-text-active);
  }

  /* Focus */
  .nav-item:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
    border-radius: 8px;
  }

  /* Active — left accent bar + background + text */
  .nav-item.is-active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-text-active);
    font-weight: 600;
  }

  .nav-item.is-active::before {
    background: var(--sidebar-accent);
    inset-block: 15%;
  }

  /* ── Item icon ─────────────────────────────────────────────────────────────── */

  .item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    inline-size: 0.9375rem;
    block-size: 0.9375rem;
    color: var(--sidebar-icon-color);
    transition: color 120ms ease;
  }

  .nav-item:hover .item-icon {
    color: var(--sidebar-text-active);
  }

  .nav-item.is-active .item-icon {
    color: var(--sidebar-icon-active);
  }

  /* ── Item label ────────────────────────────────────────────────────────────── */

  .item-label {
    flex: 1;
    min-inline-size: 0;
    line-height: 1.25;
  }

  /* ── Separator between groups ──────────────────────────────────────────────── */

  .nav-group + .nav-group {
    border-block-start: 1px solid var(--sidebar-border);
    margin-block-start: 0.25rem;
    padding-block-start: 0.625rem;
  }
</style>
