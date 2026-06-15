<!--
  ContactDetail.svelte
  Center panel — shown when a contact is selected in ContactList.

  Displays:
    - Large avatar + presence ring
    - Display name, role / status
    - Action buttons: Audio Call, Video Call, Email
    - Contact fields: email, phone, company, status, notes
    - Skeleton while loading (pass isLoading=true)

  Props:
    contact      — the UserProfile to display (null = empty state)
    isLoading    — show skeleton instead of content
    onCall       — callback for audio / video call initiation
-->
<script lang="ts">
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Skeleton from '$lib/components/atoms/Skeleton.svelte';
  import { presenceStore, type PresenceStatus } from '$lib/stores/presence.store';
  import type { UserProfile } from '$lib/stores/user.store';

  // ── Props ──────────────────────────────────────────────────────
  export let contact: UserProfile | null = null;
  export let isLoading = false;
  export let onCall:
    | ((contact: UserProfile, type: 'audio' | 'video') => void)
    | undefined = undefined;

  // ── Helpers ────────────────────────────────────────────────────
  function getDisplayName(c: UserProfile): string {
    if (c.displayName?.trim()) return c.displayName.trim();
    const local = c.email.split('@')[0];
    return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function getRoleLabel(c: UserProfile): string {
    if (c.role?.trim()) {
      return c.role.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    }
    return '';
  }

  $: presence = contact ? $presenceStore.presences.get(contact.id) : undefined;
  $: presenceStatus = (presence?.status ?? 'offline') as PresenceStatus;
  $: presenceLabel =
    presenceStatus === 'online'
      ? 'Online'
      : presenceStatus === 'away'
        ? 'Away'
        : 'Offline';

  function getLastSeen(): string {
    if (!presence?.lastSeen || presenceStatus === 'online') return '';
    const ms = Date.now() - new Date(presence.lastSeen).getTime();
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
</script>

<div class="cd-panel">
  {#if isLoading}
    <div class="cd-skeleton-wrap">
      <Skeleton variant="contact-details" />
    </div>

  {:else if !contact}
    <!-- Empty state -->
    <div class="cd-empty">
      <div class="cd-empty-icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="cd-empty-title">Select a contact</p>
      <p class="cd-empty-desc">Choose someone from the list to view their details.</p>
    </div>

  {:else}
    {@const displayName = getDisplayName(contact)}
    {@const roleLabel = getRoleLabel(contact)}
    {@const lastSeen = getLastSeen()}

    <div class="cd-content">
      <!-- Hero -->
      <div class="cd-hero">
        <div class="cd-avatar-wrap" data-status={presenceStatus}>
          <Avatar
            src={contact.avatarUrl ?? undefined}
            name={displayName}
            size="lg"
            online={presenceStatus === 'online'}
          />
        </div>
        <div class="cd-hero-copy">
          <h2 class="cd-name">{displayName}</h2>
          {#if roleLabel}
            <p class="cd-role">{roleLabel}</p>
          {/if}
          <span class="cd-presence" data-status={presenceStatus}>
            <span class="cd-presence-dot" aria-hidden="true"></span>
            {presenceLabel}
            {#if lastSeen}
              <span class="cd-last-seen">· {lastSeen}</span>
            {/if}
          </span>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="cd-actions" role="group" aria-label="Contact actions">
        <button
          class="cd-action-btn cd-action-btn--primary"
          type="button"
          aria-label="Audio call {displayName}"
          onclick={() => onCall?.(contact, 'audio')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
          </svg>
          Call
        </button>

        <button
          class="cd-action-btn"
          type="button"
          aria-label="Video call {displayName}"
          onclick={() => onCall?.(contact, 'video')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polygon points="23 7 16 12 23 17 23 7" fill="currentColor"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"
              stroke="currentColor" stroke-width="1.75" fill="none"/>
          </svg>
          Video
        </button>

        <a
          class="cd-action-btn"
          href="mailto:{contact.email}"
          aria-label="Email {displayName}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
            <polyline points="22,6 12,13 2,6"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
          Email
        </a>
      </div>

      <!-- Contact fields -->
      <dl class="cd-fields">
        <div class="cd-field">
          <dt class="cd-field-label">Email</dt>
          <dd class="cd-field-value">
            <a href="mailto:{contact.email}" class="cd-link">{contact.email}</a>
          </dd>
        </div>

        {#if contact.role}
          <div class="cd-field">
            <dt class="cd-field-label">Role</dt>
            <dd class="cd-field-value">{roleLabel}</dd>
          </div>
        {/if}

        <div class="cd-field">
          <dt class="cd-field-label">Status</dt>
          <dd class="cd-field-value cd-field-status" data-status={presenceStatus}>
            {presenceLabel}
            {#if lastSeen}· {lastSeen}{/if}
          </dd>
        </div>

        {#if contact.status && contact.status !== 'active'}
          <div class="cd-field">
            <dt class="cd-field-label">Account</dt>
            <dd class="cd-field-value">{contact.status}</dd>
          </div>
        {/if}
      </dl>
    </div>
  {/if}
</div>

<style lang="postcss">
  /* ── Panel shell ────────────────────────────────────────────── */
  .cd-panel {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    block-size: 100%;
    background: var(--color-background);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .cd-skeleton-wrap {
    padding: var(--space-lg);
  }

  /* ── Empty state ────────────────────────────────────────────── */
  .cd-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-xl);
    text-align: center;
  }

  .cd-empty-icon {
    inline-size: 4.5rem;
    block-size: 4.5rem;
    border-radius: 999px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    display: grid;
    place-items: center;
    color: var(--color-muted);
    margin-block-end: var(--space-sm);
  }

  .cd-empty-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .cd-empty-desc {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--color-muted);
    max-inline-size: 20rem;
  }

  /* ── Content ────────────────────────────────────────────────── */
  .cd-content {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Hero ───────────────────────────────────────────────────── */
  .cd-hero {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-xl) var(--space-lg) var(--space-lg);
    border-block-end: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  .cd-avatar-wrap {
    flex-shrink: 0;
    position: relative;
  }

  .cd-hero-copy {
    display: grid;
    gap: 0.25rem;
    min-inline-size: 0;
  }

  .cd-name {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.25;
  }

  .cd-role {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--color-muted);
  }

  .cd-presence {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-muted);
    margin-block-start: 0.125rem;
  }

  .cd-presence[data-status='online'] { color: var(--color-online); }
  .cd-presence[data-status='away']   { color: #f59e0b; }

  .cd-presence-dot {
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 999px;
    background: currentColor;
    flex-shrink: 0;
  }

  .cd-last-seen {
    color: var(--color-muted);
    font-weight: 400;
  }

  /* ── Actions ────────────────────────────────────────────────── */
  .cd-actions {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-block-end: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  .cd-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }

  .cd-action-btn:hover {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
  }

  .cd-action-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .cd-action-btn--primary {
    background: color-mix(in srgb, var(--color-secondary) 14%, transparent);
    border-color: color-mix(in srgb, var(--color-secondary) 28%, transparent);
    color: var(--color-secondary);
  }

  .cd-action-btn--primary:hover {
    background: color-mix(in srgb, var(--color-secondary) 22%, transparent);
    border-color: color-mix(in srgb, var(--color-secondary) 42%, transparent);
  }

  /* ── Fields ─────────────────────────────────────────────────── */
  .cd-fields {
    margin: 0;
    padding: var(--space-lg);
    display: grid;
    gap: var(--space-md);
    background: var(--color-surface);
    border-radius: 0;
  }

  .cd-field {
    display: grid;
    gap: 0.2rem;
  }

  .cd-field-label {
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-muted);
  }

  .cd-field-value {
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    color: var(--color-text);
    margin: 0;
  }

  .cd-field-status[data-status='online'] { color: var(--color-online); }
  .cd-field-status[data-status='away']   { color: #f59e0b; }

  .cd-link {
    color: var(--color-secondary);
    text-decoration: none;
  }

  .cd-link:hover {
    text-decoration: underline;
  }
</style>
