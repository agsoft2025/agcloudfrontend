<!--
  /settings/privacy — Privacy Settings (Blocklist Management)
  ============================================================
  Fetches the blocked-users list on mount, renders each user
  with an Unblock button, and applies optimistic removal:
    1. Remove from UI immediately
    2. Call POST /privacy/unblock
    3. If the call fails → re-insert the user + show error toast
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { privacyStore } from '$lib/stores/privacy.store';
  import { toastStore } from '$lib/stores/toast.store';
  import { getBlockedUsers, unblockUser } from '$lib/api/privacy.api';
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Button from '$lib/components/atoms/Button.svelte';

  // ── Reactive aliases ──────────────────────────────────────────────────────────

  $: ({ blockedUsers, loading, error, unblockingIds } = $privacyStore);

  // ── Fetch blocked users on mount ──────────────────────────────────────────────

  onMount(async () => {
    // Skip if we already have data (e.g. navigating back to the page)
    if (blockedUsers.length > 0) return;

    privacyStore.setLoading();
    try {
      const users = await getBlockedUsers();
      privacyStore.setUsers(users);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load blocked users.';
      privacyStore.setFetchError(message);
    }
  });

  // ── Unblock handler ───────────────────────────────────────────────────────────

  async function handleUnblock(userId: string) {
    // beginUnblock is a no-op if this ID is already in-flight
    const snapshot = privacyStore.beginUnblock(userId);
    if (!snapshot) return; // already processing

    try {
      await unblockUser(userId);
      privacyStore.commitUnblock(userId);
      toastStore.success('User unblocked.');
    } catch (err) {
      // Revert the optimistic removal
      privacyStore.rollbackUnblock(userId, snapshot.user, snapshot.index);
      const message = err instanceof Error ? err.message : 'Failed to unblock user.';
      toastStore.error(message);
    }
  }
</script>

<svelte:head>
  <title>Privacy | AG Cloud</title>
</svelte:head>

<div class="privacy-page">
  <header class="page-header">
    <h1 class="page-title">Privacy</h1>
    <p class="page-subtitle">Manage who you have blocked.</p>
  </header>

  <section class="section" aria-labelledby="blocked-heading">
    <h2 class="section-title" id="blocked-heading">Blocked Users</h2>

    <!-- Loading state -->
    {#if loading}
      <div class="state-box" aria-live="polite" aria-busy="true">
        <span class="spinner" aria-hidden="true"></span>
        <p class="state-text">Loading blocked users…</p>
      </div>

    <!-- Fetch error -->
    {:else if error}
      <div class="error-banner" role="alert">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        {error}
        <button
          class="retry-btn"
          type="button"
          on:click={async () => {
            privacyStore.setLoading();
            try {
              privacyStore.setUsers(await getBlockedUsers());
            } catch (e) {
              privacyStore.setFetchError(e instanceof Error ? e.message : 'Failed to load blocked users.');
            }
          }}
        >
          Try again
        </button>
      </div>

    <!-- Empty state -->
    {:else if blockedUsers.length === 0}
      <div class="state-box">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="empty-icon">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4.93 4.93l14.14 14.14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p class="state-text">You have not blocked any users.</p>
      </div>

    <!-- Blocked users list -->
    {:else}
      <ul class="user-list" aria-label="Blocked users">
        {#each blockedUsers as user (user.id)}
          <li class="user-row">
            <div class="user-identity">
              <Avatar
                src={user.avatar}
                name={user.username}
                size="sm"
              />
              <span class="username">{user.username}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              loading={unblockingIds.has(user.id)}
              disabled={unblockingIds.has(user.id)}
              on:click={() => handleUnblock(user.id)}
              ariaLabel="Unblock {user.username}"
            >
              {unblockingIds.has(user.id) ? 'Unblocking…' : 'Unblock'}
            </Button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style lang="postcss">
  /* ── Page shell ── */

  .privacy-page {
    max-inline-size: 560px;
    margin-inline: auto;
    padding: var(--space-xl) var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  /* ── Page header ── */

  .page-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .page-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  /* ── Section ── */

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .section-title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── States (loading / empty) ── */

  .state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-xl);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .state-text {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  .empty-icon {
    color: var(--color-border-strong, var(--color-border));
    opacity: 0.6;
  }

  /* Spinner reuses the Button atom's keyframe via custom CSS */
  .spinner {
    display: inline-block;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    border: 2px solid var(--color-border);
    border-block-start-color: var(--color-secondary);
    border-radius: 50%;
    animation: spin 700ms linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Error banner ── */

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: var(--space-md) var(--space-lg);
    background: color-mix(in srgb, var(--color-error, #e53e3e) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-error, #e53e3e) 25%, transparent);
    border-radius: var(--radius-md);
    color: var(--color-error-text, #c53030);
    font-size: 0.875rem;
  }

  .retry-btn {
    margin-inline-start: auto;
    flex-shrink: 0;
    background: none;
    border: 1.5px solid currentColor;
    border-radius: var(--radius-sm);
    color: inherit;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.2em 0.6em;
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .retry-btn:hover { opacity: 0.7; }

  /* ── User list ── */

  .user-list {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .user-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border-block-end: 1px solid var(--color-border);
    transition: background-color 100ms ease;
  }

  .user-row:last-child {
    border-block-end: none;
  }

  .user-row:hover {
    background: color-mix(in srgb, var(--color-secondary) 4%, var(--color-surface-raised));
  }

  /* ── User identity ── */

  .user-identity {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-inline-size: 0;
    flex: 1;
  }

  .username {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
