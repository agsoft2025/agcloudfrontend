<script lang="ts" context="module">
  export type AvatarSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
  export let src: string | undefined = undefined;
  export let alt = '';
  export let name = '';
  export let initials: string | undefined = undefined;
  export let size: AvatarSize = 'md';
  export let online = false;

  let imageFailed = false;

  $: visibleInitials = (initials || name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

  $: showImage = Boolean(src) && !imageFailed;
  $: accessibleLabel = alt || name || 'User avatar';

  $: if (src) {
    imageFailed = false;
  }
</script>

<span class="avatar" data-size={size} aria-label={accessibleLabel} title={name || accessibleLabel}>
  {#if showImage}
    <img class="image" {src} {alt} on:error={() => (imageFailed = true)} />
  {:else}
    <span class="initials" aria-hidden="true">{visibleInitials}</span>
  {/if}

  {#if online}
    <span class="badge" aria-label="Online"></span>
  {/if}
</span>

<style lang="postcss">
  .avatar {
    --avatar-size: 2.5rem;
    --avatar-font-size: 0.875rem;
    --badge-size: 0.65rem;

    position: relative;
    display: inline-grid;
    place-items: center;
    inline-size: var(--avatar-size);
    block-size: var(--avatar-size);
    overflow: visible;
    border-radius: 999px;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--color-secondary) 24%, transparent), transparent),
      var(--color-primary);
    color: var(--color-surface);
    font-family: var(--font-sans);
    font-size: var(--avatar-font-size);
    font-weight: 800;
    line-height: 1;
    user-select: none;
  }

  .avatar[data-size='sm'] {
    --avatar-size: 2rem;
    --avatar-font-size: 0.75rem;
    --badge-size: 0.55rem;
  }

  .avatar[data-size='lg'] {
    --avatar-size: 3.5rem;
    --avatar-font-size: 1.125rem;
    --badge-size: 0.85rem;
  }

  .image {
    inline-size: 100%;
    block-size: 100%;
    border-radius: inherit;
    object-fit: cover;
  }

  .initials {
    letter-spacing: 0.02em;
  }

  .badge {
    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 0;
    inline-size: var(--badge-size);
    block-size: var(--badge-size);
    border: 2px solid var(--color-surface);
    border-radius: 999px;
    background: #12b76a;
    box-shadow: 0 0 0 1px color-mix(in srgb, #12b76a 30%, transparent);
  }
</style>
