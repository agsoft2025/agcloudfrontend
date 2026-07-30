<script lang="ts">
  import { themeStore } from '$lib/stores/theme.store';

  export let size: 'sm' | 'md' = 'md';

  // themeStore.resolved is a derived Svelte store — subscribe with $
  const resolved = themeStore.resolved;
  $: isDark = $resolved === 'dark';
</script>

<button
  class="theme-toggle"
  data-size={size}
  type="button"
  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  on:click={themeStore.toggle}
>
  {#if isDark}
    <!-- Sun icon -->
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  {:else}
    <!-- Moon icon -->
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  {/if}
</button>

<style lang="postcss">
  .theme-toggle {
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    color: var(--color-muted);
    cursor: pointer;
    transition:
      background-color 180ms ease,
      color 180ms ease,
      border-color 180ms ease;
  }

  .theme-toggle[data-size='md'] {
    inline-size: 2rem;
    block-size: 2rem;
  }

  .theme-toggle[data-size='sm'] {
    inline-size: 1.625rem;
    block-size: 1.625rem;
  }

  .theme-toggle:hover {
    background: var(--color-border);
    color: var(--color-text);
    border-color: var(--color-border-strong);
  }

  .theme-toggle:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
