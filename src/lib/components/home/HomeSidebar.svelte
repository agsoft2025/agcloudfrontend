<script lang="ts" context="module">
  export type HomeSection = 'one-to-one';

  export interface HomeSidebarItem {
    id: HomeSection;
    label: string;
    description: string;
  }
</script>

<script lang="ts">
  export let items: HomeSidebarItem[] = [];
  export let selected: HomeSection;
</script>

<aside class="sidebar" aria-label="Call menu">
  <div class="sidebar-backdrop" aria-hidden="true">
    <span class="orbit orbit-a"></span>
    <span class="orbit orbit-b"></span>
    <span class="route route-a"></span>
    <span class="route route-b"></span>
  </div>

  <div class="sidebar-content">
    <div class="brand">
      <span class="mark" aria-hidden="true">AG</span>
      <div>
        <p class="eyebrow">AG Cloud</p>
        <h1>Calls</h1>
      </div>
    </div>

    <div class="sidebar-summary" aria-label="Workspace summary">
      <span class="summary-kicker">Live workspace</span>
      <strong>Secure call control</strong>
      <small>Start, accept, and close AG Cloud calls from one focused console.</small>
    </div>

    <nav class="menu" aria-label="Call types">
      {#each items as item}
        <button
          class="menu-item"
          class:is-active={selected === item.id}
          type="button"
          aria-current={selected === item.id ? 'page' : undefined}
          on:click={() => (selected = item.id)}
        >
          <span class="menu-icon" aria-hidden="true">
            <span></span>
          </span>
          <span class="menu-copy">
            <span>{item.label}</span>
            <small>{item.description}</small>
          </span>
        </button>
      {/each}
    </nav>

    <div class="signal-card" aria-label="Connection status">
      <span class="pulse" aria-hidden="true"></span>
      <div>
        <strong>Ready</strong>
        <small>Audio and video setup available</small>
      </div>
    </div>
  </div>
</aside>

<style lang="postcss">
  .sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    min-block-size: 100%;
    overflow: hidden;
    border-inline-end: 1px solid rgb(255 255 255 / 16%);
    background: linear-gradient(160deg, #20324f 0%, #245366 50%, #2c6e63 100%);
    color: var(--color-surface);
    padding: var(--space-lg);
  }

  .sidebar-backdrop {
    position: absolute;
    inset: 0;
    opacity: 0.9;
    pointer-events: none;
  }

  .sidebar-backdrop::before {
    content: '';
    position: absolute;
    inset: auto -7rem -6rem 2rem;
    block-size: 16rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-secondary) 28%, transparent);
    filter: blur(32px);
  }

  .orbit,
  .route {
    position: absolute;
    display: block;
  }

  .orbit {
    border: 1px solid rgb(255 255 255 / 22%);
    border-radius: 999px;
  }

  .orbit::after {
    content: '';
    position: absolute;
    inline-size: 0.65rem;
    block-size: 0.65rem;
    border-radius: inherit;
    background: #ffffff;
    box-shadow: 0 0 1rem rgb(255 255 255 / 60%);
  }

  .orbit-a {
    inline-size: 11rem;
    block-size: 11rem;
    inset-block-start: 5.2rem;
    inset-inline-end: -4.5rem;
  }

  .orbit-a::after {
    inset-block-start: 2.1rem;
    inset-inline-start: 1.3rem;
  }

  .orbit-b {
    inline-size: 7rem;
    block-size: 7rem;
    inset-block-start: 15.5rem;
    inset-inline-start: -2.8rem;
  }

  .orbit-b::after {
    inset-block-end: 1rem;
    inset-inline-end: 1.25rem;
  }

  .route {
    block-size: 2px;
    background: linear-gradient(90deg, transparent, rgb(255 255 255 / 44%), transparent);
    transform-origin: left center;
  }

  .route-a {
    inline-size: 78%;
    inset-block-start: 13rem;
    inset-inline-start: 2.2rem;
    transform: rotate(21deg);
  }

  .route-b {
    inline-size: 62%;
    inset-block-start: 19rem;
    inset-inline-start: 1.5rem;
    transform: rotate(-18deg);
  }

  .sidebar-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .brand {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr);
    align-items: center;
    gap: var(--space-md);
  }

  .mark {
    display: inline-grid;
    place-items: center;
    inline-size: 3rem;
    block-size: 3rem;
    border: 1px solid rgb(255 255 255 / 30%);
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 14%);
    color: var(--color-surface);
    font-size: 0.85rem;
    font-weight: 900;
    box-shadow: inset 0 0 1.5rem rgb(255 255 255 / 8%);
  }

  .eyebrow,
  h1,
  .sidebar-summary strong,
  .sidebar-summary small,
  .sidebar-summary .summary-kicker,
  .signal-card strong,
  .signal-card small {
    margin: 0;
  }

  .eyebrow {
    color: rgb(255 255 255 / 68%);
    font-size: 0.75rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    color: var(--color-surface);
    font-size: 1.35rem;
    line-height: 1.2;
  }

  .sidebar-summary {
    display: grid;
    gap: var(--space-sm);
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 12%);
    padding: var(--space-md);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 14%);
  }

  .summary-kicker {
    color: rgb(255 255 255 / 62%);
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  .sidebar-summary strong {
    color: #ffffff;
    font-size: 1.15rem;
    line-height: 1.25;
  }

  .sidebar-summary small {
    color: rgb(255 255 255 / 72%);
    line-height: 1.45;
  }

  .menu {
    display: grid;
    gap: var(--space-sm);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    inline-size: 100%;
    min-block-size: 4.75rem;
    border: 1px solid rgb(255 255 255 / 16%);
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 8%);
    color: var(--color-surface);
    font-family: var(--font-sans);
    padding: var(--space-md);
    text-align: start;
    cursor: pointer;
    backdrop-filter: blur(10px);
    transition:
      border-color 160ms ease,
      background-color 160ms ease,
      box-shadow 160ms ease,
      transform 160ms ease;
  }

  .menu-item:hover,
  .menu-item:focus-visible,
  .menu-item.is-active {
    border-color: rgb(255 255 255 / 42%);
    background: rgb(255 255 255 / 18%);
    box-shadow: 0 1rem 2.2rem rgb(9 18 30 / 18%);
    outline: none;
  }

  .menu-item:hover {
    transform: translateY(-1px);
  }

  .menu-icon {
    position: relative;
    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    inline-size: 2.35rem;
    block-size: 2.35rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 14%);
  }

  .menu-icon::before,
  .menu-icon::after,
  .menu-icon span {
    content: '';
    position: absolute;
    border-radius: 999px;
    background: #ffffff;
  }

  .menu-icon::before {
    inline-size: 0.65rem;
    block-size: 0.65rem;
    inset-inline-start: 0.65rem;
  }

  .menu-icon::after {
    inline-size: 0.65rem;
    block-size: 0.65rem;
    inset-inline-end: 0.65rem;
  }

  .menu-icon span {
    inline-size: 1rem;
    block-size: 2px;
    opacity: 0.78;
  }

  .menu-copy {
    display: grid;
    gap: 0.2rem;
  }

  .menu-copy span {
    font-weight: 900;
  }

  .menu-copy small {
    color: rgb(255 255 255 / 68%);
    font-size: 0.82rem;
    line-height: 1.35;
  }

  .signal-card {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-block-start: auto;
    border: 1px solid rgb(255 255 255 / 16%);
    border-radius: var(--radius-md);
    background: rgb(255 255 255 / 10%);
    padding: var(--space-md);
  }

  .pulse {
    position: relative;
    flex: 0 0 auto;
    inline-size: 0.75rem;
    block-size: 0.75rem;
    border-radius: 999px;
    background: #7df2bd;
    box-shadow: 0 0 0 0 rgb(125 242 189 / 56%);
    animation: pulse 1.8s ease-out infinite;
  }

  .signal-card div {
    display: grid;
    gap: 0.15rem;
  }

  .signal-card strong {
    color: #ffffff;
    font-size: 0.95rem;
  }

  .signal-card small {
    color: rgb(255 255 255 / 66%);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  @keyframes pulse {
    70% {
      box-shadow: 0 0 0 0.55rem rgb(125 242 189 / 0%);
    }

    100% {
      box-shadow: 0 0 0 0 rgb(125 242 189 / 0%);
    }
  }

  @media (max-width: 760px) {
    .sidebar {
      min-block-size: auto;
      border-inline-end: 0;
      border-block-end: 1px solid rgb(255 255 255 / 16%);
      padding: var(--space-md);
    }

    .sidebar-content {
      gap: var(--space-md);
    }

    .menu {
      grid-template-columns: 1fr;
    }

    .sidebar-summary {
      display: none;
    }

    .signal-card {
      margin-block-start: 0;
    }
  }

  @media (max-width: 520px) {
    .menu {
      grid-template-columns: 1fr;
    }
  }
</style>
