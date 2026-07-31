<!--
  /calls/[id] — Past Call Detail Page
  Displays call metadata and participant list.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Skeleton from '$lib/components/atoms/Skeleton.svelte';
  import Spinner from '$lib/components/atoms/Spinner.svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import { presenceStore, type PresenceStatus } from '$lib/stores/presence.store';
  import { userStore, type UserProfile } from '$lib/stores/user.store';
  import { authStore } from '$lib/stores/auth.store';
  import { getCall, type CallSummary } from '$lib/api/calls.api';

  // ── State ──────────────────────────────────────────────────
  let callData: CallSummary | null = null;
  let participants: UserProfile[] = [];
  let isLoading = true;
  let error: string | null = null;

  $: callId = $page.params.id as string;
  $: currentUserId = $authStore.user?.id ?? '';
  $: profiles = $userStore.profiles;

  // ── Data loading ─────────────────────────────────────────────
  async function load() {
    isLoading = true;
    error = null;
    try {
      const response = await getCall(callId);
      callData = response.call;
      await hydrateParticipants(callData);
      presenceStore.startPolling();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load call details.';
    } finally {
      isLoading = false;
    }
  }

  async function hydrateParticipants(call: CallSummary | null) {
    if (!call) return;
    const ids = new Set<string>();
    if (call.callerId) ids.add(call.callerId);
    if (call.calleeId) ids.add(call.calleeId);
    call.receiverIds?.forEach((id) => ids.add(id));

    await Promise.allSettled(
      Array.from(ids)
        .filter((id) => !userStore.getProfile(id))
        .map((id) => userStore.hydrateProfile(id).catch(() => null))
    );
  }

  // Re-derive participants list reactively once profiles load
  $: if (callData) {
    const ids = new Set<string>();
    if (callData.callerId) ids.add(callData.callerId);
    if (callData.calleeId) ids.add(callData.calleeId);
    callData.receiverIds?.forEach((id) => ids.add(id));
    participants = Array.from(ids)
      .map((id) => profiles.get(id))
      .filter((p): p is UserProfile => p != null);
  }

  onMount(() => {
    void load();
    return () => presenceStore.stopPolling();
  });

  // ── Formatting helpers ───────────────────────────────────────
  function formatDuration(call: CallSummary): string {
    if (!call.createdAt) return 'N/A';
    const startMs = new Date(call.createdAt).getTime();
    if (isNaN(startMs)) return 'N/A';
    // Active calls use the current time so the duration ticks in real time.
    // Ended/missed/rejected calls use the recorded end timestamp so duration
    // remains fixed after the call completes; fall back to updatedAt, then
    // Date.now() only if neither timestamp is available.
    const isActive = call.status === 'active';
    const endTs = isActive
      ? Date.now()
      : (call.endedAt ? new Date(call.endedAt).getTime() : null)
          ?? (call.updatedAt ? new Date(call.updatedAt).getTime() : null)
          ?? Date.now();
    const secs = Math.floor((endTs - startMs) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${secs % 60}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }

  function formatTimestamp(iso?: string): string {
    if (!iso) return 'N/A';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function formatCallType(t?: string): string {
    if (!t) return 'Unknown';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function formatStatus(s?: string): string {
    if (!s) return 'Unknown';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function getDisplayName(c: UserProfile): string {
    if (c.displayName?.trim()) return c.displayName.trim();
    if (!c.email) return 'Unknown';
    const local = c.email.split('@')[0];
    return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function getRoleLabel(c: UserProfile): string {
    if (!c.role?.trim()) return '';
    return c.role.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function getParticipantRole(id: string): string {
    if (!callData) return 'Participant';
    if (id === callData.callerId) return 'Caller';
    return 'Recipient';
  }
</script>

<svelte:head>
  <title>Call Details | AG Cloud</title>
</svelte:head>

<div class="cd-page">
  <!-- Back link -->
  <nav class="cd-nav" aria-label="Breadcrumb">
    <button class="cd-back" type="button" onclick={() => goto('/home')} aria-label="Back to contacts">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Home
    </button>
  </nav>

  <main class="cd-main">
    {#if isLoading}
      <div class="cd-skeleton">
        <Skeleton variant="call-history" rows={4} />
      </div>

    {:else if error}
      <div class="cd-error" role="alert">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
        <p class="cd-error-title">Could not load call details</p>
        <p class="cd-error-desc">{error}</p>
        <Button variant="secondary" size="sm" on:click={() => void load()}>Retry</Button>
      </div>

    {:else if callData}
      <!-- Call info card -->
      <section class="cd-card" aria-label="Call information">
        <header class="cd-card-header">
          <div class="cd-type-badge" data-type={callData.callType ?? 'audio'}>
            {#if callData.callType === 'video'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"
                  stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
            {formatCallType(callData.callType)} Call
          </div>
          <span class="cd-status-badge" data-status={callData.status ?? 'unknown'}>
            {formatStatus(callData.status)}
          </span>
        </header>

        <dl class="cd-details">
          <div class="cd-detail-row">
            <dt>Call ID</dt>
            <dd class="cd-mono">{callData.id ?? callData._id ?? 'N/A'}</dd>
          </div>
          <div class="cd-detail-row">
            <dt>Type</dt>
            <dd>{formatCallType(callData.callType)}</dd>
          </div>
          <div class="cd-detail-row">
            <dt>Mode</dt>
            <dd>{callData.callMode === 'conference' ? 'Conference' : 'One-to-one'}</dd>
          </div>
          <div class="cd-detail-row">
            <dt>Status</dt>
            <dd>{formatStatus(callData.status)}</dd>
          </div>
          <div class="cd-detail-row">
            <dt>Started</dt>
            <dd>{formatTimestamp(callData.createdAt)}</dd>
          </div>
          {#if callData.roomId}
            <div class="cd-detail-row">
              <dt>Room</dt>
              <dd class="cd-mono">{callData.roomId}</dd>
            </div>
          {/if}
        </dl>
      </section>

      <!-- Participants section -->
      <section class="cd-participants" aria-label="Participants">
        <h2 class="cd-section-title">
          Participants
          <span class="cd-count">{participants.length}</span>
        </h2>

        {#if participants.length === 0}
          <div class="cd-empty">
            <p>No participant profiles available.</p>
          </div>
        {:else}
          <ul class="cd-participant-list">
            {#each participants as participant (participant.id)}
              {@const pPresence = $presenceStore.presences.get(participant.id)}
              {@const pStatus = (pPresence?.status ?? 'offline') as PresenceStatus}
              {@const pRole = getParticipantRole(participant.id)}
              <li class="cd-participant-row">
                <Avatar
                  src={participant.avatarUrl ?? undefined}
                  name={getDisplayName(participant)}
                  size="md"
                  online={pStatus === 'online'}
                />
                <div class="cd-participant-info">
                  <span class="cd-participant-name">
                    {getDisplayName(participant)}
                    {#if participant.id === currentUserId}
                      <span class="cd-you-badge">You</span>
                    {/if}
                  </span>
                  <span class="cd-participant-meta">
                    {#if getRoleLabel(participant)}{getRoleLabel(participant)} · {/if}{pRole}
                  </span>
                </div>
                <span class="cd-participant-presence" data-status={pStatus}>
                  {pStatus === 'online' ? 'Online' : pStatus === 'away' ? 'Away' : 'Offline'}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {:else}
      <div class="cd-error">
        <p class="cd-error-title">Call not found</p>
      </div>
    {/if}
  </main>
</div>

<style lang="postcss">
  .cd-page {
    min-block-size: 100dvh;
    background: var(--color-background);
    display: flex;
    flex-direction: column;
  }

  .cd-nav {
    padding: 1rem 1.5rem 0;
    flex-shrink: 0;
  }

  .cd-back {
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

  .cd-back:hover { background: var(--color-surface-raised); }

  .cd-back:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .cd-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 1.5rem;
    gap: 1.5rem;
  }

  .cd-skeleton,
  .cd-error,
  .cd-card,
  .cd-participants {
    inline-size: 100%;
    max-inline-size: 40rem;
  }

  /* ── Error ───────────────────────────────────────────────── */
  .cd-error {
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

  .cd-error-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .cd-error-desc {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--color-muted);
  }

  /* ── Call info card ──────────────────────────────────────── */
  .cd-card {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .cd-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.75rem;
    border-block-end: 1px solid var(--color-border);
    background: var(--color-surface-raised);
  }

  .cd-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .cd-status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-muted);
  }

  .cd-status-badge[data-status='active']  { color: var(--color-online);  border-color: var(--color-online); }
  .cd-status-badge[data-status='ended']   { color: var(--color-muted);   }
  .cd-status-badge[data-status='missed']  { color: var(--color-error);   border-color: var(--color-error-border); }
  .cd-status-badge[data-status='rejected']{ color: var(--color-error);   border-color: var(--color-error-border); }

  .cd-details {
    margin: 0;
    display: grid;
    padding: 0.375rem 0;
  }

  .cd-detail-row {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: 0.75rem;
    padding: 0.75rem 1.75rem;
    border-block-end: 1px solid var(--color-border);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
  }

  .cd-detail-row:last-child { border-block-end: none; }

  .cd-detail-row dt {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cd-detail-row dd {
    margin: 0;
    color: var(--color-text);
    word-break: break-all;
  }

  .cd-mono {
    font-family: var(--font-mono, monospace);
    font-size: 0.875rem;
  }

  /* ── Participants section ────────────────────────────────── */
  .cd-section-title {
    margin: 0 0 1rem;
    font-family: var(--font-sans);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .cd-count {
    display: inline-grid;
    place-items: center;
    min-inline-size: 1.375rem;
    block-size: 1.375rem;
    padding-inline: 0.25rem;
    border-radius: 999px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-muted);
  }

  .cd-participants {
    display: flex;
    flex-direction: column;
  }

  .cd-empty {
    padding: 2rem;
    text-align: center;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
  }

  .cd-empty p { margin: 0; }

  .cd-participant-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .cd-participant-row {
    display: grid;
    grid-template-columns: 2.5rem 1fr auto;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1.25rem;
    border-block-end: 1px solid var(--color-border);
    transition: background-color 120ms ease;
  }

  .cd-participant-row:last-child { border-block-end: none; }
  .cd-participant-row:hover { background: var(--color-surface-raised); }

  .cd-participant-info {
    display: grid;
    gap: 0.125rem;
    min-inline-size: 0;
  }

  .cd-participant-name {
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .cd-you-badge {
    display: inline-grid;
    place-items: center;
    padding: 0.1rem 0.375rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
    color: var(--color-secondary);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .cd-participant-meta {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--color-muted);
  }

  .cd-participant-presence {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-subtle);
    white-space: nowrap;
  }

  .cd-participant-presence[data-status='online'] { color: var(--color-online); }
  .cd-participant-presence[data-status='away']   { color: #f59e0b; }

  /* ── Responsive ──────────────────────────────────────────── */
  @media (max-width: 600px) {
    .cd-detail-row { grid-template-columns: 1fr; }
    .cd-card-header { flex-wrap: wrap; gap: 0.75rem; }
  }
</style>
