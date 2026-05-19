<script lang="ts" context="module">
  export type SpinnerSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
  export let size: SpinnerSize = 'md';
  export let label = 'Loading';
  export let decorative = false;
</script>

<span
  class="spinner"
  data-size={size}
  aria-hidden={decorative}
  aria-label={decorative ? undefined : label}
  role={decorative ? undefined : 'status'}
>
  <span class="track"></span>
</span>

<style lang="postcss">
  .spinner {
    --spinner-size: 1.25rem;
    --spinner-stroke: 2px;

    display: inline-grid;
    place-items: center;
    inline-size: var(--spinner-size);
    block-size: var(--spinner-size);
    color: currentColor;
  }

  .spinner[data-size='sm'] {
    --spinner-size: 1rem;
    --spinner-stroke: 2px;
  }

  .spinner[data-size='lg'] {
    --spinner-size: 2.5rem;
    --spinner-stroke: 3px;
  }

  .track {
    inline-size: 100%;
    block-size: 100%;
    border: var(--spinner-stroke) solid color-mix(in srgb, currentColor 24%, transparent);
    border-block-start-color: currentColor;
    border-radius: 999px;
    animation: spin 700ms linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .track {
      animation-duration: 1.4s;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
