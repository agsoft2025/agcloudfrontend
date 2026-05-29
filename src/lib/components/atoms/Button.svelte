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
  export let fullWidth = false;
  export let ariaLabel: string | undefined = undefined;

  $: isDisabled = disabled || loading;
</script>

<button
  class="button"
  class:is-loading={loading}
  class:full-width={fullWidth}
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
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    min-inline-size: max-content;
    border: 1.5px solid var(--btn-border, var(--color-primary));
    border-radius: var(--radius-md);
    background: var(--btn-bg, var(--color-primary));
    color: var(--btn-color, #ffffff);
    font-family: var(--font-sans);
    font-weight: 700;
    line-height: 1;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    user-select: none;
    box-shadow: var(--btn-shadow, 0 1px 2px rgba(0,0,0,0.08));
    transition:
      background-color 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 120ms ease,
      opacity 180ms ease;
  }

  .button:hover:not(:disabled) {
    box-shadow: var(--btn-shadow-hover, 0 4px 12px rgba(0,0,0,0.15));
    transform: translateY(-1px);
  }

  .button:active:not(:disabled) {
    transform: translateY(0);
  }

  .button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px #ffffff,
      0 0 0 4px var(--btn-ring, rgba(30,45,74,0.28));
  }

  .button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    transform: none;
    box-shadow: none;
  }

  /* Sizes */
  .button[data-size='sm'] {
    min-block-size: 2rem;
    padding: 0 var(--space-md);
    font-size: 0.8125rem;
    border-radius: var(--radius-sm);
  }

  .button[data-size='md'] {
    min-block-size: 2.5rem;
    padding: 0 var(--space-lg);
    font-size: 0.9375rem;
  }

  .button[data-size='lg'] {
    min-block-size: 3rem;
    padding: 0 calc(var(--space-lg) + var(--space-sm));
    font-size: 1rem;
    letter-spacing: -0.01em;
  }

  .full-width {
    inline-size: 100%;
    min-inline-size: unset;
  }

  /* Primary */
  .button[data-variant='primary'] {
    --btn-bg: #1e2d4a;
    --btn-border: #1e2d4a;
    --btn-ring: rgba(30,45,74,0.28);
    --btn-shadow: 0 2px 4px rgba(30,45,74,0.22), 0 1px 2px rgba(0,0,0,0.1);
    --btn-shadow-hover: 0 6px 16px rgba(30,45,74,0.32);
    background: linear-gradient(135deg, #1e2d4a 0%, #2a3d66 100%);
  }

  .button[data-variant='primary']:hover:not(:disabled) {
    background: linear-gradient(135deg, #162238 0%, #1e2d4a 100%);
    border-color: #162238;
  }

  /* Secondary */
  .button[data-variant='secondary'] {
    --btn-bg: var(--color-secondary);
    --btn-border: var(--color-secondary);
    --btn-ring: rgba(78,135,255,0.28);
    --btn-shadow: 0 2px 4px rgba(78,135,255,0.2);
    --btn-shadow-hover: 0 6px 16px rgba(78,135,255,0.32);
    background: var(--color-secondary);
  }

  .button[data-variant='secondary']:hover:not(:disabled) {
    background: var(--color-secondary-hover);
    border-color: var(--color-secondary-hover);
  }

  /* Ghost */
  .button[data-variant='ghost'] {
    --btn-bg: transparent;
    --btn-border: var(--color-border);
    --btn-color: var(--color-primary);
    --btn-ring: rgba(30,45,74,0.2);
    --btn-shadow: none;
    --btn-shadow-hover: 0 2px 6px rgba(0,0,0,0.08);
    background: transparent;
  }

  .button[data-variant='ghost']:hover:not(:disabled) {
    background: rgba(30, 45, 74, 0.06);
    border-color: var(--color-border-strong);
  }

  /* Danger */
  .button[data-variant='danger'] {
    --btn-bg: var(--color-error);
    --btn-border: var(--color-error);
    --btn-ring: rgba(220,38,38,0.25);
    --btn-shadow: 0 2px 4px rgba(220,38,38,0.2);
    --btn-shadow-hover: 0 6px 16px rgba(220,38,38,0.28);
    background: var(--color-error);
  }

  .button[data-variant='danger']:hover:not(:disabled) {
    background: #b91c1c;
    border-color: #b91c1c;
  }

  .is-loading { pointer-events: none; }
  .label-hidden { visibility: hidden; }

  .spinner {
    position: absolute;
    inline-size: 1.1em;
    block-size: 1.1em;
    border: 2px solid currentColor;
    border-block-start-color: transparent;
    border-radius: 999px;
    animation: spin 650ms linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
