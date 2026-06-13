<!--
  ContactActionsDropdown — example usage of DropdownMenu
  ========================================================
  Shows a three-dot action menu for a contact / user row.
-->
<script lang="ts">
  import DropdownMenu from '../DropdownMenu.svelte';
  import type { DropdownItem } from '../DropdownMenu.types.ts';

  type Props = {
    contactName?: string;
    onViewProfile?: () => void;
    onStartCall?: () => void;
    onBlockUser?: () => void;
  };

  let {
    contactName = 'Contact',
    onViewProfile,
    onStartCall,
    onBlockUser,
  }: Props = $props();

  let open = $state(false);

  const items: DropdownItem[] = [
    {
      id: 'view-profile',
      label: 'View Profile',
      icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      id: 'start-call',
      label: 'Start Call',
      icon: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.07 10.8a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 2 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L6.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      id: 'block-user',
      label: 'Block User',
      danger: true,
      icon: `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
             <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
    },
  ];

  function handleSelect(item: DropdownItem) {
    switch (item.id) {
      case 'view-profile': onViewProfile?.(); break;
      case 'start-call':   onStartCall?.();   break;
      case 'block-user':   onBlockUser?.();   break;
    }
  }
</script>

<DropdownMenu
  {items}
  bind:open
  placement="bottom-end"
  onSelect={handleSelect}
  triggerLabel={`Actions for ${contactName}`}
>
  {#snippet trigger()}
    <span class="icon-trigger" aria-hidden="true">
      <!-- Three-dot (ellipsis) icon -->
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="5"  r="1.5" fill="currentColor"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
      </svg>
    </span>
  {/snippet}
</DropdownMenu>

<style lang="postcss">
  /*
   * Example trigger styling — a small ghost icon button.
   * In a real contact row you would import and reuse Button[variant=ghost].
   */
  :global(.icon-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    transition:
      background-color var(--duration-fast) ease,
      color var(--duration-fast) ease;
  }

  :global(.dropdown-trigger:hover .icon-trigger),
  :global(.dropdown-trigger:focus-visible .icon-trigger) {
    background: var(--color-surface-raised);
    color: var(--color-text);
  }

  :global(.is-open .icon-trigger) {
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-secondary);
  }
</style>
