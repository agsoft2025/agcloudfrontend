<script lang="ts" context="module">
  import type { CallType } from '$lib/api/calls.api';
  export type { CallType };
</script>

<script lang="ts">
  export let value: CallType = 'video';
  export let disabled = false;
</script>

<div class="toggle" role="group" aria-label="Call type">
  <button
    type="button"
    class="option"
    class:active={value === 'video'}
    {disabled}
    aria-pressed={value === 'video'}
    on:click={() => (value = 'video')}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 10l5-3v10l-5-3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="2" y="6" width="11" height="12" rx="2" stroke="currentColor" stroke-width="1.75"/>
    </svg>
    Video
  </button>

  <button
    type="button"
    class="option"
    class:active={value === 'audio'}
    {disabled}
    aria-pressed={value === 'audio'}
    on:click={() => (value = 'audio')}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Audio
  </button>
</div>

<style lang="postcss">
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    padding: 2px;
  }

  .option {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: none;
    border-radius: calc(var(--radius-md) - 2px);
    background: transparent;
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.375rem 0.75rem;
    cursor: pointer;
    transition:
      background-color 140ms ease,
      color 140ms ease,
      box-shadow 140ms ease;
    white-space: nowrap;
  }

  .option:hover:not(:disabled) {
    background: rgba(30, 45, 74, 0.06);
    color: var(--color-text-secondary);
  }

  .option.active {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  .option:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
  }

  .option:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
