<!--
  /calls — Call History Page
  Lists recent calls with direction, type, status, and timestamp.
  Each row links to /calls/[id] for the detail view.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Avatar from "$lib/components/atoms/Avatar.svelte";
  import Skeleton from "$lib/components/atoms/Skeleton.svelte";
  import { authStore } from "$lib/stores/auth.store";
  import { userStore } from "$lib/stores/user.store";
  import { getCallHistory, type CallHistoryEntry, type CallDirection } from "$lib/api/contacts.api";

  // ── State ──────────────────────────────────────────────────────
  let calls: CallHistoryEntry[] = [];
  let isLoading = true;
  let error: string | null = null;

  $: currentUserId = $authStore.user?.id ?? "";
  $: profiles = $userStore.profiles;

  // ── Data loading ───────────────────────────────────────────────
  async function load() {
    isLoading = true;
    error = null;
    try {
      calls = await getCallHistory(40);
      // Hydrate peer profiles in the background
      const ids = new Set<string>();
      calls.forEach((c) => {
        if (c.callerId) ids.add(c.callerId);
        if (c.calleeId) ids.add(c.calleeId);
        c.receiverIds?.forEach((id) => ids.add(id));
      });
      ids.delete(currentUserId);
      await Promise.allSettled(
        Array.from(ids)
          .filter((id) => !userStore.getProfile(id))
          .map((id) => userStore.hydrateProfile(id).catch(() => null))
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not load call history.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void load();
  });

  // ── Helpers ────────────────────────────────────────────────────
  function getPeerId(call: CallHistoryEntry): string | null {
    if (call.callerId && call.callerId !== currentUserId) return call.callerId;
    if (call.calleeId && call.calleeId !== currentUserId) return call.calleeId;
    if (call.receiverIds) {
      const other = call.receiverIds.find((id) => id !== currentUserId);
      if (other) return other;
    }
    return null;
  }

  function getPeerName(call: CallHistoryEntry): string {
    const id = getPeerId(call);
    if (id) {
      const profile = profiles.get(id);
      if (profile) return profile.displayName ?? profile.email;
    }
    return call.callerName ?? call.calleeName ?? "Unknown";
  }

  function getPeerAvatar(call: CallHistoryEntry): string | undefined {
    const id = getPeerId(call);
    if (id) {
      const profile = profiles.get(id);
      if (profile?.avatarUrl) return profile.avatarUrl;
    }
    return call.callerAvatar ?? call.calleeAvatar ?? undefined;
  }

  function getDirection(call: CallHistoryEntry): CallDirection {
    if (call.direction) return call.direction;
    if (call.callerId === currentUserId) return "outgoing";
    const status = call.participantStatus ?? call.status ?? "";
    if (status === "missed") return "missed";
    return "incoming";
  }

  function directionLabel(direction: CallDirection): string {
    switch (direction) {
      case "outgoing": return "Outgoing";
      case "incoming": return "Incoming";
      case "missed":   return "Missed";
    }
  }

  function directionIcon(direction: CallDirection): string {
    switch (direction) {
      case "outgoing": return "↗";
      case "incoming": return "↙";
      case "missed":   return "↙";
    }
  }

  function formatDuration(call: CallHistoryEntry): string {
    const secs = call.durationSeconds;
    if (secs == null || secs <= 0) return "";
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  function formatTimestamp(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) {
      return d.toLocaleDateString(undefined, { weekday: "short" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }


</script>

<main class="calls-page">
  <header class="calls-header">
    <h1>Call History</h1>
  </header>

  {#if error}
    <div class="calls-error" role="alert">{error}</div>
  {/if}

  {#if isLoading}
    <Skeleton variant="call-history" rows={8} />
  {:else if calls.length === 0}
    <p class="calls-empty">No call history yet.</p>
  {:else}
    <ul class="calls-list" aria-label="Call history">
      {#each calls as call (call.id)}
        {@const callId = call.id}
        {@const direction = getDirection(call)}
        {@const duration = formatDuration(call)}
        {@const ts = formatTimestamp(call.createdAt ?? call.startedAt)}
        <li class="call-row">
          <a class="call-row__link" href="/calls/{callId}" aria-label="{directionLabel(direction)} call with {getPeerName(call)}">
            <Avatar
              src={getPeerAvatar(call)}
              name={getPeerName(call)}
              size="md"
            />
            <div class="call-row__info">
              <span class="call-row__name">{getPeerName(call)}</span>
              <span class="call-row__meta">
                <span class="call-row__direction call-row__direction--{direction}" aria-label={directionLabel(direction)}>
                  {directionIcon(direction)}&nbsp;{directionLabel(direction)}
                </span>
                {#if call.callType}
                  <span class="call-row__type">&middot; {call.callType}</span>
                {/if}
                {#if duration}
                  <span class="call-row__duration">&middot; {duration}</span>
                {/if}
              </span>
            </div>
            <span class="call-row__ts" aria-label={ts}>{ts}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .calls-page {
    max-width: 680px;
    margin: 0 auto;
    padding: var(--pico-spacing, 1.5rem);
  }

  .calls-header {
    margin-bottom: 1.5rem;
  }

  .calls-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .calls-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .call-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
    border-radius: var(--pico-border-radius, 0.375rem);
    cursor: pointer;
    transition: background-color 0.15s ease;
    outline: none;
  }

  .call-row:hover,
  .call-row:focus-visible {
    background-color: var(--pico-secondary-background, rgba(0, 0, 0, 0.05));
  }

  :global([data-theme="dark"]) .call-row:hover,
  :global([data-theme="dark"]) .call-row:focus-visible {
    background-color: rgba(255, 255, 255, 0.06);
  }

  .call-row__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .call-row__name {
    font-weight: 500;
    font-size: 0.9375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .call-row__meta {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: var(--pico-muted-color, #888);
  }

  .call-row__direction {
    font-weight: 500;
  }

  .call-row__direction--outgoing { color: #2563eb; }
  .call-row__direction--incoming { color: #16a34a; }
  .call-row__direction--missed   { color: #dc2626; }

  :global([data-theme="dark"]) .call-row__direction--outgoing { color: #60a5fa; }
  :global([data-theme="dark"]) .call-row__direction--incoming { color: #4ade80; }
  :global([data-theme="dark"]) .call-row__direction--missed   { color: #f87171; }

  .call-row__type,
  .call-row__duration {
    color: var(--pico-muted-color, #6b7280);
  }

  .call-row__ts {
    font-size: 0.75rem;
    color: var(--pico-muted-color, #888);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .calls-empty {
    text-align: center;
    color: var(--pico-muted-color, #888);
    padding: 3rem 1rem;
  }

  .calls-error {
    padding: 0.75rem 1rem;
    background-color: var(--pico-del-color, #fee2e2);
    color: #b91c1c;
    border-radius: var(--pico-border-radius, 0.375rem);
    margin-bottom: 1rem;
  }
</style>
