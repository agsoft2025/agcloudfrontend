<!--
  IncomingCallNotifications.svelte
  ==================================
  Persistent notification banner stack shown at the top of the screen for
  every pending/recent call invitation (see active-call.store's
  `incomingInvites`). Unlike the full-screen IncomingCallOverlay, these
  banners remain visible alongside whatever the user is doing (including
  while already on another call), let the user join an ongoing call, and
  automatically reflect when a call has ended.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import type { IncomingInvite } from '$lib/stores/active-call.store';

  export let invites: IncomingInvite[] = [];

  const dispatch = createEventDispatcher<{
    join: IncomingInvite;
    dismiss: IncomingInvite;
  }>();

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  function statusLabel(invite: IncomingInvite): string {
    if (invite.status === 'ended') return 'Call Ended';
    if (invite.reinvite) return 'Call in Progress';
    return invite.callType === 'video' ? 'Incoming video call' : 'Incoming voice call';
  }
</script>

{#if invites.length > 0}
  <div class="icn-stack" role="region" aria-label="Call notifications">
    {#each invites as invite (invite.callId)}
      <div
        class="icn-card"
        class:icn-card--ended={invite.status === 'ended'}
        in:fly={{ y: -16, duration: 200 }}
        out:fade={{ duration: 150 }}
      >
        <div class="icn-avatar" aria-hidden="true">
          {#if invite.peer.avatarUrl}
            <img src={invite.peer.avatarUrl} alt="" />
          {:else}
            <span>{getInitials(invite.peer.name)}</span>
          {/if}
        </div>

        <div class="icn-info">
          <span class="icn-name">{invite.peer.name}</span>
          <span class="icn-status">{statusLabel(invite)}</span>
        </div>

        <div class="icn-actions">
          {#if invite.status !== 'ended'}
            <button
              type="button"
              class="icn-btn icn-btn--join"
              on:click={() => dispatch('join', invite)}
            >
              {invite.reinvite ? 'Join Call' : 'Join'}
            </button>
          {/if}
          <button
            type="button"
            class="icn-btn icn-btn--dismiss"
            aria-label="Dismiss notification from {invite.peer.name}"
            disabled={invite.status === 'ended'}
            on:click={() => dispatch('dismiss', invite)}
          >
            {invite.status === 'ended' ? '' : 'Dismiss'}
            {#if invite.status === 'ended'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            {/if}
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style lang="postcss">
  .icn-stack {
    position: fixed;
    inset-block-start: 0.75rem;
    inset-inline: 0;
    z-index: 80;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    pointer-events: none;
  }

  .icn-card {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    inline-size: min(28rem, calc(100vw - 1.5rem));
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius-lg, 14px);
    background: var(--color-surface, #161b22);
    border: 1px solid var(--color-border, #30363d);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
  }

  .icn-card--ended {
    opacity: 0.7;
  }

  .icn-avatar {
    flex-shrink: 0;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--color-secondary, #4e87ff);
    color: #fff;
    font-weight: 700;
    font-size: 0.875rem;
    overflow: hidden;
  }

  .icn-avatar img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .icn-info {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .icn-name {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text, #f3f4f6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icn-status {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--color-muted, #9ca3af);
  }

  .icn-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .icn-btn {
    border: none;
    border-radius: 999px;
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0.4rem 0.875rem;
    transition: background-color 140ms ease, opacity 140ms ease;
  }

  .icn-btn--join {
    background: #16a34a;
    color: #fff;
  }

  .icn-btn--join:hover {
    background: #15803d;
  }

  .icn-btn--dismiss {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-muted, #9ca3af);
    display: grid;
    place-items: center;
  }

  .icn-btn--dismiss:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.16);
    color: var(--color-text, #f3f4f6);
  }

  .icn-btn--dismiss:disabled {
    cursor: default;
    opacity: 0.6;
    padding: 0.4rem;
  }
</style>
