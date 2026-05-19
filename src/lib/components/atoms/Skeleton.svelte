<script lang="ts" context="module">
  export type SkeletonVariant = 'contacts' | 'call-history';
</script>

<script lang="ts">
  export let variant: SkeletonVariant = 'contacts';
  export let rows = variant === 'contacts' ? 5 : 4;

  $: accessibleLabel = variant === 'contacts' ? 'Loading contacts' : 'Loading call history';
</script>

<div class="skeleton" data-variant={variant} aria-label={accessibleLabel} role="status">
  {#if variant === 'contacts'}
    {#each Array.from({ length: rows }) as _, index}
      <div class="contact-card" aria-hidden="true">
        <span class="avatar shimmer"></span>
        <span class="content">
          <span class="line contact-name shimmer"></span>
          <span class="line contact-meta shimmer" data-short={index % 2 === 0}></span>
        </span>
        <span class="status-dot shimmer"></span>
      </div>
    {/each}
  {:else}
    {#each Array.from({ length: rows }) as _, index}
      <article class="history-card" aria-hidden="true">
        <div class="history-topline">
          <span class="call-icon shimmer"></span>
          <span class="content">
            <span class="line history-title shimmer"></span>
            <span class="line history-detail shimmer" data-short={index % 2 === 1}></span>
          </span>
          <span class="history-badge shimmer"></span>
        </div>
        <div class="history-footer">
          <span class="line history-time shimmer"></span>
          <span class="line history-duration shimmer"></span>
        </div>
      </article>
    {/each}
  {/if}
</div>

<style lang="postcss">
  .skeleton {
    display: grid;
    gap: var(--space-md);
  }

  .skeleton[data-variant='contacts'] {
    gap: var(--space-sm);
  }

  .contact-card,
  .history-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    padding: var(--space-md);
  }

  .contact-card {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr) 0.75rem;
    align-items: center;
    gap: var(--space-md);
  }

  .history-card {
    display: grid;
    gap: var(--space-md);
  }

  .history-topline {
    display: grid;
    grid-template-columns: 2.25rem minmax(0, 1fr) 4rem;
    align-items: center;
    gap: var(--space-md);
  }

  .content,
  .history-footer {
    display: grid;
    gap: var(--space-sm);
  }

  .history-footer {
    grid-template-columns: minmax(6rem, 10rem) minmax(4rem, 7rem);
  }

  .avatar,
  .status-dot,
  .call-icon,
  .history-badge,
  .line {
    display: block;
  }

  .avatar,
  .status-dot,
  .call-icon,
  .history-badge,
  .line {
    border-radius: 999px;
  }

  .avatar {
    inline-size: 2.5rem;
    block-size: 2.5rem;
  }

  .status-dot {
    inline-size: 0.75rem;
    block-size: 0.75rem;
  }

  .call-icon {
    inline-size: 2.25rem;
    block-size: 2.25rem;
  }

  .history-badge {
    inline-size: 4rem;
    block-size: 1.25rem;
  }

  .line {
    block-size: 0.75rem;
  }

  .contact-name {
    inline-size: min(70%, 16rem);
  }

  .contact-meta {
    inline-size: min(52%, 12rem);
  }

  .contact-meta[data-short='true'] {
    inline-size: min(38%, 8rem);
  }

  .history-title {
    inline-size: min(68%, 18rem);
  }

  .history-detail {
    inline-size: min(46%, 12rem);
  }

  .history-detail[data-short='true'] {
    inline-size: min(34%, 9rem);
  }

  .history-time {
    inline-size: min(100%, 9rem);
  }

  .history-duration {
    inline-size: min(100%, 6rem);
  }

  .shimmer {
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-border) 70%, white) 0%,
        color-mix(in srgb, var(--color-border) 35%, white) 40%,
        color-mix(in srgb, var(--color-border) 70%, white) 80%
      );
    background-size: 220% 100%;
    animation: shimmer 1.35s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer {
      animation: none;
    }
  }

  @keyframes shimmer {
    to {
      background-position-x: -220%;
    }
  }
</style>
