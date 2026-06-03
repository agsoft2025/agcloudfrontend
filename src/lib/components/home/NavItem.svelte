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
    isolation: isolate;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    inline-size: 100%;
    min-block-size: 3.25rem;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--sidebar-text);
    font-family: var(--font-sans);
    padding: 0.625rem 0.75rem;
    text-align: start;
    cursor: pointer;
    position: relative;
    transition:
      background-color 140ms ease,
      color 140ms ease,
      transform 140ms ease,
      box-shadow 180ms ease;
  }

  .nav-item::before,
  .nav-item::after {
    content: '';
    position: absolute;
    pointer-events: none;
    opacity: 0;
    transition: opacity 180ms ease;
  }

  .nav-item::before {
    inset-block: 0.55rem;
    inset-inline-start: 0;
    inline-size: 3px;
    border-radius: 0 999px 999px 0;
    background: linear-gradient(180deg, var(--sidebar-accent) 0%, var(--color-secondary) 100%);
    box-shadow: 0 0 14px var(--sidebar-accent-glow);
  }

  .nav-item::after {
    inset: 0;
    z-index: -1;
    background:
      radial-gradient(circle at 16% 18%, var(--sidebar-accent-glow), transparent 34%),
      linear-gradient(135deg, var(--sidebar-hover-bg), var(--sidebar-active-sheen));
  }

  .nav-item:hover {
    background: var(--sidebar-hover-bg);
    color: var(--sidebar-text-active);
    transform: translateX(2px);
  }

  .nav-item:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .nav-item.active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-text-active);
    box-shadow:
      inset 0 0 0 1px var(--sidebar-active-border),
      var(--shadow-sm);
  }

  .nav-item.active::before,
  .nav-item.active::after {
    opacity: 1;
  }

  .nav-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    color: var(--sidebar-icon-color);
    border-radius: 8px;
    transition:
      background-color 140ms ease,
      color 140ms ease,
      transform 140ms ease;
  }

  .nav-item.active .nav-icon {
    color: var(--sidebar-icon-active);
    transform: scale(1.04);
  }

  .nav-item.active .nav-desc {
    color: var(--sidebar-muted);
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
    color: var(--sidebar-muted);
    line-height: 1.3;
  }

  .nav-active-dot {
    flex-shrink: 0;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 999px;
    background: var(--sidebar-accent);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--sidebar-accent) 16%, transparent),
      0 0 16px var(--sidebar-accent-glow);
  }
</style>
