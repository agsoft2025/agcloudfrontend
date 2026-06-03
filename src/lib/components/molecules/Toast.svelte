<script lang="ts">
  import { toastStore } from '$lib/stores/toast.store';
</script>

{#if $toastStore.length > 0}
  <section class="toast-region" aria-label="Notifications" aria-live="polite">
    {#each $toastStore as toast (toast.id)}
      <article class="toast" data-variant={toast.variant} role="status">
        <span class="icon" aria-hidden="true"></span>
        <p>{toast.message}</p>
        <button
          class="close"
          type="button"
          aria-label="Dismiss notification"
          on:click={() => toastStore.dismiss(toast.id)}
        >
          ×
        </button>
      </article>
    {/each}
  </section>
{/if}

<style lang="postcss">
  .toast-region {
    position: fixed;
    z-index: 1000;
    inset-block-start: var(--space-lg);
    inset-inline-end: var(--space-lg);
    display: grid;
    gap: var(--space-sm);
    inline-size: min(24rem, calc(100vw - 2rem));
    pointer-events: none;
  }

  .toast {
    /* defaults — neutral */
    --toast-accent:     var(--color-secondary);
    --toast-background: var(--color-surface);
    --toast-border:     var(--color-border);

    display: grid;
    grid-template-columns: 0.75rem minmax(0, 1fr) 2rem;
    align-items: center;
    gap: var(--space-md);
    min-block-size: 3.25rem;
    margin: 0;
    padding: var(--space-md);
    border: 1px solid var(--toast-border);
    border-inline-start: 4px solid var(--toast-accent);
    border-radius: var(--radius-md);
    background: var(--toast-background);
    box-shadow: var(--shadow-lg);
    color: var(--color-text);
    pointer-events: auto;
    transition: background-color 200ms ease, border-color 200ms ease;
  }

  /* Semantic variants consume theme tokens */
  .toast[data-variant='success'] {
    --toast-accent:     var(--toast-success-accent);
    --toast-border:     var(--toast-success-border);
    --toast-background: var(--toast-success-bg);
  }

  .toast[data-variant='error'] {
    --toast-accent:     var(--toast-error-accent);
    --toast-border:     var(--toast-error-border);
    --toast-background: var(--toast-error-bg);
  }

  .toast[data-variant='warning'] {
    --toast-accent:     var(--toast-warning-accent);
    --toast-border:     var(--toast-warning-border);
    --toast-background: var(--toast-warning-bg);
  }

  .icon {
    display: block;
    inline-size: 0.75rem;
    block-size: 0.75rem;
    border-radius: 999px;
    background: var(--toast-accent);
    flex-shrink: 0;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
    color: var(--color-text);
  }

  .close {
    display: grid;
    place-items: center;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-muted);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
  }

  .close:hover {
    background: var(--color-border);
    color: var(--color-text);
  }

  .close:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
