<!--
  ParticipantListExample — ParticipantList + CallGrid side-by-side
  =================================================================
  Shows how to integrate the ParticipantList panel alongside the
  VideoTile CallGrid in a full-screen call layout.

  Layout:
  ┌─────────────────────────────────────┬──────────────┐
  │                                     │ Participants  │
  │         CallGrid (VideoTiles)       │ ─────────────│
  │                                     │ [Avatar] You  │
  │                                     │ [Avatar] Jane │
  │                                     │ [Avatar] Alex │
  └─────────────────────────────────────┴──────────────┘
  ┌─────────────────────────────── CallControls ────────┘

  callStore is the single source of truth — both CallGrid and
  ParticipantList read from it independently; no prop drilling.

  Props for context menu actions are optional. Omit any you don't
  need — the context menu button disappears automatically per row.
-->
<script lang="ts">
  import { callStore } from '$lib/stores/call.store';
  import { ConnectionState } from 'livekit-client';
  import CallGrid from './CallGrid.svelte';
  import ParticipantList from '../ParticipantList.svelte';

  // ── Panel visibility ──────────────────────────────────────────
  let showParticipants = $state(true);
  let participantsPanelCollapsed = $state(false);

  // ── Call session context (from parent) ────────────────────────
  type Props = {
    /** Fired when the local user wants to end the call. */
    onEndCall?: () => void | Promise<void>;
  };

  let { onEndCall }: Props = $props();

  const isConnected = $derived(
    $callStore.connectionState === ConnectionState.Connected
  );

  // ── Context-menu action stubs ─────────────────────────────────
  // Replace with real navigation / API calls in production.

  function handleViewProfile(identity: string) {
    console.log('[ParticipantList] View profile:', identity);
    // e.g. goto(`/profile/${identity}`)
  }

  /**
   * Server-side mute requires a LiveKit server API call.
   * The livekit-server-sdk (Node.js) or your backend endpoint
   * must mute the remote participant.
   * Example endpoint: POST /calls/:callId/participants/:identity/mute
   */
  async function handleMuteParticipant(identity: string) {
    console.log('[ParticipantList] Mute participant:', identity);
    // await callsApi.muteParticipant(callId, identity);
  }

  /**
   * Remove / kick requires a LiveKit server API call.
   * Example endpoint: DELETE /calls/:callId/participants/:identity
   */
  async function handleRemoveParticipant(identity: string) {
    console.log('[ParticipantList] Remove participant:', identity);
    // await callsApi.removeParticipant(callId, identity);
  }
</script>

<!-- Full-screen call layout wrapper -->
<div class="call-layout" aria-label="Active call">

  <!-- ── Video stage + Participant panel ───────────────────── -->
  <div class="call-body">

    <!-- CallGrid — fills available space -->
    <main class="call-stage" aria-label="Video participants">
      <CallGrid />
    </main>

    <!-- ParticipantList panel — conditionally visible -->
    {#if showParticipants}
      <aside aria-label="Participants panel">
        <ParticipantList
          bind:collapsed={participantsPanelCollapsed}
          showSearch={true}
          showCollapse={true}
          onViewProfile={handleViewProfile}
          onMuteParticipant={isConnected ? handleMuteParticipant : undefined}
          onRemoveParticipant={isConnected ? handleRemoveParticipant : undefined}
        />
      </aside>
    {/if}

  </div>

  <!-- ── Bottom controls bar (stub — use CallControls component) -->
  <footer class="call-footer">
    <div class="call-footer-left">
      <!-- Toggle participants panel -->
      <button
        type="button"
        class="footer-btn"
        class:is-active={showParticipants}
        aria-pressed={showParticipants}
        aria-label={showParticipants ? 'Hide participants' : 'Show participants'}
        onclick={() => (showParticipants = !showParticipants)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
        Participants
        <span class="footer-btn-count" aria-hidden="true">
          {$callStore.remoteParticipants.length + 1}
        </span>
      </button>
    </div>

    <!-- Use <CallControls> here for mic/camera/end controls -->
    <p class="call-footer-hint" aria-hidden="true">← Mount CallControls here</p>
  </footer>

</div>

<style lang="postcss">
  /* ── Full-screen layout ───────────────────────────────────── */
  .call-layout {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--color-background);
    font-family: var(--font-sans);
  }

  /* ── Body: grid stage + sidebar ──────────────────────────── */
  .call-body {
    flex: 1;
    min-block-size: 0;
    display: flex;
    overflow: hidden;
  }

  .call-stage {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    padding: var(--space-sm);
  }

  /* ── Footer controls bar ─────────────────────────────────── */
  .call-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem var(--space-md);
    border-block-start: 1px solid var(--color-border);
    background: var(--color-surface);
  }

  .call-footer-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .footer-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color var(--duration-fast) ease,
      color var(--duration-fast) ease,
      border-color var(--duration-fast) ease;
  }

  .footer-btn:hover {
    background: var(--color-surface-raised);
    color: var(--color-text);
  }

  .footer-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .footer-btn.is-active {
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-secondary) 30%, transparent);
    color: var(--color-secondary);
  }

  .footer-btn-count {
    display: grid;
    place-items: center;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    border-radius: 999px;
    background: var(--color-border);
    color: var(--color-text);
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1;
  }

  .footer-btn.is-active .footer-btn-count {
    background: color-mix(in srgb, var(--color-secondary) 20%, transparent);
    color: var(--color-secondary);
  }

  .call-footer-hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-subtle);
  }
</style>
