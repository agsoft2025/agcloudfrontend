<!--
  AccountMenu — ButtonDropdown example: user avatar / account menu
  ================================================================
  Primary variant trigger showing the signed-in user's name,
  with a separator before the Sign Out danger item.
  Demonstrates: onOpen / onClose lifecycle + triggerSuffix snippet.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import ButtonDropdown from '../ButtonDropdown.svelte';
  import type { DropdownItem } from '../ButtonDropdown.types.ts';

  type Props = {
    displayName?: string;
    onHelp?: () => void;
    onSignOut?: () => void;
    onMenuOpen?: () => void;
    onMenuClose?: () => void;
  };

  let {
    displayName = 'My Account',
    onHelp,
    onSignOut,
    onMenuOpen,
    onMenuClose,
  }: Props = $props();

  const items: DropdownItem[] = [
    {
      id: 'help',
      label: 'Help & Support',
      icon: `<circle cx="12" cy="12" r="10"
               stroke="currentColor" stroke-width="1.75"/>
             <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <line x1="12" y1="17" x2="12.01" y2="17"
               stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    },
    { id: '__separator__', label: '' },
    {
      id: 'sign-out',
      label: 'Sign Out',
      danger: true,
      icon: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <polyline points="16 17 21 12 16 7"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <line x1="21" y1="12" x2="9" y2="12"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
    },
  ];

  function handleSelect(item: DropdownItem) {
    switch (item.id) {
      case 'help':     onHelp?.();    break;
      case 'sign-out': onSignOut?.(); break;
    }
  }
</script>

<ButtonDropdown
  {items}
  label={displayName}
  variant="ghost"
  size="md"
  placement="bottom-end"
  onSelect={handleSelect}
  onOpen={onMenuOpen}
  onClose={onMenuClose}
  icon={`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
           stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
         <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/>`}
/>
