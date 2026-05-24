<script lang="ts" context="module">
  export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
  export type ButtonSize = 'sm' | 'md' | 'lg';
  export type ButtonType = 'button' | 'submit' | 'reset';
</script>

<script lang="ts">
  export let variant: ButtonVariant = 'primary';
  export let size: ButtonSize = 'md';
  export let type: ButtonType = 'button';
  export let loading = false;
  export let disabled = false;
  export let ariaLabel: string | undefined = undefined;

  $: isDisabled = disabled || loading;
</script>

<button
  class="button"
  class:is-loading={loading}
  data-variant={variant}
  data-size={size}
  {type}
  disabled={isDisabled}
  aria-disabled={isDisabled}
  aria-label={ariaLabel}
  on:click
  on:focus
  on:blur
  on:keydown
>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
  {/if}

  <span class:label-hidden={loading}>
    <slot />
  </span>
</button>

<style lang="postcss">
  .button {
    --button-background: var(--color-primary);
    --button-border: var(--color-primary);
    --button-color: var(--color-surface);
    --button-hover-background: color-mix(in srgb, var(--button-background) 90%, black);
    --button-focus-ring: color-mix(in srgb, var(--button-background) 28%, transparent);

    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    min-inline-size: max-content;
    border: 1px solid var(--button-border);
    border-radius: var(--radius-md);
    background: var(--button-background);
    color: var(--button-color);
    font-family: var(--font-sans);
    font-weight: 700;
    line-height: 1;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    user-select: none;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      box-shadow 160ms ease,
      transform 160ms ease;
  }

  .button:hover:not(:disabled) {
    background: var(--button-hover-background);
    border-color: var(--button-hover-background);
  }

  .button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px var(--color-background),
      0 0 0 5px var(--button-focus-ring);
  }

  .button:disabled {
    cursor: not-allowed;
    opacity: 0.62;
    transform: none;
  }

  .button[data-size='sm'] {
    min-block-size: 2rem;
    padding: 0 var(--space-md);
    font-size: 0.875rem;
  }

  .button[data-size='md'] {
    min-block-size: 2.5rem;
    padding: 0 var(--space-lg);
    font-size: 0.95rem;
  }

  .button[data-size='lg'] {
    min-block-size: 3rem;
    padding: 0 calc(var(--space-lg) + var(--space-sm));
    font-size: 1rem;
  }

  .button[data-variant='secondary'] {
    --button-background: var(--color-secondary);
    --button-border: var(--color-secondary);
    --button-color: var(--color-surface);
  }

  .button[data-variant='ghost'] {
    --button-background: transparent;
    --button-border: var(--color-border);
    --button-color: var(--color-primary);
    --button-hover-background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    --button-focus-ring: color-mix(in srgb, var(--color-primary) 24%, transparent);
  }

  .button[data-variant='danger'] {
    --button-background: #b42318;
    --button-border: #b42318;
    --button-color: var(--color-surface);
  }

  .is-loading {
    pointer-events: none;
  }

  .label-hidden {
    visibility: hidden;
  }

  .spinner {
    position: absolute;
    inline-size: 1em;
    block-size: 1em;
    border: 2px solid currentColor;
    border-block-start-color: transparent;
    border-radius: 999px;
    animation: spin 700ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
