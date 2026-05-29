<script lang="ts">
  export let label: string;
  export let description = '';
  export let active = false;
  export let collapsed = false;
</script>

<button
  class="nav-item"
  class:active
  class:collapsed
  type="button"
  title={collapsed ? label : undefined}
  aria-current={active ? 'page' : undefined}
  on:click
>
  <span class="nav-icon" aria-hidden="true">
    <slot name="icon" />
  </span>

  {#if !collapsed}
    <span class="nav-copy">
      <span class="nav-label">{label}</span>
      {#if description}
        <small class="nav-desc">{description}</small>
      {/if}
    </span>
  {/if}
</button>

<style lang="postcss">
  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    inline-size: 100%;
    min-block-size: 2.5rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: rgba(255, 255, 255, 0.65);
    font-family: var(--font-sans);
    padding: 0.375rem 0.625rem;
    text-align: start;
    cursor: pointer;
    position: relative;
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }

  /* Active indicator bar */
  .nav-item::before {
    content: '';
    position: absolute;
    inset-block: 20% 20%;
    inset-inline-start: -8px;
    inline-size: 2.5px;
    border-radius: 999px;
    background: var(--color-secondary);
    opacity: 0;
    transform: scaleY(0.4);
    transition:
      opacity 160ms ease,
      transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.88);
  }

  .nav-item:focus-visible {
    outline: 2px solid rgba(78, 135, 255, 0.6);
    outline-offset: 1px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.88);
  }

  .nav-item.active {
    background: rgba(78, 135, 255, 0.14);
    color: rgba(255, 255, 255, 0.95);
  }

  .nav-item.active::before {
    opacity: 1;
    transform: scaleY(1);
  }

  /* Icon */
  .nav-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.375rem;
    block-size: 1.375rem;
    color: inherit;
    transition: color 140ms ease;
  }

  .nav-item.active .nav-icon {
    color: var(--color-secondary);
  }

  /* Collapsed: center icon */
  .nav-item.collapsed {
    justify-content: center;
    padding: 0.375rem;
  }

  .nav-item.collapsed .nav-icon {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

  /* Copy */
  .nav-copy {
    display: grid;
    gap: 0.1rem;
    min-inline-size: 0;
    overflow: hidden;
  }

  .nav-label {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-desc {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.42);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
