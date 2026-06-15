<!--
  ContactList.svelte
  Left-center panel of the Contact Dashboard.

  Displays all users as a searchable, scrollable list with:
    - Avatar + initials fallback
    - Presence indicator dot (online / away / offline)
    - Last-seen label
    - Unread badge
    - Hover call button
    - Skeleton while loading, error state, empty state

  Props:
    selectedId   — currently selected contact id (bindable)
    onCallContact — called when the hover call button is pressed
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Badge from '$lib/components/atoms/Badge.svelte';
  import Skeleton from '$lib/components/atoms/Skeleton.svelte';
  import { getContacts } from '$lib/api/contacts.api';
  import { presenceStore, type PresenceStatus } from '$lib/stores/presence.store';
  import type { UserProfile } from '$lib/stores/user.store';

  // ── Props ──────────────────────────────────────────────────────
  export let selectedId: string | null = null;
  export let onCallContact: ((contact: UserProfile, type: 'audio' | 'video') => void) | undefined =
    undefined;

  // ── State ──────────────────────────────────────────────────────
  let contacts: UserProfile[] = [];
  let isLoading = true;
  let error: string | null = null;
  let searchQuery = '';
  let searchInput: HTMLInputElement;

  // ── Derived ────────────────────────────────────────────────────
  $: presences = $presenceStore.presences;

  $: filtered = searchQuery.trim()
    ? contacts.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          (c.displayName ?? '').toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.role ?? '').toLowerCase().includes(q)
        );
      })
    : contacts;

  // ── Helpers ────────────────────────────────────────────────────
  function getStatus(userId: string): PresenceStatus {
    return presences.get(userId)?.status ?? 'offline';
  }

  function getLastSeen(userId: string): string {
    const p = presences.get(userId);
    if (!p) return '';
    if (p.status === 'online') return 'Active now';
    if (!p.lastSeen) return '';

    const ms = Date.now() - new Date(p.lastSeen).getTime();
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function getDisplayName(c: UserProfile): string {
    if (c.displayName?.trim()) return c.displayName.trim();
    const local = c.email.split('@')[0];
    return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function getStatusLabel(status: PresenceStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  // ── Fetch ──────────────────────────────────────────────────────
  async function load() {
    isLoading = true;
    error = null;
    try {
      contacts = await getContacts();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load contacts.';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void load();
    presenceStore.startPolling();
    return () => presenceStore.stopPolling();
  });
</script>

<div class="cl-panel">
  <!-- Header -->
  <header class="cl-header">
    <h2 class="cl-title">Contacts</h2>
    <div class="cl-header-actions">
      <button class="cl-icon-btn" type="button" aria-label="Filter contacts" title="Filter">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="cl-icon-btn" type="button" aria-label="Add contact" title="Add contact">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <circle cx="8.5" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/>
          <line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Search -->
  <div class="cl-search-wrap">
    <svg class="cl-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.75"/>
      <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    </svg>
    <input
      bind:this={searchInput}
      bind:value={searchQuery}
      class="cl-search"
      type="search"
      placeholder="Search contacts"
      aria-label="Search contacts"
      autocomplete="off"
    />
  </div>

  <!-- Body -->
  <div class="cl-body" role="listbox" aria-label="Contact list" aria-live="polite">
    {#if isLoading}
      <div class="cl-skeleton-wrap">
        <Skeleton variant="contacts" rows={6} />
      </div>

    {:else if error}
      <div class="cl-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
        <p class="cl-empty-title">Could not load contacts</p>
        <p class="cl-empty-desc">{error}</p>
        <button class="cl-retry-btn" type="button" onclick={() => void load()}>Retry</button>
      </div>

    {:else if filtered.length === 0}
      <div class="cl-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
        <p class="cl-empty-title">
          {searchQuery ? 'No contacts found' : 'No contacts yet'}
        </p>
        <p class="cl-empty-desc">
          {searchQuery
            ? 'Try adjusting your search terms.'
            : 'Contacts will appear here once available.'}
        </p>
      </div>

    {:else}
      {#each filtered as contact (contact.id)}
        {@const status = getStatus(contact.id)}
        {@const lastSeen = getLastSeen(contact.id)}
        {@const displayName = getDisplayName(contact)}
        {@const isSelected = selectedId === contact.id}

        <div
          class="cl-row"
          class:cl-row--selected={isSelected}
          role="option"
          aria-selected={isSelected}
          tabindex="0"
          onclick={() => (selectedId = contact.id)}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectedId = contact.id; }}
        >
          <!-- Avatar with presence dot -->
          <div class="cl-avatar-wrap">
            <Avatar
              src={contact.avatarUrl ?? undefined}
              name={displayName}
              size="md"
              online={status === 'online'}
            />
            {#if status === 'away'}
              <span class="cl-away-dot" aria-hidden="true"></span>
            {/if}
          </div>

          <!-- Copy -->
          <div class="cl-copy">
            <span class="cl-name">{displayName}</span>
            <span class="cl-status" data-status={status}>{getStatusLabel(status)}</span>
          </div>

          <!-- Right meta -->
          <div class="cl-meta">
            {#if lastSeen}
              <span class="cl-last-seen">{lastSeen}</span>
            {/if}
            <!-- Call button (hover-revealed) -->
            {#if onCallContact}
              <button
                class="cl-call-btn"
                type="button"
                aria-label="Call {displayName}"
                onclick={(e) => {
                  e.stopPropagation();
                  onCallContact?.(contact, 'audio');
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                </svg>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="postcss">
  /* ── Panel shell ────────────────────────────────────────────── */
  .cl-panel {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-inline-size: 0;
    background: var(--color-surface);
    border-inline-end: 1px solid var(--color-border);
  }

  /* ── Header ─────────────────────────────────────────────────── */
  .cl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 0 var(--space-lg);
    block-size: 4rem;
    border-block-end: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface) 88%, transparent);
    backdrop-filter: blur(12px);
    position: sticky;
    inset-block-start: 0;
    z-index: 2;
  }

  .cl-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text);
    font-family: var(--font-sans);
  }

  .cl-header-actions {
    display: flex;
    gap: 0.25rem;
  }

  .cl-icon-btn {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    padding: 0;
    transition: background-color 140ms ease, color 140ms ease;
  }

  .cl-icon-btn:hover {
    background: var(--color-surface-raised);
    color: var(--color-text);
  }

  .cl-icon-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  /* ── Search ─────────────────────────────────────────────────── */
  .cl-search-wrap {
    position: relative;
    flex-shrink: 0;
    padding: var(--space-md) var(--space-lg);
    border-block-end: 1px solid var(--color-border);
  }

  .cl-search-icon {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: calc(var(--space-lg) + 0.75rem);
    transform: translateY(-50%);
    color: var(--color-muted);
    pointer-events: none;
  }

  .cl-search {
    inline-size: 100%;
    block-size: 2.5rem;
    padding: 0 0.75rem 0 2.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 140ms ease, box-shadow 140ms ease;
    appearance: none;
  }

  .cl-search::placeholder {
    color: var(--color-muted);
  }

  .cl-search:focus {
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-secondary) 16%, transparent);
  }

  .cl-search::-webkit-search-cancel-button {
    cursor: pointer;
  }

  /* ── Body ───────────────────────────────────────────────────── */
  .cl-body {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    padding: var(--space-md) var(--space-lg);
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .cl-skeleton-wrap {
    padding-block-start: var(--space-xs);
  }

  /* ── Row ────────────────────────────────────────────────────── */
  .cl-row {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-md);
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .cl-row:hover {
    background: var(--color-surface-raised);
    border-color: color-mix(in srgb, var(--color-border) 50%, transparent);
  }

  .cl-row--selected {
    background: color-mix(in srgb, var(--color-secondary) 8%, transparent);
    border-color: color-mix(in srgb, var(--color-secondary) 28%, transparent);
  }

  .cl-row--selected:hover {
    background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
  }

  /* ── Avatar with presence overlay ──────────────────────────── */
  .cl-avatar-wrap {
    position: relative;
    inline-size: 3rem;
    block-size: 3rem;
    display: grid;
    place-items: center;
  }

  /* Away dot (online dot is rendered by Avatar's built-in badge) */
  .cl-away-dot {
    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 0;
    inline-size: 0.65rem;
    block-size: 0.65rem;
    border-radius: 999px;
    background: #f59e0b;
    border: 2px solid var(--color-surface);
  }

  /* ── Copy ───────────────────────────────────────────────────── */
  .cl-copy {
    display: grid;
    gap: 0.125rem;
    min-inline-size: 0;
  }

  .cl-name {
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cl-status {
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-muted);
    line-height: 1.25;
  }

  .cl-status[data-status='online'] {
    color: var(--color-online);
  }

  .cl-status[data-status='away'] {
    color: #f59e0b;
  }

  /* ── Right meta ─────────────────────────────────────────────── */
  .cl-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
    min-inline-size: 5rem;
  }

  .cl-last-seen {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--color-muted);
    white-space: nowrap;
  }

  /* Call button — hidden by default, revealed on hover */
  .cl-call-btn {
    display: grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border-radius: 999px;
    border: none;
    background: color-mix(in srgb, var(--color-secondary) 14%, transparent);
    color: var(--color-secondary);
    cursor: pointer;
    padding: 0;
    opacity: 0;
    pointer-events: none;
    transition: background-color 140ms ease, opacity 140ms ease;
  }

  .cl-row:hover .cl-call-btn,
  .cl-row--selected .cl-call-btn {
    opacity: 1;
    pointer-events: auto;
  }

  .cl-call-btn:hover {
    background: color-mix(in srgb, var(--color-secondary) 24%, transparent);
  }

  .cl-call-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  /* ── Empty / error state ────────────────────────────────────── */
  .cl-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-xl) var(--space-lg);
    text-align: center;
    color: var(--color-muted);
  }

  .cl-empty-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .cl-empty-desc {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--color-muted);
    max-inline-size: 20rem;
  }

  .cl-retry-btn {
    margin-block-start: var(--space-sm);
    padding: 0.5rem 1.25rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 140ms ease;
  }

  .cl-retry-btn:hover {
    background: var(--color-surface-raised);
  }

  .cl-retry-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  /* ── Responsive ─────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .cl-panel {
      min-inline-size: 0;
    }
  }
</style>
