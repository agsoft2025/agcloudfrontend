<script lang="ts" context="module">
  export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  export type BadgeSize = 'sm' | 'md';
</script>

<script lang="ts">
  export let variant: BadgeVariant = 'neutral';
  export let size: BadgeSize = 'md';
  export let count: number | undefined = undefined;
  export let max = 99;
  export let dot = false;
  export let label: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;

  $: hasCount = typeof count === 'number';
  $: displayValue = typeof count === 'number' ? (count > max ? `${max}+` : count.toString()) : undefined;
  $: visibleLabel = label ?? displayValue;
  $: accessibleLabel =
    ariaLabel ??
    (hasCount ? `${count} notification${count === 1 ? '' : 's'}` : visibleLabel);
</script>

<span
  class="badge"
  class:is-dot={dot}
  data-variant={variant}
  data-size={size}
  aria-label={accessibleLabel}
>
  {#if !dot}
    {visibleLabel}
  {/if}
</span>

<style lang="postcss">
  .badge {
    --badge-background: var(--color-border);
    --badge-color: var(--color-text);
    --badge-border: transparent;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: 1.5rem;
    max-inline-size: 100%;
    min-block-size: 1.5rem;
    border: 1px solid var(--badge-border);
    border-radius: 999px;
    background: var(--badge-background);
    color: var(--badge-color);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 800;
    line-height: 1;
    padding: 0 var(--space-sm);
    white-space: nowrap;
  }

  .badge[data-size='sm'] {
    min-inline-size: 1.25rem;
    min-block-size: 1.25rem;
    font-size: 0.6875rem;
    padding: 0 0.4rem;
  }

  .badge[data-variant='primary'] {
    --badge-background: color-mix(in srgb, var(--color-primary) 12%, white);
    --badge-color: var(--color-primary);
    --badge-border: color-mix(in srgb, var(--color-primary) 22%, transparent);
  }

  .badge[data-variant='success'] {
    --badge-background: #dcfae6;
    --badge-color: #067647;
    --badge-border: #abefc6;
  }

  .badge[data-variant='warning'] {
    --badge-background: #fef0c7;
    --badge-color: #b54708;
    --badge-border: #fedf89;
  }

  .badge[data-variant='danger'] {
    --badge-background: #fee4e2;
    --badge-color: #b42318;
    --badge-border: #fecdca;
  }

  .badge[data-variant='info'] {
    --badge-background: color-mix(in srgb, var(--color-secondary) 14%, white);
    --badge-color: #175cd3;
    --badge-border: color-mix(in srgb, var(--color-secondary) 28%, transparent);
  }

  .badge.is-dot {
    inline-size: 0.625rem;
    min-inline-size: 0.625rem;
    block-size: 0.625rem;
    min-block-size: 0.625rem;
    border: 0;
    padding: 0;
  }

  .badge.is-dot[data-size='md'] {
    inline-size: 0.75rem;
    min-inline-size: 0.75rem;
    block-size: 0.75rem;
    min-block-size: 0.75rem;
  }
</style>
