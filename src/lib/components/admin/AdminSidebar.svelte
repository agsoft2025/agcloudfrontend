<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import NavItem from "$lib/components/home/NavItem.svelte";
  import SettingsNavItem from "$lib/components/home/SettingsNavItem.svelte";
  import ThemeToggle from "$lib/components/atoms/ThemeToggle.svelte";
  import { signOut } from "$lib/api/auth.api";
  import { authStore, type AuthUser } from "$lib/stores/auth.store";
  import { userStore } from "$lib/stores/user.store";

  export let mobileOpen = false;

  let isLoggingOut = false;

  $: user = $authStore.user;
  $: currentPath = $page.url.pathname;

  const callListIcon =
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.65 3.32 2 2 0 0 1 3.63 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.35 6.35l.98-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>';

  const userListIcon =
    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>';

  function closeMobile() {
    mobileOpen = false;
  }

  function navigate(path: string) {
    mobileOpen = false;
    goto(path);
  }

  function getInitials(profile: AuthUser | null) {
    if (profile?.displayName?.trim()) {
      const parts = profile.displayName.trim().split(/\s+/).filter(Boolean);
      return parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("");
    }
    return profile?.email?.[0]?.toUpperCase() ?? "A";
  }

  function getDisplayName(profile: AuthUser | null) {
    if (profile?.displayName?.trim()) return profile.displayName.trim();
    if (profile?.email) {
      const local = profile.email.split("@")[0];
      return local
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return "Admin";
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    isLoggingOut = true;
    try {
      await signOut();
    } catch {
      /* ignore */
    } finally {
      authStore.clear();
      userStore.clear();
      mobileOpen = false;
      isLoggingOut = false;
      await goto("/signin", { replaceState: true });
    }
  }
</script>

{#if mobileOpen}
  <div
    class="sidebar-backdrop"
    aria-hidden="true"
    on:click={closeMobile}
    on:keydown={(e) => e.key === "Escape" && closeMobile()}
  ></div>
{/if}

<aside
  id="admin-sidebar"
  class="sidebar"
  class:mobile-open={mobileOpen}
  aria-label="Admin navigation"
>
  <header class="sidebar-header">
    <div class="brand">
      <img
        class="brand-logo"
        src="/logo.png"
        alt="AG Cloud"
        width="477"
        height="312"
      />
    </div>
    <div class="admin-badge">Admin</div>
    <button
      class="icon-btn close-btn"
      type="button"
      aria-label="Close navigation"
      on:click={closeMobile}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 4l10 10M14 4L4 14"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </header>

  <div class="sidebar-main">
    <nav class="nav-section" aria-label="Admin menu">
      <NavItem
        label="Call List"
        description="View all calls in the system"
        active={currentPath.startsWith("/admin/calls")}
        on:click={() => navigate("/admin/calls")}
      >
        <svelte:fragment slot="icon">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
          >
            {@html callListIcon}
          </svg>
        </svelte:fragment>
      </NavItem>

      <NavItem
        label="User List"
        description="Manage registered users"
        active={currentPath.startsWith("/admin/users")}
        on:click={() => navigate("/admin/users")}
      >
        <svelte:fragment slot="icon">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
          >
            {@html userListIcon}
          </svg>
        </svelte:fragment>
      </NavItem>

      <NavItem
        label="Pricing"
        description="Manage call rates"
        active={currentPath.startsWith("/admin/pricing")}
        on:click={() => navigate("/admin/pricing")}
      >
        <svelte:fragment slot="icon">
          <svg viewBox="0 0 24 24">
            <text
              x="12"
              y="17"
              text-anchor="middle"
              font-size="18"
              font-weight="600"
              fill="currentColor">₹</text
            >
          </svg>
        </svelte:fragment>
      </NavItem>

      <hr class="nav-divider" aria-hidden="true" />
      <SettingsNavItem />
    </nav>
  </div>

  <footer class="sidebar-footer">
    <div class="user-card">
      <div class="user-avatar-wrap" aria-hidden="true">
        <span class="user-avatar">{getInitials(user)}</span>
      </div>
      <div class="user-meta">
        <strong class="user-name" title={getDisplayName(user)}
          >{getDisplayName(user)}</strong
        >
        <small class="user-plan">Administrator</small>
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
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
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
    overflow-x: hidden;
    overflow-y: auto;
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 59;
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
    gap: 0.5rem;
    flex-shrink: 0;
    padding: 0.5rem 1rem 0;
    padding-block-start: max(0.5rem, env(safe-area-inset-top));
  }

  .brand {
    display: flex;
    align-items: center;
    min-inline-size: 0;
  }

  .brand-logo {
    display: block;
    block-size: 4.25rem;
    inline-size: auto;
    max-inline-size: 9rem;
    object-fit: contain;
  }

  .admin-badge {
    flex-shrink: 0;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    border-radius: 4px;
    padding: 0.125rem 0.375rem;
    line-height: 1.4;
  }

  .icon-btn {
    display: none;
    place-items: center;
    flex-shrink: 0;
    margin-inline-start: auto;
    inline-size: 2rem;
    block-size: 2rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sidebar-control-color);
    cursor: pointer;
    padding: 0;
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }

  .icon-btn:hover {
    background: var(--sidebar-control-hover-bg);
    color: var(--sidebar-control-hover-color);
  }
  .icon-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

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

  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
    padding: 0.875rem 1rem;
    padding-block-end: max(1.125rem, env(safe-area-inset-bottom));
    border-block-start: 1px solid var(--sidebar-border);
    background: color-mix(in srgb, var(--sidebar-bg) 80%, transparent);
    backdrop-filter: blur(8px);
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-inline-size: 0;
  }

  .user-avatar-wrap {
    position: relative;
    flex-shrink: 0;
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

  .user-meta {
    flex: 1;
    display: grid;
    gap: 0.1rem;
    min-inline-size: 0;
  }

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
  }

  .footer-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
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
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }

  .logout-btn:hover:not(:disabled) {
    background: var(--sidebar-control-hover-bg);
    color: var(--sidebar-control-hover-color);
  }
  .logout-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
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
      block-size: auto;
      inset-inline-start: 0;
      z-index: 60;
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
