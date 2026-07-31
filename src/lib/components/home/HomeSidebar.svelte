<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import NavItem from './NavItem.svelte';
  import SettingsNavItem from './SettingsNavItem.svelte';
  import { signOut } from '$lib/api/auth.api';
  import { authStore, type AuthUser } from '$lib/stores/auth.store';
  import { userStore } from '$lib/stores/user.store';
  import ThemeToggle from '$lib/components/atoms/ThemeToggle.svelte';
  import { contactsDrawerOpen } from '$lib/stores/contacts-drawer.store';

  export let mobileOpen = false;

  let isLoggingOut = false;

  $: user = $authStore.user;
  $: isContactsActive = $page.url.pathname === '/home' || $page.url.pathname.startsWith('/contacts');

  const contactsIcon = '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>';

  const recentCallsIcon = '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.65 3.32 2 2 0 0 1 3.63 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.35 6.35l.98-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>';

  const meetingsIcon = '<rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.75"/>';

  const messagesIcon = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';

  const voicemailsIcon = '<circle cx="5.5" cy="11.5" r="4.5" stroke="currentColor" stroke-width="1.75" fill="none"/><circle cx="18.5" cy="11.5" r="4.5" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="5.5" y1="16" x2="18.5" y2="16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>';

  function closeMobile() { mobileOpen = false; }

  function handleContactsClick() {
    if (isContactsActive) {
      // Already on Contacts page — toggle the drawer open/closed
      contactsDrawerOpen.update((open) => !open);
    } else {
      // Navigating to Contacts — ensure drawer is open
      contactsDrawerOpen.set(true);
      mobileOpen = false;
      goto('/home');
    }
  }

  function getInitials(profile: AuthUser | null) {
    if (profile?.displayName?.trim()) {
      const parts = profile.displayName.trim().split(/\s+/).filter(Boolean);
      return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
    }
    return profile?.email?.[0]?.toUpperCase() ?? 'U';
  }

  function getDisplayName(profile: AuthUser | null) {
    if (profile?.displayName?.trim()) return profile.displayName.trim();
    if (profile?.email) {
      const local = profile.email.split('@')[0];
      return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return 'User';
  }

  function getPlanLabel(profile: AuthUser | null) {
    if (profile?.role?.trim()) {
      return profile.role.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return 'Pro Enterprise';
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    isLoggingOut = true;
    try { await signOut(); } catch { /* ignore */ } finally {
      authStore.clear();
      userStore.clear();
      mobileOpen = false;
      isLoggingOut = false;
      await goto('/signin', { replaceState: true });
    }
  }
</script>

{#if mobileOpen}
  <div
    class="sidebar-backdrop"
    aria-hidden="true"
    on:click={closeMobile}
    on:keydown={(e) => e.key === 'Escape' && closeMobile()}
  ></div>
{/if}

<aside
  id="app-sidebar"
  class="sidebar"
  class:mobile-open={mobileOpen}
  aria-label="Application navigation"
>
  <header class="sidebar-header">
    <div class="brand">
      <img class="brand-logo" src="/logo.png" alt="AG Cloud" width="477" height="312" />
    </div>
    <button class="icon-btn close-btn" type="button" aria-label="Close navigation" on:click={closeMobile}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
    </button>
  </header>

  <div class="sidebar-main">
    <nav class="nav-section" aria-label="Main menu">

      <!-- Contacts: clicking while active toggles the drawer -->
      <NavItem
        label="Contacts"
        description="View and call your contacts"
        active={isContactsActive}
        showArrow={isContactsActive}
        arrowOpen={$contactsDrawerOpen}
        on:click={handleContactsClick}
      >
        <svelte:fragment slot="icon">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
            {@html contactsIcon}
          </svg>
        </svelte:fragment>
      </NavItem>

      <hr class="nav-divider" aria-hidden="true" />
      <SettingsNavItem />
    </nav>
  </div>

  <footer class="sidebar-footer">
    <!--
      Two-row layout:
        Row 1 — user-card (full width): avatar + name/plan.
                 Full inner width (~238 px) means even long names like
                 "Ajayanand Gummi" fit without being clipped.
        Row 2 — footer-controls: ThemeToggle + logout, right-aligned.
                 Keeping controls on their own row ensures the logout button
                 is always visible — it can never be pushed off-screen by
                 a long name in the same horizontal row.
      padding-block-end uses env(safe-area-inset-bottom) so the logout button
      is never hidden behind the iOS home-indicator bar on iPhone X+.
    -->
    <div class="user-card">
      <div class="user-avatar-wrap" aria-hidden="true">
        <span class="user-avatar">{getInitials(user)}</span>
        <span class="user-online-dot"></span>
      </div>
      <div class="user-meta">
        <!--
          title gives a tooltip on hover so the full name is always
          accessible even when ellipsis kicks in for very long names.
        -->
        <strong class="user-name" title={getDisplayName(user)}>{getDisplayName(user)}</strong>
        <small class="user-plan">{getPlanLabel(user)}</small>
      </div>
    </div>
    <div class="footer-controls">
      <ThemeToggle size="sm" />
      <button
        class="logout-btn"
        type="button"
        aria-label="Log out"
        title="Log out"
        disabled={isLoggingOut}
        on:click={handleLogout}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </footer>
</aside>

<style lang="postcss">
  .sidebar {
    --sidebar-width: 270px;
    --sidebar-transition: 260ms cubic-bezier(0.16, 1, 0.3, 1);
    position: sticky;
    inset-block-start: 0;
    block-size: 100dvh;
    inline-size: var(--sidebar-width);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--sidebar-bg);
    border-inline-end: 1px solid var(--sidebar-border);
    /*
     * Split overflow axes:
     *   overflow-x: hidden — clips content that bleeds past the sidebar edge
     *     (important during the transform: translateX slide animation on mobile).
     *   overflow-y: auto   — lets the sidebar scroll if its flex children are
     *     ever taller than the computed sidebar height. Without this, a height
     *     mismatch between block-size: 100dvh and the actual visual viewport
     *     (common on iOS Safari when browser chrome is visible) causes
     *     overflow: hidden to silently clip .sidebar-footer — hiding the logout
     *     button and theme toggle. overflow-y: auto makes that scenario
     *     scrollable instead of invisibly truncated.
     *
     * Note: .sidebar-main already has overflow-y: auto, so in normal operation
     * only .sidebar-main scrolls; .sidebar itself only scrolls as a last resort.
     */
    overflow-x: hidden;
    overflow-y: auto;
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    /*
     * z-index: 59 — must be above the mobile bottom-tab bar (z-index: 50 in
     * home/+page.svelte) and below the sidebar itself (60).
     * When the sidebar drawer is open the dim overlay should cover the tab bar,
     * giving the correct modal-drawer feel on mobile.
     */
    z-index: 59;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    animation: fade-in 200ms ease both;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
    padding: 0.5rem 1rem 0;
    /*
     * With viewport-fit=cover the top of the sidebar can be behind the iOS
     * status bar / notch / Dynamic Island. env(safe-area-inset-top) gives
     * us the exact pixel clearance needed; max() keeps at least 0.5rem of
     * padding on devices without a notch (where the env value is 0).
     */
    padding-block-start: max(0.5rem, env(safe-area-inset-top));
  }

  .brand { display: flex; align-items: center; min-inline-size: 0; }

  .brand-logo {
    display: block;
    block-size: 4.25rem;
    inline-size: auto;
    max-inline-size: 10rem;
    object-fit: contain;
  }

  .icon-btn {
    display: none;
    place-items: center;
    flex-shrink: 0;
    inline-size: 2rem;
    block-size: 2rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sidebar-control-color);
    cursor: pointer;
    padding: 0;
    transition: background-color 140ms ease, color 140ms ease;
  }

  .icon-btn:hover { background: var(--sidebar-control-hover-bg); color: var(--sidebar-control-hover-color); }
  .icon-btn:focus-visible { outline: 2px solid var(--color-secondary); outline-offset: 2px; }

  .sidebar-main {
    flex: 1;
    min-block-size: 0;
    padding: 0.5rem 0.75rem;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--sidebar-border) transparent;
  }

  .nav-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-divider {
    block-size: 1px;
    border: none;
    background: var(--sidebar-border);
    margin-block: 0.5rem;
    margin-inline: 0.25rem;
  }

  /*
   * Sidebar footer: column layout (user-card row, then controls row).
   *
   * WHY COLUMN:
   *   Previously a single horizontal row: [user-card flex:1] [theme] [logout].
   *   The user-card only received ~164 px — not enough for names like
   *   "Ajayanand Gummi" (~121 px at 14 px/700 weight), causing ellipsis.
   *   The logout button was also the LAST element in the row, so on iOS
   *   devices without env(safe-area-inset-bottom) it sat inside the home-
   *   indicator safe zone and appeared hidden.
   *
   *   With a column layout:
   *   • user-card gets the full inner width (~238 px) → no name truncation.
   *   • footer-controls sit on their own row, right-aligned, always visible.
   *   • padding-block-end via max() ensures the row clears the iOS home bar.
   */
  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
    padding: 0.875rem 1rem;
    /* iOS safe-area: ensure controls are above the home-indicator bar */
    padding-block-end: max(1.125rem, env(safe-area-inset-bottom));
    border-block-start: 1px solid var(--sidebar-border);
    background: color-mix(in srgb, var(--sidebar-bg) 80%, transparent);
    backdrop-filter: blur(8px);
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    /* flex: 1 removed — in column footer each child stretches to full width
       automatically; no need to grow in the block direction */
    min-inline-size: 0;
  }

  .user-avatar-wrap { position: relative; flex-shrink: 0; }

  .user-online-dot {
    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 0;
    inline-size: 0.625rem;
    block-size: 0.625rem;
    border-radius: 999px;
    background: var(--color-online);
    border: 2px solid var(--color-surface, #fff);
  }

  .user-avatar {
    display: grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border-radius: 999px;
    background: var(--sidebar-user-avatar-bg);
    color: var(--sidebar-user-avatar-color);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  /* flex: 1 lets user-meta fill all horizontal space in user-card after the
     avatar, giving names the maximum room before ellipsis triggers. */
  .user-meta { flex: 1; display: grid; gap: 0.1rem; min-inline-size: 0; }

  .user-name {
    margin: 0;
    color: var(--sidebar-user-name);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-plan {
    color: var(--sidebar-muted);
    font-size: 0.75rem;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .logout-btn {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 2rem;
    block-size: 2rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sidebar-control-color);
    cursor: pointer;
    padding: 0;
    transition: background-color 140ms ease, color 140ms ease;
  }

  .logout-btn:hover:not(:disabled) { background: var(--sidebar-control-hover-bg); color: var(--sidebar-control-hover-color); }
  .logout-btn:focus-visible { outline: 2px solid var(--color-secondary); outline-offset: 2px; }
  .logout-btn:disabled { cursor: wait; opacity: 0.6; }

  /* Footer controls: theme toggle + logout, pushed to the right */
  .footer-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
  }

  @media (min-width: 801px) { .close-btn { display: none; } }

  @media (max-width: 800px) {
    .sidebar {
      position: fixed;
      inset-block: 0;
      /*
       * CRITICAL: reset block-size so inset-block:0 (top:0; bottom:0) fully
       * controls the sidebar height on mobile instead of the desktop 100dvh.
       *
       * Without this override the base block-size:100dvh value is still active.
       * Per CSS spec, when top + height + bottom are all set on a fixed element
       * the bottom constraint is auto-resolved — so block-size:100dvh wins over
       * inset-block-end:0. On iOS Safari / some Android browsers, 100dvh ≠ true
       * visual-viewport height, causing a height mismatch that silently clips
       * the sidebar footer behind overflow-x:hidden.
       *
       * With block-size:auto and inset-block:0, the sidebar stretches between
       * top:0 and bottom:0 — always exactly the visual viewport height.
       */
      block-size: auto;
      inset-inline-start: 0;
      /*
       * z-index: 60 — the mobile bottom-tab bar (home/+page.svelte) uses 50.
       * The sidebar must sit above it so the footer (logout + theme toggle)
       * is not covered when the drawer is open.
       */
      z-index: 60;
      transform: translateX(-100%);
      transition: transform var(--sidebar-transition), box-shadow var(--sidebar-transition);
      box-shadow: none;
    }
    .sidebar.mobile-open {
      transform: translateX(0);
      box-shadow: 12px 0 48px rgba(0, 0, 0, 0.45);
    }
    .close-btn { display: grid; }
  }
</style>
