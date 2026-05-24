<script lang="ts" context="module">
  export type CallStatusVariant = 'success' | 'error' | 'info';
</script>

<script lang="ts">
  export let message = '';
  export let variant: CallStatusVariant = 'info';
</script>

{#if message}
  <p class="status" data-variant={variant} role={variant === 'error' ? 'alert' : 'status'}>
    {message}
  </p>
{/if}

<style lang="postcss">
  .status {
    --status-accent: var(--color-secondary);
    --status-background: color-mix(in srgb, var(--color-secondary) 7%, var(--color-surface));
    --status-border: color-mix(in srgb, var(--color-secondary) 28%, var(--color-border));

    margin: 0;
    border: 1px solid var(--status-border);
    border-inline-start: 4px solid var(--status-accent);
    border-radius: var(--radius-md);
    background: var(--status-background);
    color: var(--color-text);
    padding: var(--space-md);
    line-height: 1.45;
  }

  .status[data-variant='success'] {
    --status-accent: #12b76a;
    --status-border: #abefc6;
    --status-background: #f6fef9;
  }

  .status[data-variant='error'] {
    --status-accent: #b42318;
    --status-border: #fecdca;
    --status-background: #fffbfa;
  }
</style>
