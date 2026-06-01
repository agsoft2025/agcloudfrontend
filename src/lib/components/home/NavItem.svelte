<script lang="ts">
  export let label: string;
  export let description = '';
  export let active = false;
</script>

<button
  class="nav-item"
  class:active
  type="button"
  aria-current={active ? 'page' : undefined}
  on:click
>
  <span class="nav-icon" aria-hidden="true">
    <slot name="icon" />
  </span>

  <span class="nav-copy">
    <span class="nav-label">{label}</span>
    {#if description}
      <small class="nav-desc">{description}</small>
    {/if}
  </span>

  {#if active}
    <span class="nav-active-dot" aria-hidden="true"></span>
  {/if}
</button>

<style lang="postcss">
  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    inline-size: 100%;
    min-block-size: 3.25rem;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-family: var(--font-sans);
    padding: 0.625rem 0.75rem;
    text-align: start;
    cursor: pointer;
    position: relative;
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.92);
  }

  .nav-item:focus-visible {
    outline: 2px solid rgba(78, 135, 255, 0.65);
    outline-offset: 2px;
  }

  .nav-item.active {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .nav-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    color: rgba(255, 255, 255, 0.55);
    transition: color 140ms ease;
  }

  .nav-item.active .nav-icon {
    color: var(--color-secondary);
  }

  .nav-copy {
    display: grid;
    gap: 0.15rem;
    flex: 1;
    min-inline-size: 0;
    text-align: start;
  }

  .nav-label {
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.25;
    color: inherit;
  }

  .nav-desc {
    font-size: 0.75rem;
    font-weight: 400;
    color: #9ca3af;
    line-height: 1.3;
  }

  .nav-active-dot {
    flex-shrink: 0;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 999px;
    background: var(--color-secondary);
    box-shadow: 0 0 0 3px rgba(78, 135, 255, 0.22);
  }
</style>
