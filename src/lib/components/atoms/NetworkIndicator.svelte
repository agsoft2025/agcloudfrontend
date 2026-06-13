<!--
  NetworkIndicator - animated signal-bar network quality indicator
  Svelte 5 atom. Pure display: takes a quality prop, renders bars.
  Does not subscribe to any store or touch LiveKit APIs.

  Placement:
    VideoTile overlay    -> size="sm" (no label)
    ParticipantList row  -> size="sm" (no label)
    CallControls area    -> size="md" (optional label)
    Call header          -> size="lg" (with label)

  Bar layout (md, 16px height):
    Bar 1-4 active  -> excellent  (green)
    Bar 1-3 active  -> good       (blue)
    Bar 1-2 active  -> fair       (amber)
    Bar 1   active  -> poor       (red)
    No bars active  -> disconnected (all dim)
    Pulsing bars    -> undefined  (loading)

  Accessibility:
    role="img" + aria-label="Network quality: {state}" on root.
    aria-live="polite" on label announces quality changes to AT.
-->
<script lang="ts">
  import type { IndicatorQuality } from './NetworkIndicator.types.ts';

  // Runtime maps (kept here so types file stays type-only)
  const ACTIVE_BARS: Record<IndicatorQuality, number> = {
    excellent:    4,
    good:         3,
    fair:         2,
    poor:         1,
    disconnected: 0,
  };

  const QUALITY_LABEL: Record<IndicatorQuality, string> = {
    excellent:    'Excellent',
    good:         'Good',
    fair:         'Fair',
    poor:         'Poor',
    disconnected: 'Disconnected',
  };

  type Props = {
    /** Current quality. undefined = not yet received, shows loading pulse. */
    quality?: IndicatorQuality;
    /** Show text label alongside bars. Default false. */
    showLabel?: boolean;
    /** Visual size controlling bar dimensions and label font. */
    size?: 'sm' | 'md' | 'lg';
    /** Extra class forwarded to root element. */
    class?: string;
  };

  let {
    quality,
    showLabel = false,
    size = 'md',
    class: extraClass = '',
  }: Props = $props();

  const activeBars = $derived(quality !== undefined ? ACTIVE_BARS[quality] : 0);
  const labelText  = $derived(quality !== undefined ? QUALITY_LABEL[quality] : 'Unknown');
  const isUnknown  = $derived(quality === undefined);
  const ariaLabel  = $derived(`Network quality: ${labelText.toLowerCase()}`);
  const qualityAttr = $derived(quality ?? 'unknown');
</script>

<span
  class="ni {extraClass}"
  data-size={size}
  data-quality={qualityAttr}
  class:ni-unknown={isUnknown}
  role="img"
  aria-label={ariaLabel}
