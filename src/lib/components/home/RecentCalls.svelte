<!--
  RecentCalls.svelte
  Right panel of the Contact Dashboard.

  Displays recent call history with:
    - Contact name + avatar (initials fallback)
    - Call direction badge (missed / incoming / outgoing)
    - Timestamp + duration
    - Hover "Call Back" and "More" actions
    - Emergency SOS footer
    - Skeleton while loading, error state, empty state

  Props:
    onCallBack — optional callback when user presses "Call Back"
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Skeleton from '$lib/components/atoms/Skeleton.svelte';
  import { getCallHistory, type CallHistoryEntry, type CallDirection } from '$lib/api/contacts.api';
  import { authStore } from '$lib/stores/auth.store';
  import { userStore } from '$lib/stores/user.store';

  // ── Props ──────────────────────────────────────────────────────
  export let onCallBack: ((entry: CallHistoryEntry) => void) | undefined = undefined;

  // ── State ──────────────────────────────────────────────────────
  let calls: CallHistoryEntry[] = [];
  let isLoading = true;
  let error: string | null = null;

  // ── Helpers ────────────────────────────────────────────────────
  $: currentUserId = $authStore.user?.id ?? '';

  /** Derive display name for a call entry relative to the current user. */
  function getPeerName(entry: CallHistoryEntry): string {
    const peerId =
      entry.callerId === currentUserId
        ? (entry.calleeId ?? entry.receiverIds?.[0])
        : entry.callerId;

    if (!peerId) return 'Unknown';

    const profile = userStore.getProfile(peerId);
    if (profile?.displayName?.trim()) return profile.displayName.trim();
    if (profile?.email) {
      const local = profile.email.split('@')[0];
      return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
    }
    return peerId.slice(0, 8);
  }

  function getPeerAvatar(entry: CallHistoryEntry): string | undefined {
    const peerId =
      entry.callerId === currentUserId
        ? (entry.calleeId ?? entry.receiverIds?.[0])
        : entry.callerId;
    if (!peerId) return undefined;
    return userStore.getProfile(peerId)?.avatarUrl ?? undefined;
  }

  /** Derive call direction if not provided by the server. */
  function getDirection(entry: CallHistoryEntry): CallDirection {
    if (entry.direction) return entry.direction;
    if (entry.status === 'missed') return 'missed';
    return entry.callerId === currentUserId ? 'outgoing' : 'incoming';
  }

  function formatTimestamp(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  // ── Fetch ──────────────────────────────────────────────────────
  async function load() {
    isLoading = true;
    error = null;
    try {
      calls = await getCallHistory(20);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load call history.';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="rc-panel">
  <!-- Header -->
  <header class="rc-header">
    <h2 class="rc-title">Recent Calls</h2>
  </header>

  <!-- Body -->
  <div class="rc-body">
    {#if isLoading}
      <Skeleton variant="call-history" rows={4} />

    {:else if error}
      <div class="rc-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
        <p class="rc-empty-title">Could not load history</p>
        <button class="rc-retry-btn" type="button" onclick={() => void load()}>Retry</button>
      </div>

    {:else if calls.length === 0}
      <div class="rc-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p class="rc-empty-title">No recent calls</p>
      </div>

    {:else}
      <ol class="rc-list" role="list">
        {#each calls as entry (entry.id)}
          {@const direction = getDirection(entry)}
          {@const peerName = getPeerName(entry)}
          {@const peerAvatar = getPeerAvatar(entry)}
          {@const ts = formatTimestamp(entry.createdAt)}
          {@const dur = formatDuration(entry.durationSeconds)}
          {@const isMissed = direction === 'missed'}

          <li class="rc-item" class:rc-item--missed={isMissed}>
            <div class="rc-item-inner">
              <!-- Avatar -->
              <div class="rc-avatar">
                <Avatar src={peerAvatar} name={peerName} size="sm" />
              </div>

              <!-- Info -->
              <div class="rc-info">
                <div class="rc-info-top">
                  <span class="rc-name">{peerName}</span>
                  {#if ts}
                    <span class="rc-ts">{ts}</span>
                  {/if}
                </div>
                <div class="rc-direction" data-direction={direction}>
                  {#if direction === 'missed'}
                    <svg width="12" height="12" viewBox="0 0 24 24" aria-label="Missed" role="img">
                      <path d="M2.01 6.63c-.51.88-.79 1.89-.79 2.97A11.47 11.47 0 0 0 12 21.2a11.47 11.47 0 0 0 8.56-3.76M3.14 2.08 21.86 21.86"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Missed Call
                  {:else if direction === 'outgoing'}
                    <svg width="12" height="12" viewBox="0 0 24 24" aria-label="Outgoing" role="img">
                      <path d="M7 17L17 7M17 7H7M17 7v10"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Outgoing
                    {#if dur}<span class="rc-dur">· {dur}</span>{/if}
                  {:else}
                    <svg width="12" height="12" viewBox="0 0 24 24" aria-label="Incoming" role="img">
                      <path d="M17 7L7 17M7 17h10M7 17V7"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Incoming
                    {#if dur}<span class="rc-dur">· {dur}</span>{/if}
                  {/if}
                </div>
              </div>
            </div>

            <!-- Hover actions -->
            <div class="rc-actions">
              <button
                class="rc-call-back-btn"
                type="button"
                aria-label="Call back {peerName}"
                onclick={() => onCallBack?.(entry)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                </svg>
                Call Back
              </button>
              <button
                class="rc-more-btn"
                type="button"
                aria-label="More options for {peerName}"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="12" r="1.5"/>
                  <circle cx="19" cy="12" r="1.5"/>
                  <circle cx="5" cy="12" r="1.5"/>
                </svg>
              </button>
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  </div>

  <!-- Emergency SOS footer -->
  <footer class="rc-footer">
    <div class="rc-sos">
      <div class="rc-sos-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>
      <span class="rc-sos-label">Emergency SOS</span>
      <button class="rc-sos-btn" type="button" aria-label="Open emergency SOS">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </footer>
</div>

<style lang="postcss">
  /* ── Panel shell ────────────────────────────────────────────── */
  .rc-panel {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    inline-size: 22rem;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--color-surface-raised) 60%, transparent);
    border-inline-start: 1px solid var(--color-border);
  }

  /* ── Header ─────────────────────────────────────────────────── */
  .rc-header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    block-size: 4rem;
    padding: 0 var(--space-lg);
    border-block-end: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface) 88%, transparent);
    backdrop-filter: blur(12px);
    position: sticky;
    inset-block-start: 0;
    z-index: 2;
  }

  .rc-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--color-text);
  }

  /* ── Body ───────────────────────────────────────────────────── */
  .rc-body {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    padding: var(--space-md);
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  /* ── List ───────────────────────────────────────────────────── */
  .rc-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .rc-item {
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-xs);
    overflow: hidden;
    transition: box-shadow 140ms ease;
  }

  .rc-item:hover {
    box-shadow: var(--shadow-sm);
  }

  .rc-item--missed {
    border-inline-start: 3px solid var(--color-error);
  }

  .rc-item-inner {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    align-items: center;
    gap: var(--space-md);
    padding: 0.75rem var(--space-md);
  }

  /* ── Avatar ─────────────────────────────────────────────────── */
  .rc-avatar {
    display: grid;
    place-items: center;
  }

  /* ── Info ───────────────────────────────────────────────────── */
  .rc-info {
    display: grid;
    gap: 0.25rem;
    min-inline-size: 0;
  }

  .rc-info-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xs);
  }

  .rc-name {
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rc-ts {
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    color: var(--color-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .rc-direction {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-muted);
  }

  .rc-direction[data-direction='missed'] {
    color: var(--color-error);
  }

  .rc-direction[data-direction='outgoing'] {
    color: var(--color-secondary);
  }

  .rc-dur {
    color: var(--color-muted);
    font-weight: 400;
  }

  /* ── Hover actions ──────────────────────────────────────────── */
  .rc-actions {
    display: flex;
    gap: var(--space-xs);
    padding: 0 var(--space-md) 0.625rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 140ms ease;
  }

  .rc-item:hover .rc-actions {
    opacity: 1;
    pointer-events: auto;
  }

  .rc-call-back-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.375rem var(--space-sm);
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--color-secondary) 28%, transparent);
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-secondary);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .rc-call-back-btn:hover {
    background: color-mix(in srgb, var(--color-secondary) 18%, transparent);
  }

  .rc-call-back-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .rc-more-btn {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    padding: 0;
    transition: background-color 120ms ease;
  }

  .rc-more-btn:hover {
    background: var(--color-surface-raised);
    color: var(--color-text);
  }

  .rc-more-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  /* ── Empty / error ──────────────────────────────────────────── */
  .rc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-xl) var(--space-lg);
    text-align: center;
    color: var(--color-muted);
    block-size: 100%;
  }

  .rc-empty-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .rc-retry-btn {
    padding: 0.375rem 1rem;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .rc-retry-btn:hover {
    background: var(--color-surface-raised);
  }

  /* ── Footer: Emergency SOS ──────────────────────────────────── */
  .rc-footer {
    flex-shrink: 0;
    padding: var(--space-md);
    border-block-start: 1px solid var(--color-border);
  }

  .rc-sos {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 0.625rem var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
  }

  .rc-sos-icon {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: var(--radius-sm);
    background: var(--color-error);
    color: #ffffff;
    flex-shrink: 0;
  }

  .rc-sos-label {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-error);
  }

  .rc-sos-btn {
    display: grid;
    place-items: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-error);
    cursor: pointer;
    padding: 0;
    transition: background-color 140ms ease;
  }

  .rc-sos-btn:hover {
    background: color-mix(in srgb, var(--color-error) 12%, transparent);
  }

  .rc-sos-btn:focus-visible {
    outline: 2px solid var(--color-error);
    outline-offset: 2px;
  }

  /* ── Responsive ─────────────────────────────────────────────── */
  @media (max-width: 1100px) {
    .rc-panel {
      inline-size: 18rem;
    }
  }

  @media (max-width: 900px) {
    .rc-panel {
      display: none;
    }
  }
</style>
