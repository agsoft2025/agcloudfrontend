<!--
  ParticipantList — right-sidebar panel for active call participants
  ==================================================================
  Svelte 5 component. Reads from callStore (populated by useCall.ts /
  bindCallEvents). Track-resolution logic is identical to VideoTile so
  both components always reflect the same media state.

  Atom usage:
    Avatar  sm  — caller photo / initials per row
    Badge   dot — network quality colour indicator per row
    Badge   sm  — "You" label for the local participant
    Skeleton contacts — loading state while connecting

  Molecule usage:
    DropdownMenu — optional per-row context menu (three-dot trigger)

  Features:
    • Live participant count in the header
    • Optional search filter (case-insensitive, matches display name)
    • Optional collapse/expand toggle
    • Active-speaker row highlight with animated speaking dot
    • Mute / camera-off / connecting visual states
    • Optional context menu per row (View Profile, Mute, Remove)
    • Full keyboard nav and ARIA labels

  Data flow:
    callStore → $derived list → filtered list → rendered rows
    Any callStore update (mute, join, leave, speaking) rerenders
    only the affected row because Svelte tracks the $derived chain.
-->
<script lang="ts">
  import { Track, ConnectionQuality } from 'livekit-client';

  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Badge from '$lib/components/atoms/Badge.svelte';
  import type { BadgeVariant } from '$lib/components/atoms/Badge.svelte';
  import Skeleton from '$lib/components/atoms/Skeleton.svelte';

  import DropdownMenu from '$lib/components/molecules/DropdownMenu.svelte';
  import type { DropdownItem } from '$lib/components/molecules/DropdownMenu.types.ts';

  import { callStore } from '$lib/stores/call.store';
  import { ConnectionState } from 'livekit-client';

  import type {
    ParticipantDisplayRow,
    ParticipantRowActions,
    NetworkQuality,
  } from './ParticipantList.types.ts';

  // ── Props ─────────────────────────────────────────────────────
  type Props = ParticipantRowActions & {
    /** Show the search input. Default true. */
    showSearch?: boolean;
    /** Show a collapse/expand button in the header. Default false. */
    showCollapse?: boolean;
    /** Initial collapsed state when showCollapse is true. */
    collapsed?: boolean;
    /** Extra class forwarded to the root element. */
    class?: string;
  };

  let {
    onViewProfile,
    onMuteParticipant,
    onRemoveParticipant,
    showSearch   = true,
    showCollapse = false,
    collapsed    = $bindable(false),
    class: extraClass = '',
  }: Props = $props();

  // ── Search state ──────────────────────────────────────────────
  let searchQuery = $state('');
  let searchRef   = $state<HTMLInputElement | null>(null);

  // ── Connection / loading ──────────────────────────────────────
  const connectionState = $derived($callStore.connectionState);
  const isLoading       = $derived(
    connectionState === ConnectionState.Connecting ||
    (connectionState === ConnectionState.Disconnected &&
     $callStore.localParticipant === null)
  );

  // ── NetworkQuality mapper ─────────────────────────────────────
  function mapQuality(q: ConnectionQuality): NetworkQuality | undefined {
    switch (q) {
      case ConnectionQuality.Excellent: return 'excellent';
      case ConnectionQuality.Good:      return 'good';
      case ConnectionQuality.Poor:      return 'poor';
      default:                          return undefined;
    }
  }

  // ── Derive a display row from a CallParticipantState ──────────
  function toDisplayRow(
    p: typeof $callStore.localParticipant & object,
    isLocal: boolean
  ): ParticipantDisplayRow {
    const micPub = p.tracks.find(
      (t) => t.kind === Track.Kind.Audio && t.source === Track.Source.Microphone
    );
    const camPub = p.tracks.find(
      (t) => t.kind === Track.Kind.Video && t.source === Track.Source.Camera
    );

    return {
      sid:          p.sid,
      identity:     p.identity,
      displayName:  (p.name?.trim() || p.identity).trim(),
      isLocal,
      isMicOn:      Boolean(micPub && !micPub.isMuted),
      isCameraOn:   Boolean(camPub && !camPub.isMuted && camPub.track),
      isSpeaking:   p.isSpeaking,
      networkQuality: mapQuality(p.participant.connectionQuality),
      isConnecting: !isLocal && Boolean(camPub) && !camPub?.isSubscribed,
    };
  }

  // ── All participants: local first, then remotes ───────────────
  const allRows = $derived.by<ParticipantDisplayRow[]>(() => {
    const rows: ParticipantDisplayRow[] = [];

    if ($callStore.localParticipant) {
      rows.push(toDisplayRow($callStore.localParticipant, true));
    }

    for (const remote of $callStore.remoteParticipants) {
      rows.push(toDisplayRow(remote, false));
    }

    // Active speakers float to top (local stays pinned first)
    return rows.sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      if (a.isSpeaking && !b.isSpeaking) return -1;
      if (!a.isSpeaking && b.isSpeaking) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  });

  // ── Filtered by search ────────────────────────────────────────
  const filteredRows = $derived(
    searchQuery.trim()
      ? allRows.filter((r) =>
          r.displayName.toLowerCase().includes(searchQuery.trim().toLowerCase())
        )
      : allRows
  );

  const totalCount    = $derived(allRows.length);
  const speakerCount  = $derived(allRows.filter((r) => r.isSpeaking).length);

  // ── Network quality → Badge variant ──────────────────────────
  const QUALITY_VARIANT: Record<NetworkQuality, BadgeVariant> = {
    excellent: 'success',
    good:      'info',
    fair:      'warning',
    poor:      'danger',
  };

  const QUALITY_LABEL: Record<NetworkQuality, string> = {
    excellent: 'Excellent network',
    good:      'Good network',
    fair:      'Fair network',
    poor:      'Poor network',
  };

  // ── Per-row context menu items ────────────────────────────────
  function buildMenuItems(row: ParticipantDisplayRow): DropdownItem[] {
    const items: DropdownItem[] = [];

    if (onViewProfile) {
      items.push({
        id: 'view-profile',
        label: 'View Profile',
        icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                 stroke="currentColor" stroke-width="1.75"
                 stroke-linecap="round" stroke-linejoin="round"/>
               <circle cx="12" cy="7" r="4"
                 stroke="currentColor" stroke-width="1.75"/>`,
      });
    }

    if (onMuteParticipant && !row.isLocal && row.isMicOn) {
      items.push({
        id: 'mute',
        label: 'Mute',
        icon: `<line x1="1" y1="1" x2="23" y2="23"
                 stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
               <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"
                 stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
               <path d="M17 16.95A7 7 0 0 1 5 12v-2"
                 stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
      });
    }

    if (onRemoveParticipant && !row.isLocal) {
      if (items.length) items.push({ id: '__sep__', label: '' });
      items.push({
        id: 'remove',
        label: 'Remove from call',
        danger: true,
        icon: `<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"
                 fill="currentColor" opacity=".01"/>
               <path d="M20 9V7M20 7V5M20 7H18M20 7h2"
                 stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
               <path d="M13 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0z"
                 stroke="currentColor" stroke-width="1.75"/>
               <path d="M1 21c0-3.87 3.13-7 7-7"
                 stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
      });
    }

    return items;
  }

  function handleMenuSelect(item: DropdownItem, row: ParticipantDisplayRow) {
    switch (item.id) {
      case 'view-profile':  onViewProfile?.(row.identity);       break;
      case 'mute':          onMuteParticipant?.(row.identity);   break;
      case 'remove':        onRemoveParticipant?.(row.identity); break;
    }
  }

  // Whether any context action is configured (hides menu if none)
  const hasActions = $derived(
    Boolean(onViewProfile || onMuteParticipant || onRemoveParticipant)
  );

  // ── Accessible row label builder ──────────────────────────────
  function rowAriaLabel(row: ParticipantDisplayRow): string {
    const parts = [row.displayName];
    if (row.isLocal)     parts.push('(you)');
    if (row.isSpeaking)  parts.push('speaking');
    if (!row.isMicOn)    parts.push('microphone muted');
    if (!row.isCameraOn) parts.push('camera off');
    if (row.isConnecting) parts.push('connecting');
    if (row.networkQuality === 'poor') parts.push('poor network');
    return parts.join(', ');
  }
</script>

<section
  class="pl-panel {extraClass}"
  class:is-collapsed={collapsed}
  aria-label="Participants panel"
>

  <!-- ── Header ─────────────────────────────────────────────── -->
  <header class="pl-header">
    <div class="pl-header-left">
      <h2 class="pl-title">
        Participants
        <span class="pl-count" aria-label="{totalCount} participant{totalCount !== 1 ? 's' : ''}">
          ({totalCount})
        </span>
      </h2>
      {#if speakerCount > 0 && !collapsed}
        <span class="pl-speaking-chip" aria-live="polite" aria-atomic="true">
          <span class="pl-speaking-dot" aria-hidden="true"></span>
          {speakerCount} speaking
        </span>
      {/if}
    </div>

    {#if showCollapse}
      <button
        class="pl-collapse-btn"
        type="button"
        aria-label={collapsed ? 'Expand participants panel' : 'Collapse participants panel'}
        aria-expanded={!collapsed}
        onclick={() => (collapsed = !collapsed)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          class:pl-chevron-rotated={collapsed}
        >
          <path
            d="M4 10L8 6l4 4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {/if}
  </header>

  <!-- ── Collapsible body ───────────────────────────────────── -->
  {#if !collapsed}
    <!-- Search -->
    {#if showSearch && !isLoading}
      <div class="pl-search-wrap">
        <span class="pl-search-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </span>
        <input
          bind:this={searchRef}
          bind:value={searchQuery}
          type="search"
          class="pl-search"
          placeholder="Search participants"
          aria-label="Search participants"
          autocomplete="off"
          spellcheck="false"
        />
        {#if searchQuery}
          <button
            class="pl-search-clear"
            type="button"
            aria-label="Clear search"
            onclick={() => { searchQuery = ''; searchRef?.focus(); }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        {/if}
      </div>
    {/if}

    <!-- ── List ───────────────────────────────────────────────── -->
    <div class="pl-list-wrap">

      {#if isLoading}
        <!-- Loading skeleton -->
        <div class="pl-skeleton-wrap">
          <Skeleton variant="contacts" rows={4} />
        </div>

      {:else if filteredRows.length === 0}
        <!-- Empty state -->
        <div class="pl-empty" role="status">
          {#if searchQuery}
            <p>No participants match "<strong>{searchQuery}</strong>"</p>
          {:else}
            <p>No participants yet</p>
          {/if}
        </div>

      {:else}
        <ul
          class="pl-list"
          role="list"
          aria-label="Participant list"
          aria-live="polite"
          aria-relevant="additions removals"
        >
          {#each filteredRows as row (row.sid)}
            {@const menuItems = buildMenuItems(row)}

            <li
              class="pl-row"
              class:is-speaking={row.isSpeaking}
              class:is-connecting={row.isConnecting}
              aria-label={rowAriaLabel(row)}
              role="listitem"
            >
              <!-- Avatar -->
              <span class="pl-avatar-wrap" aria-hidden="true">
                {#if row.isSpeaking}
                  <span class="pl-avatar-ring" aria-hidden="true"></span>
                {/if}
                <Avatar
                  name={row.displayName}
                  size="sm"
                  alt="{row.displayName} avatar"
                />
              </span>

              <!-- Name + badges -->
              <span class="pl-info">
                <span class="pl-name">
                  {row.displayName}
                  {#if row.isLocal}
                    <Badge variant="primary" size="sm" label="You" ariaLabel="Local participant" />
                  {/if}
                  {#if row.isConnecting}
                    <Badge variant="neutral" size="sm" label="Connecting" />
                  {/if}
                </span>

                <!-- Sub-row: status pills -->
                <span class="pl-status-row" aria-hidden="true">
                  {#if row.isSpeaking && row.isMicOn}
                    <span class="pl-speaking-badge">
                      <span class="pl-speak-dot"></span>
                      Speaking
                    </span>
                  {:else if !row.isMicOn}
                    <span class="pl-status-pill pl-muted">
                      <!-- Mic-off icon -->
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <line x1="1" y1="1" x2="23" y2="23"
                          stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5
                                 a3 3 0 0 0-5.94-.6"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                      Muted
                    </span>
                  {/if}

                  {#if !row.isCameraOn && !row.isConnecting}
                    <span class="pl-status-pill pl-cam-off">
                      <!-- Camera-off icon -->
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <line x1="2" y1="2" x2="22" y2="22"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <path d="M10.7 6H13a2 2 0 0 1 2 2v2.3M15 14l5 3V7
                                 M2 8a2 2 0 0 1 2-2h2
                                 M2 12v4a2 2 0 0 0 2 2h9"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round"/>
                      </svg>
                      No video
                    </span>
                  {/if}
                </span>
              </span>

              <!-- Right-side indicators -->
              <span class="pl-indicators" aria-hidden="true">
                <!-- Mic icon (inline, right side) -->
                {#if row.isMicOn}
                  <span class="pl-icon pl-icon--mic" title="Microphone on">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"
                        stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                      <path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8"
                        stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                    </svg>
                  </span>
                {:else}
                  <span class="pl-icon pl-icon--mic-off" title="Microphone muted">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <line x1="1" y1="1" x2="23" y2="23"
                        stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5
                               a3 3 0 0 0-5.94-.6"
                        stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                    </svg>
                  </span>
                {/if}

                <!-- Camera icon -->
                {#if row.isCameraOn}
                  <span class="pl-icon pl-icon--cam" title="Camera on">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M15 10l5-3v10l-5-3"
                        stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                        stroke-linejoin="round"/>
                      <rect x="2" y="6" width="11" height="12" rx="2"
                        stroke="currentColor" stroke-width="1.75"/>
                    </svg>
                  </span>
                {:else}
                  <span class="pl-icon pl-icon--cam-off" title="Camera off">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <line x1="2" y1="2" x2="22" y2="22"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <path d="M15 14l5 3V7M2 8a2 2 0 0 1 2-2h2
                               M2 12v4a2 2 0 0 0 2 2h9"
                        stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                        stroke-linejoin="round"/>
                    </svg>
                  </span>
                {/if}

                <!-- Network quality dot -->
                {#if row.networkQuality}
                  <span
                    class="pl-quality-dot"
                    title={QUALITY_LABEL[row.networkQuality]}
                  >
                    <Badge
                      variant={QUALITY_VARIANT[row.networkQuality]}
                      size="sm"
                      dot
                      ariaLabel={QUALITY_LABEL[row.networkQuality]}
                    />
                  </span>
                {/if}
              </span>

              <!-- Context menu (only if actions exist + not local for mute/remove) -->
              {#if hasActions && menuItems.length > 0}
                <span class="pl-menu-wrap">
                  <DropdownMenu
                    items={menuItems}
                    placement="bottom-end"
                    onSelect={(item) => handleMenuSelect(item, row)}
                    triggerLabel="Actions for {row.displayName}"
                  >
                    {#snippet trigger()}
                      <span class="pl-menu-trigger-icon" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="3"   r="1.2" fill="currentColor"/>
                          <circle cx="8" cy="8"   r="1.2" fill="currentColor"/>
                          <circle cx="8" cy="13"  r="1.2" fill="currentColor"/>
                        </svg>
                      </span>
                    {/snippet}
                  </DropdownMenu>
                </span>
              {/if}

            </li>
          {/each}
        </ul>
      {/if}

    </div>
  {/if}

</section>

<style lang="postcss">
  /* ═══════════════════════════════════════════════════════════
     PANEL ROOT
     ═══════════════════════════════════════════════════════════ */
  .pl-panel {
    display: flex;
    flex-direction: column;
    inline-size: clamp(17rem, 20vw, 22rem);
    block-size: 100%;
    overflow: hidden;
    background: var(--color-surface);
    border-inline-start: 1px solid var(--color-border);
    font-family: var(--font-sans);
    color: var(--color-text);
  }

  .pl-panel.is-collapsed {
    block-size: auto;
  }

  /* ═══════════════════════════════════════════════════════════
     HEADER
     ═══════════════════════════════════════════════════════════ */
  .pl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    flex-shrink: 0;
    padding: var(--space-md) var(--space-md) var(--space-sm);
    border-block-end: 1px solid var(--color-border);
  }

  .pl-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-inline-size: 0;
  }

  .pl-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 800;
    color: var(--color-text);
    white-space: nowrap;
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
  }

  .pl-count {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-muted);
  }

  /* Live "N speaking" chip */
  .pl-speaking-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.5rem;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, #34d399 12%, transparent);
    border: 1px solid color-mix(in srgb, #34d399 28%, transparent);
    color: #059669;
    font-size: 0.6875rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .pl-speaking-dot {
    display: inline-block;
    inline-size: 0.4rem;
    block-size: 0.4rem;
    border-radius: 999px;
    background: #34d399;
    animation: pl-dot-pulse 1s ease-in-out infinite;
  }

  /* Collapse button */
  .pl-collapse-btn {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    padding: 0;
    transition:
      background-color var(--duration-fast) ease,
      color var(--duration-fast) ease;
  }

  .pl-collapse-btn:hover {
    background: var(--color-surface-raised);
    color: var(--color-text);
  }

  .pl-collapse-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .pl-chevron-rotated {
    transform: rotate(180deg);
  }

  /* ═══════════════════════════════════════════════════════════
     SEARCH
     ═══════════════════════════════════════════════════════════ */
  .pl-search-wrap {
    position: relative;
    flex-shrink: 0;
    margin: var(--space-sm) var(--space-sm) 0;
  }

  .pl-search-icon {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 0.625rem;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    color: var(--color-subtle);
    pointer-events: none;
  }

  .pl-search {
    inline-size: 100%;
    min-block-size: 2.125rem;
    padding-inline: 2rem var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
    outline: none;
    transition:
      border-color var(--duration-fast) ease,
      box-shadow var(--duration-fast) ease;
    /* Remove browser default search styling */
    appearance: none;
  }

  .pl-search::-webkit-search-cancel-button { display: none; }

  .pl-search::placeholder { color: var(--color-subtle); }

  .pl-search:hover { border-color: var(--color-border-strong); }

  .pl-search:focus {
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px var(--focus-ring-color);
  }

  .pl-search-clear {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-end: 0.5rem;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    border: none;
    background: transparent;
    color: var(--color-subtle);
    cursor: pointer;
    padding: 0.2rem;
    border-radius: 3px;
    transition: color var(--duration-fast) ease;
  }

  .pl-search-clear:hover { color: var(--color-text); }

  /* ═══════════════════════════════════════════════════════════
     LIST WRAPPER + SKELETON
     ═══════════════════════════════════════════════════════════ */
  .pl-list-wrap {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--space-sm);
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .pl-skeleton-wrap {
    padding: var(--space-xs);
  }

  /* ── Empty state ──────────────────────────────────────────── */
  .pl-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl) var(--space-md);
    text-align: center;
  }

  .pl-empty p {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.875rem;
  }

  .pl-empty strong {
    color: var(--color-text-secondary);
  }

  /* ═══════════════════════════════════════════════════════════
     PARTICIPANT LIST + ROWS
     ═══════════════════════════════════════════════════════════ */
  .pl-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ── Row ──────────────────────────────────────────────────── */
  .pl-row {
    position: relative;
    display: grid;
    grid-template-columns: 2.5rem 1fr auto auto;
    align-items: center;
    gap: 0.5rem;
    min-block-size: 3.125rem;
    padding: 0.4375rem var(--space-sm);
    border-radius: var(--radius-sm);
    border-inline-start: 3px solid transparent;
    background: transparent;
    transition:
      background-color var(--duration-fast) ease,
      border-color     var(--duration-fast) ease;
    cursor: default;
  }

  /* Hover */
  .pl-row:hover {
    background: var(--color-surface-raised);
  }

  /* Active speaker highlight */
  .pl-row.is-speaking {
    background: color-mix(in srgb, #34d399 7%, transparent);
    border-inline-start-color: #34d399;
  }

  .pl-row.is-speaking:hover {
    background: color-mix(in srgb, #34d399 10%, transparent);
  }

  /* Connecting / dimmed */
  .pl-row.is-connecting {
    opacity: 0.6;
  }

  /* ── Avatar wrap + ring ───────────────────────────────────── */
  .pl-avatar-wrap {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex-shrink: 0;
  }

  /* Pulsing ring when speaking */
  .pl-avatar-ring {
    position: absolute;
    inset: -3px;
    border-radius: 999px;
    border: 2px solid #34d399;
    opacity: 0;
    animation: pl-ring-pulse 1.4s ease-out infinite;
  }

  /* ── Info column ──────────────────────────────────────────── */
  .pl-info {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    min-inline-size: 0;
  }

  .pl-name {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Status row (sub-line) ────────────────────────────────── */
  .pl-status-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-block-size: 1rem;
  }

  /* Speaking badge */
  .pl-speaking-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #059669;
  }

  .pl-speak-dot {
    display: inline-block;
    inline-size: 0.375rem;
    block-size: 0.375rem;
    border-radius: 999px;
    background: #34d399;
    animation: pl-dot-pulse 800ms ease-in-out infinite;
  }

  /* Status pills (Muted, No video) */
  .pl-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .pl-muted  { color: var(--color-error,  #dc2626); }
  .pl-cam-off { color: var(--color-muted); }

  /* ── Right-side status icons ──────────────────────────────── */
  .pl-indicators {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .pl-icon {
    display: grid;
    place-items: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .pl-icon--mic     { color: var(--color-muted); }
  .pl-icon--cam     { color: var(--color-muted); }

  .pl-icon--mic-off { color: var(--color-error, #dc2626); }
  .pl-icon--cam-off { color: var(--color-subtle); }

  .pl-quality-dot {
    display: grid;
    place-items: center;
    inline-size: 0.75rem;
    block-size: 0.75rem;
  }

  /* ── Context menu button wrap ─────────────────────────────── */
  .pl-menu-wrap {
    display: flex;
    flex-shrink: 0;
    /* Hidden until row is hovered or focused */
    opacity: 0;
    transition: opacity var(--duration-fast) ease;
  }

  .pl-row:hover .pl-menu-wrap,
  .pl-row:focus-within .pl-menu-wrap {
    opacity: 1;
  }

  /* Style the DropdownMenu trigger icon inside our wrapper.
     Uses .pl-menu-wrap:hover / :focus-within (scoped) so no
     :global() compound is needed.                            */
  .pl-menu-trigger-icon {
    display: grid;
    place-items: center;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    transition:
      background-color var(--duration-fast) ease,
      color var(--duration-fast) ease;
  }

  /* Hover / keyboard focus on the wrap reveals + tints the icon */
  .pl-menu-wrap:hover .pl-menu-trigger-icon,
  .pl-menu-wrap:focus-within .pl-menu-trigger-icon {
    background: var(--color-border);
    color: var(--color-text);
  }

  /* ═══════════════════════════════════════════════════════════
     ANIMATIONS
     ═══════════════════════════════════════════════════════════ */
  @keyframes pl-dot-pulse {
    0%, 100% { transform: scale(0.9); opacity: 0.7; }
    50%       { transform: scale(1.3); opacity: 1; }
  }

  @keyframes pl-ring-pulse {
    0%   { transform: scale(1);   opacity: 0.6; }
    80%  { transform: scale(1.7); opacity: 0; }
    100% { transform: scale(1.7); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pl-speak-dot,
    .pl-speaking-dot,
    .pl-avatar-ring { animation: none; }
  }
</style>
