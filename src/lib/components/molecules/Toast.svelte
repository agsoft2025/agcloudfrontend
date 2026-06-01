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
    --toast-accent: var(--color-secondary);
    --toast-background: var(--color-surface);
    --toast-border: var(--color-border);

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
    box-shadow: var(--shadow-3, 0 12px 30px rgb(23 32 38 / 14%));
    color: var(--color-text);
    pointer-events: auto;
  }

  .toast[data-variant='success'] {
    --toast-accent: #12b76a;
    --toast-border: #abefc6;
    --toast-background: #f6fef9;
  }

  .toast[data-variant='error'] {
    --toast-accent: #b42318;
    --toast-border: #fecdca;
    --toast-background: #fffbfa;
  }

  .toast[data-variant='info'] {
    --toast-accent: var(--color-secondary);
    --toast-border: color-mix(in srgb, var(--color-secondary) 28%, var(--color-border));
    --toast-background: color-mix(in srgb, var(--color-secondary) 7%, var(--color-surface));
  }

  .icon {
    inline-size: 0.75rem;
    block-size: 0.75rem;
    border-radius: 999px;
    background: var(--toast-accent);
  }

  p {
    margin: 0;
    color: var(--color-text);
    font-size: 0.925rem;
    font-weight: 700;
    line-height: 1.35;
  }

  .close {
    display: inline-grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    font-size: 1.35rem;
    line-height: 1;
    padding: 0;
  }

  .close:hover {
    background: color-mix(in srgb, var(--toast-accent) 10%, transparent);
    color: var(--color-text);
  }

  .close:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px var(--toast-background),
      0 0 0 5px color-mix(in srgb, var(--toast-accent) 26%, transparent);
  }

  @media (max-width: 640px) {
    .toast-region {
      inset-block-start: var(--space-md);
      inset-inline: var(--space-md);
      inline-size: auto;
    }
  }
</style>
