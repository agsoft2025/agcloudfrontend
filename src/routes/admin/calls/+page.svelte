<!--
  Admin > Call List
  =================
  Fetches call history via the existing getCallHistory() API (contacts.api.ts → GET /calls/history).
  Date filter and pagination are applied client-side on the fetched dataset.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Avatar from "$lib/components/atoms/Avatar.svelte";
  import Spinner from "$lib/components/atoms/Spinner.svelte";
  import { getCallHistory, type CallHistoryEntry } from "$lib/api/contacts.api";
  import { userStore } from "$lib/stores/user.store";

  // ── Constants ─────────────────────────────────────────────────
  const PAGE_SIZE = 20;

  // ── State ─────────────────────────────────────────────────────
  let allCalls: CallHistoryEntry[] = [];
  let isLoading = true;
  let error: string | null = null;

  // Date filter inputs (ISO date strings — "YYYY-MM-DD" from <input type="date">)
  let filterFrom = "";
  let filterTo = "";

  // Dropdown filters
  let filterType: "" | "audio" | "video" = "";
  let filterMode: "" | "one-to-one" | "conference" = "";

  // Pagination
  let currentPage = 1;

  $: profiles = $userStore.profiles;

  // ── Derived: filter → page ────────────────────────────────────

  $: filteredCalls = applyFilters(
    allCalls,
    filterFrom,
    filterTo,
    filterType,
    filterMode,
  );

  // Reset to page 1 whenever the filtered set changes
  $: filteredCalls, (currentPage = 1);

  $: totalPages = Math.max(1, Math.ceil(filteredCalls.length / PAGE_SIZE));
  $: pagedCalls = filteredCalls.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  $: rangeStart =
    filteredCalls.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  $: rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredCalls.length);

  function applyFilters(
    calls: CallHistoryEntry[],
    from: string,
    to: string,
    type: string,
    mode: string,
  ): CallHistoryEntry[] {
    return calls.filter((entry) => {
      // Date range
      if (from || to) {
        const ts = entry.createdAt ? new Date(entry.createdAt).getTime() : null;
        if (ts !== null) {
          if (from && ts < new Date(from + "T00:00:00").getTime()) return false;
          if (to && ts > new Date(to + "T23:59:59.999").getTime()) return false;
        }
      }
      // Call type
      if (type && entry.callType !== type) return false;
      // Call mode
      if (mode && entry.callMode !== mode) return false;
      return true;
    });
  }

  function clearFilter() {
    filterFrom = "";
    filterTo = "";
    filterType = "";
    filterMode = "";
  }

  $: hasFilter =
    filterFrom !== "" ||
    filterTo !== "" ||
    filterType !== "" ||
    filterMode !== "";

  // ── Helpers ───────────────────────────────────────────────────

  function resolveDisplayName(
    userId?: string,
    fallbackName?: string | null,
  ): string {
    if (!userId) return fallbackName ?? "—";
    const profile = profiles.get(userId);
    if (profile?.displayName?.trim()) return profile.displayName.trim();
    if (profile?.email) {
      const local = profile.email.split("@")[0];
      return local
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return fallbackName ?? userId.slice(0, 8);
  }

  function resolveAvatar(
    userId?: string,
    fallbackAvatar?: string | null,
  ): string | undefined {
    if (!userId) return fallbackAvatar ?? undefined;
    return profiles.get(userId)?.avatarUrl ?? fallbackAvatar ?? undefined;
  }

  function formatDateTime(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return (
      d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " · " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function statusBadgeClass(entry: CallHistoryEntry): string {
    if (entry.isActive) return "badge--active";
    const s = entry.status ?? "";
    if (s === "missed" || entry.participantStatus === "missed")
      return "badge--missed";
    if (s === "rejected" || entry.participantStatus === "rejected")
      return "badge--rejected";
    if (s === "ended") return "badge--ended";
    if (s === "initiated") return "badge--ringing";
    return "badge--default";
  }

  function statusLabel(entry: CallHistoryEntry): string {
    if (entry.isActive) return "Live";
    const s = entry.status ?? "";
    if (s === "missed" || entry.participantStatus === "missed") return "Missed";
    if (s === "rejected" || entry.participantStatus === "rejected")
      return "Rejected";
    if (s === "ended") return "Ended";
    if (s === "initiated") return "Ringing";
    return s || "—";
  }

  async function hydratePeerProfiles(entries: CallHistoryEntry[]) {
    const ids = new Set<string>();

    for (const e of entries) {
      if (e.callerId) ids.add(e.callerId);
      if (e.calleeId) ids.add(e.calleeId);
      if (e.receiverIds) {
        e.receiverIds.forEach((id) => ids.add(id));
      }
    }

    await Promise.all(
      [...ids].map(async (id) => {
        // Already cached — nothing to do.
        if (userStore.getProfile(id)) return;

        // Start/wait for the profile request.
        if (!userStore.isLoading(id)) {
          try {
            await userStore.hydrateProfile(id);
          } catch {
            // Keep fallback if profile cannot be loaded.
          }
        }
      }),
    );
  }

  // ── Fetch (existing API, larger limit for admin) ───────────────
  async function load() {
    isLoading = true;
    error = null;

    try {
      const calls = await getCallHistory(500);

      // IMPORTANT: wait until user profiles are loaded
      // before displaying the call table.
      await hydratePeerProfiles(calls);

      allCalls = calls;
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Could not load call history.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => void load());
</script>

<div class="admin-page">
  <!-- ── Page header ──────────────────────────────────────────── -->
  <header class="admin-page-header">
    <div class="header-row">
      <div>
        <h1 class="admin-page-title">Call List</h1>
        <p class="admin-page-description">All calls across the system.</p>
      </div>
      <button
        class="refresh-btn"
        type="button"
        on:click={() => void load()}
        disabled={isLoading}
        aria-label="Refresh call list"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          class:spinning={isLoading}
        >
          <path
            d="M23 4v6h-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M1 20v-6h6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Refresh
      </button>
    </div>
  </header>

  <!-- ── Filter toolbar ──────────────────────────────────────── -->
  <div class="filter-bar" role="search" aria-label="Filter calls">
    <div class="filter-fields">
      <!-- Date range -->
      <label class="filter-label">
        <span class="filter-label-text">From</span>
        <input
          class="filter-input"
          type="date"
          bind:value={filterFrom}
          max={filterTo || undefined}
          aria-label="Start date"
        />
      </label>
      <span class="filter-sep" aria-hidden="true">—</span>
      <label class="filter-label">
        <span class="filter-label-text">To</span>
        <input
          class="filter-input"
          type="date"
          bind:value={filterTo}
          min={filterFrom || undefined}
          aria-label="End date"
        />
      </label>

      <!-- Divider -->
      <span class="filter-divider" aria-hidden="true"></span>

      <!-- Call type -->
      <label class="filter-label">
        <span class="filter-label-text">Type</span>
        <select
          class="filter-select"
          bind:value={filterType}
          aria-label="Call type"
        >
          <option value="">All</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
        </select>
      </label>

      <!-- Call mode -->
      <label class="filter-label">
        <span class="filter-label-text">Mode</span>
        <select
          class="filter-select"
          bind:value={filterMode}
          aria-label="Call mode"
        >
          <option value="">All</option>
          <option value="one-to-one">One-to-One</option>
          <option value="conference">Conference</option>
        </select>
      </label>
    </div>
    {#if hasFilter}
      <button class="clear-btn" type="button" on:click={clearFilter}>
        <svg
          width="12"
          height="12"
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
        Clear
      </button>
    {/if}
    {#if !isLoading && hasFilter}
      <span class="filter-result-count" aria-live="polite">
        {filteredCalls.length} of {allCalls.length} call{allCalls.length === 1
          ? ""
          : "s"}
      </span>
    {/if}
  </div>

  <!-- ── Loading ──────────────────────────────────────────────── -->
  {#if isLoading}
    <div class="state-box">
      <Spinner size="md" />
      <span>Loading calls…</span>
    </div>

    <!-- ── Error ────────────────────────────────────────────────── -->
  {:else if error}
    <div class="state-box state-box--error" role="alert">
      <svg
        width="24"
        height="24"
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
      <p>{error}</p>
      <button class="retry-btn" type="button" on:click={() => void load()}
        >Retry</button
      >
    </div>

    <!-- ── Empty (no data at all) ───────────────────────────────── -->
  {:else if allCalls.length === 0}
    <div class="state-box" role="status">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.65 3.32 2 2 0 0 1 3.63 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.35 6.35l.98-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <p>No calls found.</p>
    </div>

    <!-- ── No results after filtering ──────────────────────────── -->
  {:else if filteredCalls.length === 0}
    <div class="state-box" role="status">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="11"
          cy="11"
          r="8"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          d="M21 21l-4.35-4.35"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
        />
      </svg>
      <p>No calls match the selected filters.</p>
      <button class="retry-btn" type="button" on:click={clearFilter}
        >Clear filter</button
      >
    </div>

    <!-- ── Table ────────────────────────────────────────────────── -->
  {:else}
    <div class="table-wrap">
      <table class="call-table" aria-label="Call list">
        <thead>
          <tr>
            <th scope="col">Date &amp; Time</th>
            <th scope="col">Caller</th>
            <th scope="col">Callee</th>
            <th scope="col">Type</th>
            <th scope="col">Mode</th>
            <th scope="col">Status</th>
            <th scope="col">Duration</th>
          </tr>
        </thead>
        <tbody>
          {#each pagedCalls as entry (entry.id)}
            {@const callerName = resolveDisplayName(
              entry.callerId,
              entry.callerName,
            )}
            {@const calleeName = resolveDisplayName(
              entry.calleeId ?? entry.receiverIds?.[0],
              entry.calleeName,
            )}
            {@const callerAvatar = resolveAvatar(
              entry.callerId,
              entry.callerAvatar,
            )}
            {@const calleeAvatar = resolveAvatar(
              entry.calleeId ?? entry.receiverIds?.[0],
              entry.calleeAvatar,
            )}
            <tr class:row--active={entry.isActive}>
              <td class="cell-date">{formatDateTime(entry.createdAt)}</td>
              <td>
                <div class="cell-user">
                  <Avatar src={callerAvatar} name={callerName} size="sm" />
                  <span class="user-name">{callerName}</span>
                </div>
              </td>
              <td>
                <div class="cell-user">
                  <Avatar src={calleeAvatar} name={calleeName} size="sm" />
                  <span class="user-name">{calleeName}</span>
                </div>
              </td>
              <td>
                <span
                  class="type-chip type-chip--{entry.callType ?? 'unknown'}"
                >
                  {#if entry.callType === "video"}
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M15 10l5-3v10l-5-3"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <rect
                        x="2"
                        y="6"
                        width="11"
                        height="12"
                        rx="2"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                    </svg>
                  {:else}
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.65 3.32 2 2 0 0 1 3.63 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.35 6.35l.98-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  {/if}
                  {entry.callType ?? "—"}
                </span>
              </td>
              <td class="cell-mode">{entry.callMode ?? "—"}</td>
              <td>
                <span class="badge {statusBadgeClass(entry)}">
                  {#if entry.isActive}<span class="live-dot" aria-hidden="true"
                    ></span>{/if}
                  {statusLabel(entry)}
                </span>
              </td>
              <td class="cell-dur">{formatDuration(entry.durationSeconds)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- ── Pagination footer ─────────────────────────────────── -->
    <div class="pagination" aria-label="Pagination">
      <span class="pagination-info">
        {rangeStart}–{rangeEnd} of {filteredCalls.length} call{filteredCalls.length ===
        1
          ? ""
          : "s"}
      </span>

      <div class="pagination-controls">
        <button
          class="page-btn"
          type="button"
          aria-label="Previous page"
          disabled={currentPage === 1}
          on:click={() => (currentPage -= 1)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <span class="page-indicator" aria-current="page">
          Page {currentPage} of {totalPages}
        </span>

        <button
          class="page-btn"
          type="button"
          aria-label="Next page"
          disabled={currentPage === totalPages}
          on:click={() => (currentPage += 1)}
        >
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
    </div>
  {/if}
</div>

<style lang="postcss">
  .admin-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-block-size: 0;
    padding: 2rem 2.5rem;
    overflow-y: auto;
    gap: 1.25rem;
  }

  /* ── Header ──────────────────────────────────────────────────── */
  .admin-page-header {
    flex-shrink: 0;
  }

  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-block-end: 1.25rem;
    border-block-end: 1px solid var(--color-border);
  }

  .admin-page-title {
    margin: 0 0 0.25rem;
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .admin-page-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, var(--color-text));
    opacity: 0.65;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background-color 140ms ease,
      border-color 140ms ease;
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .spinning {
    animation: spin 900ms linear infinite;
  }

  /* ── Filter bar ──────────────────────────────────────────────── */
  .filter-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: color-mix(
      in srgb,
      var(--color-surface) 70%,
      var(--color-border) 30%
    );
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    flex-shrink: 0;
  }

  .filter-fields {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .filter-label-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text);
    opacity: 0.65;
    white-space: nowrap;
  }

  .filter-input {
    padding: 0.3rem 0.55rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 140ms ease;
  }

  .filter-input:hover {
    border-color: var(--color-border-strong);
  }
  .filter-input:focus {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
    border-color: transparent;
  }

  .filter-select {
    padding: 0.3rem 1.75rem 0.3rem 0.55rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    transition: border-color 140ms ease;
  }

  .filter-select:hover {
    border-color: var(--color-border-strong);
  }
  .filter-select:focus {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
    border-color: transparent;
  }

  .filter-divider {
    display: block;
    inline-size: 1px;
    block-size: 1.25rem;
    background: var(--color-border);
    opacity: 0.6;
    flex-shrink: 0;
  }

  .filter-sep {
    font-size: 0.75rem;
    opacity: 0.4;
    color: var(--color-text);
  }

  .clear-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    opacity: 0.75;
    transition:
      opacity 140ms ease,
      border-color 140ms ease;
  }

  .clear-btn:hover {
    opacity: 1;
    border-color: var(--color-border-strong);
  }

  .filter-result-count {
    font-size: 0.75rem;
    color: var(--color-text);
    opacity: 0.55;
    margin-inline-start: auto;
  }

  /* ── States ──────────────────────────────────────────────────── */
  .state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex: 1;
    min-block-size: 14rem;
    color: var(--color-text);
    opacity: 0.5;
    font-size: 0.9375rem;
  }

  .state-box p {
    margin: 0;
  }

  .state-box--error {
    opacity: 1;
    color: var(--color-danger, #e53e3e);
    border: 1.5px dashed currentColor;
    border-radius: var(--radius-lg, 12px);
  }

  .retry-btn {
    padding: 0.35rem 0.9rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border: 1.5px solid currentColor;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  /* ── Table ───────────────────────────────────────────────────── */
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 12px);
    flex-shrink: 0;
  }

  .call-table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    min-inline-size: 680px;
  }

  .call-table thead {
    background: color-mix(
      in srgb,
      var(--color-surface) 60%,
      var(--color-border) 40%
    );
  }

  .call-table th {
    padding: 0.6rem 0.9rem;
    text-align: start;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text);
    opacity: 0.6;
    border-block-end: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .call-table tbody tr {
    border-block-end: 1px solid var(--color-border);
    transition: background-color 120ms ease;
  }

  .call-table tbody tr:last-child {
    border-block-end: none;
  }
  .call-table tbody tr:hover {
    background: color-mix(in srgb, var(--color-primary) 4%, transparent);
  }
  .call-table tbody tr.row--active {
    background: color-mix(in srgb, #38a169 6%, transparent);
  }

  .call-table td {
    padding: 0.65rem 0.9rem;
    color: var(--color-text);
    vertical-align: middle;
  }

  .cell-date {
    white-space: nowrap;
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }
  .cell-dur {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
  }
  .cell-mode {
    opacity: 0.75;
    text-transform: capitalize;
  }

  /* inner wrapper — flex on a div, not on td, to preserve table cell boundaries */
  .cell-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-inline-size: 140px;
  }

  /* ── Type chip ───────────────────────────────────────────────── */
  .type-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    text-transform: capitalize;
    background: color-mix(in srgb, var(--color-text) 8%, transparent);
    color: var(--color-text);
  }

  /* ── Status badge ────────────────────────────────────────────── */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .badge--active {
    background: color-mix(in srgb, #38a169 15%, transparent);
    color: #276749;
  }
  .badge--ended {
    background: color-mix(in srgb, var(--color-text) 8%, transparent);
    color: var(--color-text);
    opacity: 0.7;
  }
  .badge--missed {
    background: color-mix(in srgb, #e53e3e 12%, transparent);
    color: #9b2c2c;
  }
  .badge--rejected {
    background: color-mix(in srgb, #dd6b20 12%, transparent);
    color: #7b341e;
  }
  .badge--ringing {
    background: color-mix(in srgb, #3182ce 12%, transparent);
    color: #2c5282;
  }
  .badge--default {
    background: color-mix(in srgb, var(--color-text) 8%, transparent);
    color: var(--color-text);
  }

  .live-dot {
    display: inline-block;
    inline-size: 6px;
    block-size: 6px;
    border-radius: 999px;
    background: #38a169;
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  /* ── Pagination ──────────────────────────────────────────────── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .pagination-info {
    font-size: 0.75rem;
    color: var(--color-text);
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-btn {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    transition:
      background-color 140ms ease,
      border-color 140ms ease;
    flex-shrink: 0;
  }

  .page-btn:hover:not(:disabled) {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
  }

  .page-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .page-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
  }

  .page-indicator {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    min-inline-size: 7rem;
    text-align: center;
  }

  @media (max-width: 800px) {
    .admin-page {
      padding: 1.25rem 1rem;
    }
    .pagination {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
