<!--
  /contacts/[id] — Contact Profile Page
  Shows avatar, presence, contact details, and call/block actions.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Skeleton from '$lib/components/atoms/Skeleton.svelte';
  import Spinner from '$lib/components/atoms/Spinner.svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import { presenceStore, type PresenceStatus } from '$lib/stores/presence.store';
  import { userStore, type UserProfile } from '$lib/stores/user.store';
  import { apiPost } from '$lib/api/client';
  import {
    initiateCall,
    getCallIdentifier,
    hasLiveKitCredentials,
    getCallApiErrorMessage
  } from '$lib/api/calls.api';
  import { activeCallStore } from '$lib/stores/active-call.store';

  // ── State ──────────────────────────────────────────────────
  let contact: UserProfile | null = null;
  let isLoading = true;
  let loadError: string | null = null;

  let isBlocked = false;
  let isBlockLoading = false;
  let blockError: string | null = null;

  let isCallLoading = false;

  $: contactId = $page.params.id as string;

  // ── Presence ────────────────────────────────────────────────
  $: presence = contact ? $presenceStore.presences.get(contact.id) : undefined;
  $: presenceStatus = (presence?.status ?? 'offline') as PresenceStatus;
  $: presenceLabel =
    presenceStatus === 'online' ? 'Online' :
    presenceStatus === 'away'   ? 'Away'   : 'Offline';

  $: lastSeen = (() => {
    if (!presence?.lastSeen || presenceStatus === 'online') return '';
    const ms   = Date.now() - new Date(presence.lastSeen).getTime();
    const mins = Math.floor(ms / 60_000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  // ── Helpers ─────────────────────────────────────────────────
  function getDisplayName(c: UserProfile): string {
    if (c.displayName?.trim()) return c.displayName.trim();
    const local = c.email.split('@')[0];
    return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function getRoleLabel(c: UserProfile): string {
    if (!c.role?.trim()) return '';
    return c.role.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  // ── Data loading ─────────────────────────────────────────────
  async function load() {
    isLoading = true;
    loadError = null;
    try {
      contact = await userStore.hydrateProfile(contactId);
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Could not load contact.';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void load();
    presenceStore.startPolling();
    return () => presenceStore.stopPolling();
  });

  // ── Call ─────────────────────────────────────────────────────
  async function handleCall(callType: 'audio' | 'video') {
    if (!contact || isCallLoading) return;
    isCallLoading = true;
    try {
      const response = await initiateCall({
        receiverIds: [contact.id],
        callType,
        callMode: 'one-to-one'
      });
      const callId = getCallIdentifier(response);
      if (!callId) throw new Error('No call id returned.');

      activeCallStore.startOutgoing({
        callId,
        peer: {
          id: contact.id,
          name: getDisplayName(contact),
          avatarUrl: contact.avatarUrl ?? null
        },
        callType,
        callMode: 'one-to-one',
        liveKit: hasLiveKitCredentials(response)
          ? { token: response.token, roomName: response.roomName, url: response.url }
          : null
      });

      if (hasLiveKitCredentials(response)) {
        await goto(`/call/${encodeURIComponent(response.roomName)}`);
      }
    } catch (err) {
      console.error('[ContactProfile] Call failed:', getCallApiErrorMessage(err));
    } finally {
      isCallLoading = false;
    }
  }

  // ── Block / Unblock ──────────────────────────────────────────
  async function handleBlock() {
    if (!contact || isBlockLoading) return;
    isBlockLoading = true;
    blockError = null;
    try {
      await apiPost(`/users/${contact.id}/block`);
      isBlocked = true;
    } catch (err) {
      blockError = err instanceof Error ? err.message : 'Could not block user.';
    } finally {
      isBlockLoading = false;
    }
  }

  async function handleUnblock() {
    if (!contact || isBlockLoading) return;
    isBlockLoading = true;
    blockError = null;
    try {
      await apiPost(`/users/${contact.id}/unblock`);
      isBlocked = false;
    } catch (err) {
      blockError = err instanceof Error ? err.message : 'Could not unblock user.';
    } finally {
      isBlockLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{contact ? getDisplayName(contact) : 'Contact'} | AG Cloud</title>
</svelte:head>

<div class="cp-page">
  <!-- Back link -->
  <nav class="cp-nav" aria-label="Breadcrumb">
    <button class="cp-back" type="button" onclick={() => goto('/home')} aria-label="Back to contacts">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Contacts
    </button>
  </nav>

  <main class="cp-main">
    {#if isLoading}
      <div class="cp-skeleton">
        <Skeleton variant="contact-details" />
      </div>

    {:else if loadError}
      <div class="cp-error" role="alert">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
        <p class="cp-error-title">Could not load contact</p>
        <p class="cp-error-desc">{loadError}</p>
        <Button variant="secondary" size="sm" on:click={() => void load()}>Retry</Button>
      </div>

    {:else if contact}
      <div class="cp-card">
        <!-- Hero section -->
        <div class="cp-hero">
          <div class="cp-avatar-wrap">
            <Avatar
              src={contact.avatarUrl ?? undefined}
              name={getDisplayName(contact)}
              size="lg"
              online={presenceStatus === 'online'}
            />
            {#if presenceStatus === 'away'}
              <span class="cp-away-dot" aria-hidden="true"></span>
            {/if}
          </div>
          <div class="cp-hero-info">
            <h1 class="cp-name">{getDisplayName(contact)}</h1>
            {#if getRoleLabel(contact)}
              <p class="cp-role">{getRoleLabel(contact)}</p>
            {/if}
            <span class="cp-presence" data-status={presenceStatus}>
              {presenceLabel}
              {#if lastSeen}
                <span class="cp-last-seen">· {lastSeen}</span>
              {/if}
            </span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="cp-actions">
          <Button
            variant="primary"
            size="md"
            loading={isCallLoading}
            disabled={isBlocked}
            on:click={() => void handleCall('video')}
            ariaLabel="Start video call with {getDisplayName(contact)}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
            </svg>
            Video Call
          </Button>

          <Button
            variant="secondary"
            size="md"
            loading={isCallLoading}
            disabled={isBlocked}
            on:click={() => void handleCall('audio')}
            ariaLabel="Start audio call with {getDisplayName(contact)}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
            </svg>
            Audio Call
          </Button>

          {#if isBlocked}
            <Button
              variant="secondary"
              size="md"
              loading={isBlockLoading}
              on:click={() => void handleUnblock()}
            >
              Unblock
            </Button>
          {:else}
            <Button
              variant="ghost"
              size="md"
              loading={isBlockLoading}
              on:click={() => void handleBlock()}
            >
              Block
            </Button>
          {/if}
        </div>

        {#if blockError}
          <p class="cp-block-error" role="alert">{blockError}</p>
        {/if}

        <!-- Contact fields -->
        <dl class="cp-fields">
          <div class="cp-field">
            <dt class="cp-field-label">Email</dt>
            <dd class="cp-field-value">
              <a href="mailto:{contact.email}" class="cp-link">{contact.email}</a>
            </dd>
          </div>

          {#if contact.role}
            <div class="cp-field">
              <dt class="cp-field-label">Role</dt>
              <dd class="cp-field-value">{getRoleLabel(contact)}</dd>
            </div>
          {/if}

          {#if contact.status}
            <div class="cp-field">
              <dt class="cp-field-label">Status</dt>
              <dd class="cp-field-value">{contact.status}</dd>
            </div>
          {/if}

          <div class="cp-field">
            <dt class="cp-field-label">Presence</dt>
            <dd class="cp-field-value cp-field-presence" data-status={presenceStatus}>
              <span class="cp-dot" aria-hidden="true"></span>
              {presenceLabel}
              {#if lastSeen}
                <span class="cp-muted"> — last seen {lastSeen}</span>
              {/if}
            </dd>
          </div>
        </dl>
      </div>
    {/if}
  </main>
</div>

<style lang="postcss">
  .cp-page {
    min-block-size: 100dvh;
    background: var(--color-background);
    display: flex;
    flex-direction: column;
  }

  .cp-nav {
    padding: 1rem 1.5rem 0;
    flex-shrink: 0;
  }

  .cp-back {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-secondary);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .cp-back:hover { background: var(--color-surface-raised); }

  .cp-back:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .cp-main {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1.5rem;
  }

  .cp-skeleton,
  .cp-error,
  .cp-card {
    inline-size: 100%;
    max-inline-size: 36rem;
  }

  /* ── Error state ─────────────────────────────────────────── */
  .cp-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3rem 2rem;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    text-align: center;
    color: var(--color-muted);
  }

  .cp-error-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .cp-error-desc {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--color-muted);
  }

  /* ── Profile card ────────────────────────────────────────── */
  .cp-card {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  /* Hero */
  .cp-hero {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.75rem 2rem;
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--color-secondary) 6%, var(--color-surface)) 0%,
      var(--color-surface) 100%
    );
    border-block-end: 1px solid var(--color-border);
  }

  .cp-avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .cp-away-dot {
    position: absolute;
    inset-block-end: 2px;
    inset-inline-end: 2px;
    inline-size: 0.875rem;
    block-size: 0.875rem;
    border-radius: 999px;
    background: #f59e0b;
    border: 2px solid var(--color-surface);
  }

  .cp-hero-info {
    display: grid;
    gap: 0.25rem;
    min-inline-size: 0;
  }

  .cp-name {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cp-role {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--color-muted);
    font-weight: 500;
  }

  .cp-presence {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-subtle);
  }

  .cp-presence[data-status='online'] { color: var(--color-online); }
  .cp-presence[data-status='away']   { color: #f59e0b; }

  .cp-last-seen {
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
  }

  /* Actions */
  .cp-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1.25rem 2rem;
    border-block-end: 1px solid var(--color-border);
  }

  .cp-block-error {
    margin: 0;
    padding: 0 2rem 1rem;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--color-error);
  }

  /* Fields */
  .cp-fields {
    display: grid;
    margin: 0;
    padding: 0.5rem 0;
  }

  .cp-field {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: 0.5rem;
    padding: 0.875rem 2rem;
    border-block-end: 1px solid var(--color-border);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
  }

  .cp-field:last-child { border-block-end: none; }

  .cp-field-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-block-start: 0.1rem;
  }

  .cp-field-value {
    color: var(--color-text);
    word-break: break-word;
  }

  .cp-field-presence {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .cp-dot {
    display: inline-block;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 999px;
    background: var(--color-subtle);
    flex-shrink: 0;
  }

  .cp-field-presence[data-status='online'] .cp-dot  { background: var(--color-online); }
  .cp-field-presence[data-status='away'] .cp-dot    { background: #f59e0b; }
  .cp-field-presence[data-status='offline'] .cp-dot { background: var(--color-subtle); }

  .cp-muted { color: var(--color-muted); }

  .cp-link {
    color: var(--color-secondary);
    text-decoration: none;
    font-weight: 500;
  }

  .cp-link:hover { text-decoration: underline; }

  /* ── Responsive ──────────────────────────────────────────── */
  @media (max-width: 600px) {
    .cp-hero { padding: 1.25rem; }
    .cp-actions { padding: 1rem 1.25rem; }
    .cp-field { grid-template-columns: 1fr; padding: 0.75rem 1.25rem; }
  }
</style>
