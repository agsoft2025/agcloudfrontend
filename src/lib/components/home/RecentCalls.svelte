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
  import { onMount, onDestroy } from "svelte";
  import Avatar from "$lib/components/atoms/Avatar.svelte";
  import Skeleton from "$lib/components/atoms/Skeleton.svelte";
  import {
    getCallHistory,
    type CallHistoryEntry,
    type CallDirection,
  } from "$lib/api/contacts.api";
  import { authStore } from "$lib/stores/auth.store";
  import { userStore } from "$lib/stores/user.store";
  import { callLifecycleEvents } from "$lib/realtime/call-signaling";
  import { activeCallStore } from "$lib/stores/active-call.store";

  // ── Props ──────────────────────────────────────────────────────
  export let onCallBack: ((entry: CallHistoryEntry) => void) | undefined =
    undefined;

  // ── State ──────────────────────────────────────────────────────
  let calls: CallHistoryEntry[] = [];
  let isLoading = true;
  let error: string | null = null;
  let now = Date.now();

  // ── Helpers ────────────────────────────────────────────────────
  $: currentUserId = $authStore.user?.id ?? "";
  $: profiles = $userStore.profiles;

  /** The peer (other party) user id for a call entry, relative to the current user. */
  function getPeerId(entry: CallHistoryEntry): string | undefined {
    return entry.callerId === currentUserId
      ? (entry.calleeId ?? entry.receiverIds?.[0])
      : entry.callerId;
  }

  /** Derive display name for a call entry relative to the current user. */
  function getPeerName(entry: CallHistoryEntry): string {
    const peerId = getPeerId(entry);
    if (!peerId) return "Unknown";

    const profile = profiles.get(peerId);
    if (profile?.displayName?.trim()) return profile.displayName.trim();
    if (profile?.email) {
      const local = profile.email.split("@")[0];
      return local
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
    }
    return peerId.slice(0, 8);
  }

  function getPeerAvatar(entry: CallHistoryEntry): string | undefined {
    const peerId = getPeerId(entry);
    if (!peerId) return undefined;
    return profiles.get(peerId)?.avatarUrl ?? undefined;
  }

  /** Ensure every peer referenced in the call list has a cached profile. */
  async function hydratePeerProfiles(entries: CallHistoryEntry[]) {
    const peerIds = new Set<string>();

    for (const entry of entries) {
      const peerId = getPeerId(entry);
      if (peerId) peerIds.add(peerId);
    }

    await Promise.all(
      [...peerIds].map(async (peerId) => {
        if (!userStore.getProfile(peerId) && !userStore.isLoading(peerId)) {
          try {
            await userStore.hydrateProfile(peerId);
          } catch {
            // Keep fallback name if profile cannot be loaded.
          }
        }
      }),
    );
  }

  /** Derive call direction if not provided by the server. */
  function getDirection(entry: CallHistoryEntry): CallDirection {
    if (entry.direction) return entry.direction;
    if (entry.status === "missed") return "missed";
    return entry.callerId === currentUserId ? "outgoing" : "incoming";
  }

  function formatTimestamp(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  /** Live elapsed duration (seconds) for an ongoing call, ticking off `now`. */
  function liveDurationSeconds(entry: CallHistoryEntry): number | undefined {
    if (!entry.isActive || !entry.startedAt) return entry.durationSeconds;
    return Math.max(
      0,
      Math.floor((now - new Date(entry.startedAt).getTime()) / 1000),
    );
  }

  /** Human-readable status label for the call history item. */
  function getStatusLabel(
    entry: CallHistoryEntry,
    direction: CallDirection,
  ): string {
    if (entry.isActive) return "Call in Progress";
    if (entry.status === "initiated") return "Ringing";
    if (entry.status === "missed" || entry.participantStatus === "missed")
      return "Missed Call";
    if (entry.status === "rejected" || entry.participantStatus === "rejected")
      return "Rejected";
    return direction === "outgoing" ? "Outgoing" : "Incoming";
  }

  // ── Fetch ──────────────────────────────────────────────────────
  async function load() {
    isLoading = true;
    error = null;

    try {
      const history = await getCallHistory(20);

      // Load profiles before displaying the call list.
      await hydratePeerProfiles(history);

      calls = history;
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Could not load call history.";
    } finally {
      isLoading = false;
    }
  }

  // ── Join an ongoing call from history ─────────────────────────
  function handleJoinCall(entry: CallHistoryEntry) {
    activeCallStore.addIncomingInvite({
      callId: entry.id,
      peer: {
        id: getPeerId(entry) ?? "",
        name: getPeerName(entry),
        avatarUrl: getPeerAvatar(entry) ?? null,
      },
      callType: entry.callType ?? "video",
      callMode: entry.callMode ?? "one-to-one",
      reinvite: true,
    });
  }

  // ── Live updates: re-fetch history whenever a call lifecycle event fires ──
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribeLifecycle = callLifecycleEvents.subscribe((event) => {
    if (!event) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void load(), 300);
  });

  let tickInterval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    void load();
    tickInterval = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    unsubscribeLifecycle();
    clearTimeout(refreshTimer);
    if (tickInterval) clearInterval(tickInterval);
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
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M12 8v4M12 16h.01"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
        <p class="rc-empty-title">Could not load history</p>
        <button class="rc-retry-btn" type="button" onclick={() => void load()}
          >Retry</button
        >
      </div>
    {:else if calls.length === 0}
      <div class="rc-empty">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M1 1l22 22"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
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
          {@const liveDur = formatDuration(liveDurationSeconds(entry))}
          {@const isMissed =
            direction === "missed" ||
            entry.status === "missed" ||
            entry.participantStatus === "missed"}
          {@const statusLabel = getStatusLabel(entry, direction)}

          <li
            class="rc-item"
            class:rc-item--missed={isMissed}
            class:rc-item--active={entry.isActive}
          >
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
                  {#if entry.isActive}
                    <span class="rc-live-dot" aria-hidden="true"></span>
                    {statusLabel}
                    {#if liveDur}<span class="rc-dur">· {liveDur}</span>{/if}
                    {#if entry.participantCount && entry.participantCount > 1}
                      <span class="rc-dur"
                        >· {entry.participantCount} participants</span
                      >
                    {/if}
                  {:else if isMissed}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      aria-label="Missed"
                      role="img"
                    >
                      <path
                        d="M2.01 6.63c-.51.88-.79 1.89-.79 2.97A11.47 11.47 0 0 0 12 21.2a11.47 11.47 0 0 0 8.56-3.76M3.14 2.08 21.86 21.86"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                    {statusLabel}
                  {:else if entry.status === "rejected" || entry.participantStatus === "rejected"}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      aria-label="Rejected"
                      role="img"
                    >
                      <path
                        d="M2.01 6.63c-.51.88-.79 1.89-.79 2.97A11.47 11.47 0 0 0 12 21.2a11.47 11.47 0 0 0 8.56-3.76M3.14 2.08 21.86 21.86"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                    {statusLabel}
                  {:else if entry.status === "initiated"}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      aria-label="Ringing"
                      role="img"
                    >
                      <path
                        d="M12 8v4l2 2"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        stroke-width="1.5"
                      />
                    </svg>
                    {statusLabel}
                  {:else if direction === "outgoing"}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      aria-label="Outgoing"
                      role="img"
                    >
                      <path
                        d="M7 17L17 7M17 7H7M17 7v10"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    Outgoing
                    {#if dur}<span class="rc-dur">· {dur}</span>{/if}
                  {:else}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      aria-label="Incoming"
                      role="img"
                    >
                      <path
                        d="M17 7L7 17M7 17h10M7 17V7"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    Incoming
                    {#if dur}<span class="rc-dur">· {dur}</span>{/if}
                  {/if}
                </div>
              </div>
            </div>

            <!-- Hover actions -->
            <div class="rc-actions">
              {#if entry.isActive}
                <button
                  class="rc-join-btn"
                  type="button"
                  aria-label="Join call with {peerName}"
                  onclick={() => handleJoinCall(entry)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"
                    />
                  </svg>
                  Join Call
                </button>
              {:else}
                <button
                  class="rc-call-back-btn"
                  type="button"
                  aria-label="Call back {peerName}"
                  onclick={() => onCallBack?.(entry)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"
                    />
                  </svg>
                  Call Back
                </button>
              {/if}
              <button
                class="rc-more-btn"
                type="button"
                aria-label="More options for {peerName}"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                  <circle cx="5" cy="12" r="1.5" />
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
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <span class="rc-sos-label">Emergency SOS</span>
      <button class="rc-sos-btn" type="button" aria-label="Open emergency SOS">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 18l6-6-6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
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
    background: color-mix(
      in srgb,
      var(--color-surface-raised) 55%,
      var(--color-background)
    );
    border-inline-start: 1px solid var(--color-border);
  }

  /* ── Header ─────────────────────────────────────────────────── */
  .rc-header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    block-size: 4rem;
    padding: 0 1.25rem;
    border-block-end: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface) 90%, transparent);
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
    letter-spacing: -0.01em;
  }

  /* ── Body ───────────────────────────────────────────────────── */
  .rc-body {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    padding: 0.875rem 0.875rem 0.875rem;
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
    gap: 0.5rem;
  }

  .rc-item {
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-xs);
    overflow: hidden;
    transition:
      box-shadow 150ms ease,
      border-color 150ms ease,
      transform 120ms ease;
  }

  .rc-item:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--color-border-strong);
    transform: translateY(-1px);
  }

  .rc-item--missed {
    border-inline-start: 3px solid var(--color-error);
    background: color-mix(
      in srgb,
      var(--color-error-bg) 60%,
      var(--color-surface)
    );
  }

  .rc-item--missed:hover {
    border-color: color-mix(
      in srgb,
      var(--color-error) 40%,
      var(--color-border)
    );
    border-inline-start-color: var(--color-error);
  }

  .rc-item--active {
    border-inline-start: 3px solid #16a34a;
    background: color-mix(
      in srgb,
      var(--color-success-bg) 50%,
      var(--color-surface)
    );
  }

  .rc-item--active .rc-actions {
    opacity: 1;
    pointer-events: auto;
  }

  .rc-live-dot {
    display: inline-block;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 999px;
    background: #16a34a;
    animation: rc-live-pulse 1.6s ease-in-out infinite;
  }

  @keyframes rc-live-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  .rc-item-inner {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 0.875rem 0.625rem;
  }

  /* ── Avatar ─────────────────────────────────────────────────── */
  .rc-avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  /* ── Info ───────────────────────────────────────────────────── */
  .rc-info {
    display: grid;
    gap: 0.3rem;
    min-inline-size: 0;
  }

  .rc-info-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .rc-name {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .rc-ts {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    color: var(--color-subtle);
    white-space: nowrap;
    flex-shrink: 0;
    font-weight: 600;
    letter-spacing: 0.02em;
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

  .rc-direction[data-direction="missed"] {
    color: var(--color-error);
    font-weight: 700;
  }

  .rc-direction[data-direction="outgoing"] {
    color: var(--color-secondary);
    font-weight: 600;
  }

  .rc-direction[data-direction="incoming"] {
    color: var(--color-success);
    font-weight: 600;
  }

  .rc-dur {
    color: var(--color-muted);
    font-weight: 400;
  }

  /* ── Hover actions ──────────────────────────────────────────── */
  .rc-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0 0.875rem 0.625rem;
    opacity: 1;
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
    padding: 0.4375rem 0.75rem;
    border-radius: var(--radius-lg);
    border: 1.5px solid var(--color-secondary);
    background: color-mix(in srgb, var(--color-secondary) 8%, transparent);
    color: var(--color-secondary);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: -0.005em;
    transition:
      background-color 120ms ease,
      box-shadow 120ms ease,
      transform 100ms ease;
  }

  .rc-call-back-btn:hover {
    background: color-mix(in srgb, var(--color-secondary) 16%, transparent);
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--color-secondary) 20%, transparent);
    transform: translateY(-1px);
  }

  .rc-call-back-btn:active {
    transform: translateY(0);
  }

  .rc-call-back-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .rc-join-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.4375rem 0.75rem;
    border-radius: var(--radius-lg);
    border: 1.5px solid #16a34a;
    background: color-mix(in srgb, #16a34a 10%, transparent);
    color: #16a34a;
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      transform 100ms ease;
  }

  .rc-join-btn:hover {
    background: color-mix(in srgb, #16a34a 18%, transparent);
    transform: translateY(-1px);
  }

  .rc-join-btn:focus-visible {
    outline: 2px solid #16a34a;
    outline-offset: 2px;
  }

  .rc-more-btn {
    display: grid;
    place-items: center;
    inline-size: 2.125rem;
    block-size: 2.125rem;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--color-border);
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .rc-more-btn:hover {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
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
    gap: 0.625rem;
    padding: 3rem 1.5rem;
    text-align: center;
    color: var(--color-muted);
    block-size: 100%;
  }

  .rc-empty svg {
    opacity: 0.4;
  }

  .rc-empty-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .rc-retry-btn {
    padding: 0.4375rem 1.125rem;
    border: 1.5px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 140ms ease,
      border-color 140ms ease;
  }

  .rc-retry-btn:hover {
    background: var(--color-surface-raised);
    border-color: var(--color-secondary);
  }

  /* ── Footer: Emergency SOS ──────────────────────────────────── */
  .rc-footer {
    flex-shrink: 0;
    padding: 0.875rem;
    border-block-start: 1px solid var(--color-border);
  }

  .rc-sos {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0.875rem;
    border-radius: var(--radius-lg);
    background: var(--color-error-bg);
    border: 1px solid var(--color-error-border);
    cursor: pointer;
    transition:
      box-shadow 150ms ease,
      transform 120ms ease;
  }

  .rc-sos:hover {
    box-shadow: 0 2px 10px
      color-mix(in srgb, var(--color-error) 12%, transparent);
    transform: translateY(-1px);
  }

  .rc-sos-icon {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: var(--radius-md);
    background: var(--color-error);
    color: #ffffff;
    flex-shrink: 0;
    box-shadow: 0 2px 6px
      color-mix(in srgb, var(--color-error) 35%, transparent);
  }

  .rc-sos-label {
    flex: 1;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-error);
    letter-spacing: -0.01em;
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

  /* Below 900px the panel is hidden by default; the parent page controls
     visibility via .col-visible-mobile so mobile tabs can show it. */
  @media (max-width: 900px) {
    .rc-panel {
      display: none;
      inline-size: 100%;
      border-inline-start: none;
      border-block-start: 1px solid var(--color-border);
    }

    /* Shown when parent gives it the mobile-visible class */
    :global(.col-visible-mobile) .rc-panel {
      display: flex;
    }
  }
</style>