>
  <span class="ni-bars" aria-hidden="true">
    <span class="ni-bar ni-bar--1" class:is-active={activeBars >= 1}></span>
    <span class="ni-bar ni-bar--2" class:is-active={activeBars >= 2}></span>
    <span class="ni-bar ni-bar--3" class:is-active={activeBars >= 3}></span>
    <span class="ni-bar ni-bar--4" class:is-active={activeBars >= 4}></span>
  </span>

  {#if showLabel}
    <span class="ni-label" aria-live="polite" aria-atomic="true">
      {labelText}
    </span>
  {/if}
</span>

<style lang="postcss">
  /* --- Design tokens --- */
  .ni {
    --ni-color-excellent:   #34d399;
    --ni-color-good:        #4e87ff;
    --ni-color-fair:        #f59e0b;
    --ni-color-poor:        #ef4444;
    --ni-color-inactive:    color-mix(in srgb, currentColor 22%, transparent);
    --ni-active-color:      var(--ni-color-inactive);

    /* Size tokens - overridden per data-size */
    --ni-bar-width:         3px;
    --ni-max-height:        16px;
    --ni-gap:               2px;
    --ni-label-size:        0.75rem;
    --ni-label-gap:         0.375rem;

    display: inline-flex;
    align-items: center;
    gap: var(--ni-label-gap);
    line-height: 1;
    color: var(--color-muted, #6b7280);
    font-family: var(--font-sans);
  }

  /* Quality -> active bar colour */
  .ni[data-quality='excellent'] { --ni-active-color: var(--ni-color-excellent); }
  .ni[data-quality='good']      { --ni-active-color: var(--ni-color-good);      }
  .ni[data-quality='fair']      { --ni-active-color: var(--ni-color-fair);      }
  .ni[data-quality='poor']      { --ni-active-color: var(--ni-color-poor);      }

  /* Sizes */
  .ni[data-size='sm'] {
    --ni-bar-width:   2.5px;
    --ni-max-height:  12px;
    --ni-gap:         1.5px;
    --ni-label-size:  0.6875rem;
    --ni-label-gap:   0.25rem;
  }

  .ni[data-size='lg'] {
    --ni-bar-width:   4.5px;
    --ni-max-height:  20px;
    --ni-gap:         2.5px;
    --ni-label-size:  0.8125rem;
    --ni-label-gap:   0.5rem;
  }

  /* Bars container - bottom-aligned so bars grow upward */
  .ni-bars {
    display: inline-flex;
    align-items: flex-end;
    gap: var(--ni-gap);
    block-size: var(--ni-max-height);
    flex-shrink: 0;
  }

  /* Individual bar */
  .ni-bar {
    display: inline-block;
    inline-size: var(--ni-bar-width);
    border-radius: calc(var(--ni-bar-width) / 2);
    background: var(--ni-color-inactive);
    transition:
      background-color 260ms ease,
      opacity          260ms ease;
  }

  /* Bar heights: 25/50/75/100% of max */
  .ni-bar--1 { block-size: calc(var(--ni-max-height) * 0.25); }
  .ni-bar--2 { block-size: calc(var(--ni-max-height) * 0.50); }
  .ni-bar--3 { block-size: calc(var(--ni-max-height) * 0.75); }
  .ni-bar--4 { block-size: calc(var(--ni-max-height) * 1.00); }

  /* Active bar: quality colour, full opacity */
  .ni-bar.is-active {
    background: var(--ni-active-color);
    opacity: 1;
  }

  /* Inactive bar: dim but visible (shows empty slot) */
  .ni-bar:not(.is-active) {
    opacity: 0.28;
  }

  /* Disconnected: all bars extra dim */
  .ni[data-quality='disconnected'] .ni-bar {
    opacity: 0.18;
  }

  /* Unknown/loading: staggered pulse across all bars */
  .ni-unknown .ni-bar {
    animation: ni-loading-pulse 1.4s ease-in-out infinite;
  }

  .ni-unknown .ni-bar--2 { animation-delay: 0.12s; }
  .ni-unknown .ni-bar--3 { animation-delay: 0.24s; }
  .ni-unknown .ni-bar--4 { animation-delay: 0.36s; }

  @keyframes ni-loading-pulse {
    0%, 100% { opacity: 0.15; }
    50%      { opacity: 0.45; }
  }

  /* Poor: subtle attention shake every few seconds */
  .ni[data-quality='poor'] .ni-bars {
    animation: ni-poor-attention 3.5s ease-in-out infinite;
    animation-delay: 1s;
  }

  @keyframes ni-poor-attention {
    0%, 95%, 100% { transform: translateX(0); }
    96%           { transform: translateX(-1px); }
    97%           { transform: translateX(1px); }
    98%           { transform: translateX(-1px); }
    99%           { transform: translateX(0); }
  }

  /* Label */
  .ni-label {
    font-size: var(--ni-label-size);
    font-weight: 600;
    color: currentColor;
    white-space: nowrap;
    transition: color 260ms ease;
  }

  .ni[data-quality='excellent'] .ni-label { color: var(--ni-color-excellent); }
  .ni[data-quality='good']      .ni-label { color: var(--ni-color-good);      }
  .ni[data-quality='fair']      .ni-label { color: var(--ni-color-fair);      }
  .ni[data-quality='poor']      .ni-label { color: var(--ni-color-poor);      }

  .ni[data-quality='disconnected'] .ni-label,
  .ni[data-quality='unknown']      .ni-label {
    color: var(--color-muted, #6b7280);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .ni-bar    { transition: none; }
    .ni-label  { transition: none; }
    .ni-bars   { animation: none; }
    .ni-unknown .ni-bar { animation: none; opacity: 0.3; }
  }

  /* Dark theme */
  :global([data-theme='dark']) .ni {
    --ni-color-excellent: #6ee7b7;
    --ni-color-good:      #93c5fd;
    --ni-color-fair:      #fcd34d;
    --ni-color-poor:      #fca5a5;
  }
</style>
