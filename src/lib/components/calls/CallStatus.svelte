<script lang="ts" context="module">
  export type CallStatusVariant = 'success' | 'error' | 'info';
</script>

<script lang="ts">
  export let message = '';
  export let variant: CallStatusVariant = 'info';
</script>

{#if message}
  <div
    class="status"
    data-variant={variant}
    role={variant === 'error' ? 'alert' : 'status'}
    aria-live={variant === 'error' ? 'assertive' : 'polite'}
  >
    <span class="status-icon" aria-hidden="true">
      {#if variant === 'success'}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      {:else if variant === 'error'}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 5v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
        </svg>
      {:else}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 7v4M8 5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      {/if}
    </span>
    <span class="status-text">{message}</span>
  </div>
{/if}

<style lang="postcss">
  .status {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    border-radius: var(--radius-md);
    padding: 0.75rem 0.875rem;
    font-size: 0.875rem;
    line-height: 1.5;
    font-weight: 500;
    animation: status-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes status-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .status[data-variant='info'] {
    border: 1px solid rgba(78, 135, 255, 0.22);
    background: rgba(78, 135, 255, 0.06);
    color: var(--color-secondary);
  }

  .status[data-variant='success'] {
    border: 1px solid var(--color-success-border);
    background: var(--color-success-bg);
    color: var(--color-success);
  }

  .status[data-variant='error'] {
    border: 1px solid var(--color-error-border);
    background: var(--color-error-bg);
    color: var(--color-error);
  }

  .status-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    margin-block-start: 0.05rem;
    line-height: 0;
  }

  .status-text {
    color: var(--color-text-secondary);
  }

  .status[data-variant='error'] .status-text {
    color: var(--color-error);
  }
</style>
