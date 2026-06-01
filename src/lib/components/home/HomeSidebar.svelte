<script lang="ts" context="module">
  export type HomeSection = 'one-to-one';

  export interface HomeSidebarItem {
    id: HomeSection;
    label: string;
    description: string;
  }
</script>

<script lang="ts">
  import { goto } from '$app/navigation';
  import NavItem from './NavItem.svelte';
  import { signOut } from '$lib/api/auth.api';
  import { authStore, type AuthUser } from '$lib/stores/auth.store';
  import { userStore } from '$lib/stores/user.store';

  export let items: HomeSidebarItem[] = [];
  export let selected: HomeSection;
  export let mobileOpen = false;

  let isLoggingOut = false;

  $: user = $authStore.user;

  const phoneIcon = `<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

  function handleSelect(id: HomeSection) {
    selected = id;
    mobileOpen = false;
  }

  function closeMobile() {
    mobileOpen = false;
  }

  function getInitials(profile: AuthUser | null) {
    if (profile?.displayName?.trim()) {
      const parts = profile.displayName.trim().split(/\s+/).filter(Boolean);
      return parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
    }

    return profile?.email?.[0]?.toUpperCase() ?? 'U';
  }

  function getDisplayName(profile: AuthUser | null) {
    if (profile?.displayName?.trim()) {
      return profile.displayName.trim();
    }

    if (profile?.email) {
      const local = profile.email.split('@')[0];
      return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }

    return 'User';
  }

  function getPlanLabel(profile: AuthUser | null) {
    if (profile?.role?.trim()) {
      return profile.role
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    return 'Pro Enterprise';
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    isLoggingOut = true;

    try {
      await signOut();
    } catch {
      /* Clear local session even if the API call fails */
    } finally {
      authStore.clear();
      userStore.clear();
      mobileOpen = false;
      isLoggingOut = false;
      await goto('/signin');
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
      <span class="brand-mark" aria-hidden="true">
        <svg class="brand-icon" width="20" height="20" viewBox="0 0 22 22" fill="none">
          <path
            d="M4.5 6.5C4.5 5.12 5.62 4 7 4H15C16.38 4 17.5 5.12 17.5 6.5C17.5 7.88 16.38 9 15 9H13L9.5 12.5V9H7C5.62 9 4.5 7.88 4.5 6.5Z"
            fill="currentColor"
            opacity="0.95"
          />
          <circle cx="16" cy="16" r="4.5" fill="currentColor" opacity="0.35" />
          <circle cx="16" cy="16" r="2.5" fill="currentColor" />
        </svg>
      </span>
      <span class="brand-name">AG Cloud</span>
    </div>

    <button
      class="icon-btn close-btn"
      type="button"
      aria-label="Close navigation"
      on:click={closeMobile}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
      </svg>
    </button>
  </header>

  <div class="sidebar-main">
    <nav class="nav-section" aria-label="Main menu">
      <p class="section-label">Main Menu</p>

      {#each items as item (item.id)}
        <NavItem
          label={item.label}
          description={item.description}
          active={selected === item.id}
          on:click={() => handleSelect(item.id)}
        >
          <svelte:fragment slot="icon">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              {@html phoneIcon}
            </svg>
          </svelte:fragment>
        </NavItem>
      {/each}
    </nav>
  </div>

  <footer class="sidebar-footer">
    <div class="user-card">
      <span class="user-avatar" aria-hidden="true">{getInitials(user)}</span>
      <div class="user-meta">
        <strong class="user-name">{getDisplayName(user)}</strong>
        <small class="user-plan">{getPlanLabel(user)}</small>
      </div>
    </div>

    <button
      class="logout-btn"
      type="button"
      aria-label="Log out"
      title="Log out"
      disabled={isLoggingOut}
      on:click={handleLogout}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </footer>
</aside>

<style lang="postcss">
  .sidebar {
    --sidebar-width: 280px;
    --sidebar-bg: #111827;
    --sidebar-border: rgba(255, 255, 255, 0.08);
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
    overflow: hidden;
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 39;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    animation: fade-in 200ms ease both;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
    padding: 1.25rem 1.25rem 1rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-inline-size: 0;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border-radius: 10px;
    background: linear-gradient(145deg, rgba(78, 135, 255, 0.28) 0%, rgba(78, 135, 255, 0.12) 100%);
    border: 1px solid rgba(78, 135, 255, 0.35);
    color: #ffffff;
    box-shadow: 0 0 20px rgba(78, 135, 255, 0.22);
  }

  .brand-icon {
    display: block;
  }

  .brand-name {
    color: #ffffff;
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    white-space: nowrap;
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
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #e5e7eb;
  }

  .icon-btn:focus-visible {
    outline: 2px solid rgba(78, 135, 255, 0.65);
    outline-offset: 2px;
  }

  .sidebar-main {
    flex: 1;
    min-block-size: 0;
    padding: 0 0.75rem;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
  }

  .nav-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .section-label {
    margin: 0 0 0.375rem 0.5rem;
    color: #9ca3af;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .sidebar-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    padding: 1rem 1rem 1.25rem;
    border-block-start: 1px solid var(--sidebar-border);
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex: 1;
    min-inline-size: 0;
  }

  .user-avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border-radius: 999px;
    background: #374151;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .user-meta {
    display: grid;
    gap: 0.1rem;
    min-inline-size: 0;
  }

  .user-name {
    margin: 0;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-plan {
    color: #9ca3af;
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
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }

  .logout-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: #e5e7eb;
  }

  .logout-btn:focus-visible {
    outline: 2px solid rgba(78, 135, 255, 0.65);
    outline-offset: 2px;
  }

  .logout-btn:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  @media (min-width: 801px) {
    .close-btn {
      display: none;
    }
  }

  @media (max-width: 800px) {
    .sidebar {
      position: fixed;
      inset-block: 0;
      inset-inline-start: 0;
      z-index: 40;
      transform: translateX(-100%);
      transition:
        transform var(--sidebar-transition),
        box-shadow var(--sidebar-transition);
      box-shadow: none;
    }

    .sidebar.mobile-open {
      transform: translateX(0);
      box-shadow: 12px 0 48px rgba(0, 0, 0, 0.45);
    }

    .close-btn {
      display: grid;
    }
  }
</style>
