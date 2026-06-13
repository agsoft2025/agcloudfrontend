<!--
  IncomingCallOverlay — full-screen incoming call experience
  ===========================================================
  Svelte 5 component. Accepts caller data and action callbacks as props.
  Does not implement any signaling or LiveKit logic.

  Atom usage:
    Avatar atom — caller photo with initials fallback, oversized via
                  --avatar-size CSS custom property override.
    Button atom — Accept (primary) and Reject (danger), size="lg".

  ARIA pattern: modal dialog
    https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
    role="dialog", aria-modal, aria-labelledby, aria-describedby.
    Focus is trapped inside the card; Escape rejects the call.
    Screen-reader announcement fires via aria-live="assertive" region.

  State lifecycle:
    ringing    →  initial state, pulse rings animate
    accepting  →  Accept button loading; both buttons disabled
    rejecting  →  Reject button loading; Accept disabled
    connecting →  (after accept resolves) "Connecting…" shown
    dismissed  →  parent unmounts the component

  Animation:
    Backdrop  fade-in 220ms
    Card      scale + fade-in 280ms ease-out
    Rings     3 staggered pulse rings, 2.4s each, infinite
    Exit      controlled by parent (simply removes the component)
-->
<script lang="ts">
  import { tick } from 'svelte';
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import Spinner from '$lib/components/atoms/Spinner.svelte';
  import type { IncomingCallData, IncomingCallActions } from './IncomingCallOverlay.types.ts';

  // ── Props ─────────────────────────────────────────────────────
  type Props = IncomingCallData & IncomingCallActions & {
    /**
     * Press Escape to reject.
     * Disable if your app uses Escape for something else.
     */
    rejectOnEscape?: boolean;
    /** Extra class forwarded to the root overlay element. */
    class?: string;
  };

  let {
    callId,
    callerId,
    callerName,
    callerAvatar,
    callType = 'video',
    roomName,
    rejectOnEscape = true,
    onAccept,
    onReject,
    class: extraClass = '',
  }: Props = $props();

  // ── Component state ───────────────────────────────────────────
  let isAccepting  = $state(false);
  let isRejecting  = $state(false);
  let isConnecting = $state(false);   // set after accept resolves, before parent unmounts

  const isBusy = $derived(isAccepting || isRejecting || isConnecting);

  // ── DOM refs ──────────────────────────────────────────────────
  let dialogRef = $state<HTMLDivElement | null>(null);

  // ── Stable ARIA IDs ───────────────────────────────────────────
  const uid     = Math.random().toString(36).slice(2, 8);
  const titleId = `ical-title-${uid}`;
  const descId  = `ical-desc-${uid}`;

  // ── Focus management ──────────────────────────────────────────
  // Save the element that was focused when the overlay opened so
  // we can restore it when the overlay is dismissed.
  let previousFocus: HTMLElement | null = null;

  $effect(() => {
    // Capture focus when the dialog mounts
    previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    // Focus the Accept button on first tick (gives the DOM time to paint)
    tick().then(() => {
      const accept = dialogRef?.querySelector<HTMLElement>('.ical-accept button');
      accept?.focus();
    });

    // Lock body scroll (consistent with Modal.svelte)
    const saved = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = saved;
      previousFocus?.focus();
    };
  });

  // ── Keyboard: global handler ──────────────────────────────────
  $effect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && rejectOnEscape && !isBusy) {
        e.preventDefault();
        handleReject();
        return;
      }
      if (e.key === 'Tab') {
        trapFocus(e);
      }
    }

    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  });

  function trapFocus(e: KeyboardEvent) {
    if (!dialogRef) return;

    const focusable = Array.from(
      dialogRef.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => {
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    });

    if (focusable.length === 0) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ── Actions ───────────────────────────────────────────────────
  async function handleAccept() {
    if (isBusy) return;
    isAccepting = true;
    try {
      await onAccept();
      // Show "Connecting…" until parent unmounts us
      isConnecting = true;
    } catch {
      // Parent is responsible for error presentation
    } finally {
      isAccepting = false;
    }
  }

  async function handleReject() {
    if (isBusy) return;
    isRejecting = true;
    try {
      await onReject();
    } catch {
      // Parent handles errors
    } finally {
      isRejecting = false;
    }
  }

  // ── Display helpers ───────────────────────────────────────────
  const callTypeLabel = $derived(
    callType === 'video' ? 'Incoming video call' : 'Incoming audio call'
  );

  const ariaLabel = $derived(
    `Incoming ${callType} call from ${callerName}`
  );

  // Initials for Avatar fallback
  const callerInitials = $derived(
    callerName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('')
  );
</script>

<!--
  Assertive live region — fires on mount so screen readers announce
  the incoming call immediately without waiting for focus move.
-->
<div
  class="ical-announce"
  role="status"
  aria-live="assertive"
  aria-atomic="true"
>
  {ariaLabel}
</div>

<!-- ── Full-screen overlay ──────────────────────────────────── -->
<div class="ical-overlay {extraClass}" aria-hidden="true">
  <!-- Blurred backdrop (click does nothing — call requires explicit action) -->
  <div class="ical-backdrop"></div>
</div>

<!-- ── Dialog card ──────────────────────────────────────────── -->
<div
  bind:this={dialogRef}
  class="ical-dialog-wrap"
  role="presentation"
>
  <div
    class="ical-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={descId}
    aria-label={ariaLabel}
    tabindex="-1"
  >

    <!-- ── Caller section ────────────────────────────────────── -->
    <div class="ical-caller">

      <!-- Pulsing ring animation + Avatar -->
      <div class="ical-avatar-wrap" aria-hidden="true">
        <span class="ical-ring ical-ring--1"></span>
        <span class="ical-ring ical-ring--2"></span>
        <span class="ical-ring ical-ring--3"></span>

        <span class="ical-avatar-inner">
          <Avatar
            src={callerAvatar}
            name={callerName}
            initials={callerInitials}
            size="lg"
            alt="{callerName} avatar"
          />
        </span>
      </div>

      <!-- Call type icon badge -->
      <span class="ical-type-badge" aria-hidden="true">
        {#if callType === 'video'}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M15 10l5-3v10l-5-3"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round"/>
            <rect x="2" y="6" width="11" height="12" rx="2"
              stroke="currentColor" stroke-width="2"/>
          </svg>
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
                     A19.5 19.5 0 0 1 3.07 10.8a19.79 19.79 0 0 1-3.07-8.67
                     A2 2 0 0 1 2 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81
                     a2 2 0 0 1-.45 2.11L6.09 7.91a16 16 0 0 0 6 6l1.27-1.27
                     a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7
                     A2 2 0 0 1 22 16.92z"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round"/>
          </svg>
        {/if}
      </span>

      <!-- Name -->
      <h2 id={titleId} class="ical-name">{callerName}</h2>

      <!-- Call description + optional room info -->
      <p id={descId} class="ical-desc">
        {#if isConnecting}
          <span class="ical-connecting">
            <Spinner size="sm" decorative />
            Connecting…
          </span>
        {:else}
          {callTypeLabel}
          {#if roomName}
            <span class="ical-room" aria-label="Room: {roomName}">
              · {roomName}
            </span>
          {/if}
        {/if}
      </p>
    </div>

    <!-- ── Action buttons ────────────────────────────────────── -->
    <div class="ical-actions" role="group" aria-label="Call actions">

      <!-- Accept -->
      <div class="ical-accept">
        <Button
          variant="primary"
          size="lg"
          loading={isAccepting}
          disabled={isBusy}
          ariaLabel="Accept call from {callerName}"
          on:click={handleAccept}
        >
          <span class="ical-btn-content">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
                       A19.5 19.5 0 0 1 3.07 10.8a19.79 19.79 0 0 1-3.07-8.67
                       A2 2 0 0 1 2 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81
                       a2 2 0 0 1-.45 2.11L6.09 7.91a16 16 0 0 0 6 6l1.27-1.27
                       a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7
                       A2 2 0 0 1 22 16.92z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round"/>
            </svg>
            Accept
          </span>
        </Button>
      </div>

      <!-- Reject -->
      <div class="ical-reject">
        <Button
          variant="danger"
          size="lg"
          loading={isRejecting}
          disabled={isBusy}
          ariaLabel="Reject call from {callerName}"
          on:click={handleReject}
        >
          <span class="ical-btn-content ical-btn-content--reject">
            <!-- Rotated phone = hang-up icon -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              style="transform: rotate(135deg)"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
                       A19.5 19.5 0 0 1 3.07 10.8a19.79 19.79 0 0 1-3.07-8.67
                       A2 2 0 0 1 2 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81
                       a2 2 0 0 1-.45 2.11L6.09 7.91a16 16 0 0 0 6 6l1.27-1.27
                       a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7
                       A2 2 0 0 1 22 16.92z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round"/>
            </svg>
            Decline
          </span>
        </Button>
      </div>

    </div>

    <!-- Keyboard hint -->
    {#if !isBusy && rejectOnEscape}
      <p class="ical-hint" aria-hidden="true">Press Esc to decline</p>
    {/if}

  </div>
</div>

<style lang="postcss">
  /* ── Screen-reader announcement ─────────────────────────────── */
  .ical-announce {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* ═══════════════════════════════════════════════════════════
     OVERLAY + BACKDROP
     ═══════════════════════════════════════════════════════════ */
  .ical-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    pointer-events: none;
  }

  .ical-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.52);
    backdrop-filter: blur(10px) saturate(0.8);
    -webkit-backdrop-filter: blur(10px) saturate(0.8);
    animation: ical-fade-in 220ms ease both;
  }

  /* ── Dialog wrapper: positions the card ─────────────────────── */
  .ical-dialog-wrap {
    position: fixed;
    inset: 0;
    z-index: 1201;
    display: grid;
    place-items: center;
    padding: var(--space-lg, 1.5rem);
    pointer-events: none;
  }

  /* ═══════════════════════════════════════════════════════════
     CARD
     ═══════════════════════════════════════════════════════════ */
  .ical-card {
    pointer-events: all;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xl, 2rem);
    inline-size: min(100%, 22rem);
    padding: 2.5rem 2rem 2rem;

    background: var(--color-surface, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-xl, 24px);
    box-shadow:
      var(--shadow-2xl, 0 25px 50px -12px rgba(0,0,0,.18)),
      0 0 0 1px rgba(0, 0, 0, 0.04);

    animation: ical-card-in 280ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)) both;
    animation-delay: 40ms;  /* slight delay so backdrop appears first */

    outline: none;
  }

  .ical-card:focus {
    outline: none;
  }

  /* ═══════════════════════════════════════════════════════════
     CALLER SECTION
     ═══════════════════════════════════════════════════════════ */
  .ical-caller {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm, 0.5rem);
    text-align: center;
  }

  /* ── Ringing ring container ──────────────────────────────────
     The three rings sit behind the avatar and expand outward.  */
  .ical-avatar-wrap {
    position: relative;
    display: inline-grid;
    place-items: center;
    inline-size: 5.5rem;
    block-size: 5.5rem;
    margin-block-end: var(--space-sm, 0.5rem);
  }

  /* Override Avatar atom size to fill the wrap */
  .ical-avatar-inner :global(.avatar) {
    --avatar-size: 5rem;
    --avatar-font-size: 1.625rem;
    --badge-size: 1rem;
    z-index: 1;
    position: relative;
  }

  /* Three concentric pulsing rings */
  .ical-ring {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    border: 2px solid var(--color-secondary, #4e87ff);
    opacity: 0;
    animation: ical-ring-pulse 2.4s ease-out infinite;
  }

  .ical-ring--1 { animation-delay: 0s;    }
  .ical-ring--2 { animation-delay: 0.8s;  }
  .ical-ring--3 { animation-delay: 1.6s;  }

  /* ── Call type badge ─────────────────────────────────────────
     Small pill icon above the name.                            */
  .ical-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.625rem;
    border-radius: var(--radius-full, 9999px);
    background: color-mix(in srgb, var(--color-secondary, #4e87ff) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-secondary, #4e87ff) 24%, transparent);
    color: var(--color-secondary, #4e87ff);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    margin-block-end: 0.125rem;
  }

  /* ── Name ────────────────────────────────────────────────────*/
  .ical-name {
    margin: 0;
    color: var(--color-text, #0f1923);
    font-family: var(--font-sans);
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  /* ── Description / status ────────────────────────────────────*/
  .ical-desc {
    margin: 0;
    color: var(--color-muted, #6b7280);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ical-room {
    color: var(--color-subtle, #9ca3af);
    font-size: 0.875rem;
  }

  .ical-connecting {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--color-secondary, #4e87ff);
    font-weight: 600;
  }

  /* ═══════════════════════════════════════════════════════════
     ACTION BUTTONS
     ═══════════════════════════════════════════════════════════ */
  .ical-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md, 1rem);
    inline-size: 100%;
  }

  /* Accept and Reject each take half the width */
  .ical-accept,
  .ical-reject {
    flex: 1;
    display: flex;
  }

  .ical-accept :global(.button),
  .ical-reject :global(.button) {
    inline-size: 100%;
    min-inline-size: unset;
  }

  /* Button inner layout: icon left of label */
  .ical-btn-content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  /* ── Keyboard hint ───────────────────────────────────────────*/
  .ical-hint {
    margin: 0;
    color: var(--color-subtle, #9ca3af);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 500;
    text-align: center;
  }

  /* ═══════════════════════════════════════════════════════════
     ANIMATIONS
     ═══════════════════════════════════════════════════════════ */
  @keyframes ical-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes ical-card-in {
    from {
      opacity: 0;
      transform: scale(0.91) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes ical-ring-pulse {
    0% {
      transform: scale(1);
      opacity: 0.55;
    }
    70% {
      transform: scale(2.1);
      opacity: 0;
    }
    100% {
      transform: scale(2.1);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ical-backdrop  { animation: none; }
    .ical-card      { animation: none; }
    .ical-ring      { animation: none; opacity: 0.2; }
  }

  /* ═══════════════════════════════════════════════════════════
     DARK THEME
     ═══════════════════════════════════════════════════════════ */
  :global([data-theme='dark']) .ical-backdrop {
    background: rgba(5, 8, 16, 0.65);
  }

  :global([data-theme='dark']) .ical-card {
    background: var(--color-surface, #161b22);
    border-color: var(--color-border, #30363d);
    box-shadow:
      var(--shadow-2xl, 0 25px 50px -12px rgba(0, 0, 0, .6)),
      0 0 0 1px rgba(255, 255, 255, 0.04);
  }
</style>
