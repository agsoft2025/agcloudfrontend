<script lang="ts">
  export let roomId: string;

  let copied = false;
  let copyFailed = false;
  let resetTimeout: ReturnType<typeof setTimeout> | null = null;

  async function copyToClipboard() {
    if (resetTimeout) clearTimeout(resetTimeout);
    copyFailed = false;

    try {
      await navigator.clipboard.writeText(roomId);
      copied = true;
      resetTimeout = setTimeout(() => {
        copied = false;
        resetTimeout = null;
      }, 2200);
    } catch {
      copyFailed = true;
      resetTimeout = setTimeout(() => {
        copyFailed = false;
        resetTimeout = null;
      }, 2200);
    }
  }
</script>

<div class="room-chip" title="Room ID: {roomId}">
  <!-- Room icon -->
  <span class="room-icon" aria-hidden="true">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 4V3a3 3 0 016 0v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </span>

  <!-- ID text -->
  <span class="room-id" aria-label="Room ID: {roomId}">{roomId}</span>

  <!-- Copy button -->
  <button
    type="button"
    class="copy-btn"
    class:copied
    class:failed={copyFailed}
    aria-label={copied ? 'Copied to clipboard' : 'Copy room ID'}
    on:click={copyToClipboard}
  >
    {#if copied}
      <!-- Checkmark -->
      <svg class="icon-check" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    {:else if copyFailed}
      <!-- X mark -->
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
    {:else}
      <!-- Copy icon -->
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    {/if}
  </button>

  <!-- Tooltip feedback -->
  {#if copied || copyFailed}
    <span
      class="copy-toast"
      class:toast-ok={copied}
      class:toast-err={copyFailed}
      role="status"
      aria-live="polite"
    >
      {copied ? 'Copied!' : 'Failed'}
    </span>
  {/if}
</div>

<style lang="postcss">
  .room-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.07);
    padding: 0.3125rem 0.25rem 0.3125rem 0.625rem;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.8125rem;
    font-family: var(--font-sans);
    backdrop-filter: blur(8px);
    transition: background-color 160ms ease, border-color 160ms ease;
  }

  .room-chip:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.1);
  }

  .room-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.45);
    line-height: 0;
  }

  .room-id {
    font-weight: 600;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-inline-size: 16rem;
    color: rgba(255, 255, 255, 0.88);
  }

  .copy-btn {
    display: grid;
    place-items: center;
    inline-size: 1.625rem;
    block-size: 1.625rem;
    border: none;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition:
      background-color 140ms ease,
      color 140ms ease,
      transform 120ms ease;
    line-height: 0;
    margin-bottom: 0;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.9);
    transform: scale(1.08);
  }

  .copy-btn:focus-visible {
    outline: 2px solid rgba(78, 135, 255, 0.7);
    outline-offset: 1px;
  }

  .copy-btn.copied {
    background: rgba(52, 211, 153, 0.18);
    color: #34d399;
  }

  .copy-btn.failed {
    background: rgba(220, 38, 38, 0.18);
    color: #f87171;
  }

  /* Checkmark draw animation */
  .icon-check path {
    stroke-dasharray: 15;
    stroke-dashoffset: 15;
    animation: draw-check 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes draw-check {
    to { stroke-dashoffset: 0; }
  }

  /* Toast bubble */
  .copy-toast {
    position: absolute;
    inset-block-end: calc(100% + 8px);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    border-radius: var(--radius-md);
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
    pointer-events: none;
    animation: toast-pop 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .toast-ok {
    background: rgba(52, 211, 153, 0.9);
    color: #064e3b;
  }

  .toast-err {
    background: rgba(248, 113, 113, 0.9);
    color: #7f1d1d;
  }

  @keyframes toast-pop {
    from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.92); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }

  @media (max-width: 480px) {
    .room-id {
      max-inline-size: 8rem;
    }
  }
</style>
