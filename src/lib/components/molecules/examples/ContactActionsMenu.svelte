<!--
  ContactActionsMenu — ButtonDropdown example: contact row action menu
  ====================================================================
  Ghost button trigger + danger "Block" item + separator pattern.
-->
<script lang="ts">
  import ButtonDropdown from '../ButtonDropdown.svelte';
  import type { DropdownItem } from '../ButtonDropdown.types.ts';

  type Props = {
    contactName?: string;
    onViewProfile?: () => void;
    onStartCall?: () => void;
    onMessage?: () => void;
    onBlock?: () => void;
  };

  let {
    contactName = 'Contact',
    onViewProfile,
    onStartCall,
    onMessage,
    onBlock,
  }: Props = $props();

  const items: DropdownItem[] = [
    {
      id: 'view-profile',
      label: 'View Profile',
      icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <circle cx="12" cy="7" r="4"
               stroke="currentColor" stroke-width="1.75"/>`,
    },
    {
      id: 'start-call',
      label: 'Start Call',
      icon: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
                      A19.5 19.5 0 0 1 3.07 10.8a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 2 0h3
                      a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L6.09 7.91
                      a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7
                      A2 2 0 0 1 22 16.92z"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      id: 'message',
      label: 'Message',
      icon: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    // Separator — use special id convention
    { id: '__separator__', label: '' },
    {
      id: 'block-user',
      label: 'Block User',
      danger: true,
      icon: `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
             <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
    },
  ];

  function handleSelect(item: DropdownItem) {
    switch (item.id) {
      case 'view-profile': onViewProfile?.(); break;
      case 'start-call':   onStartCall?.();   break;
      case 'message':      onMessage?.();     break;
      case 'block-user':   onBlock?.();       break;
    }
  }
</script>

<ButtonDropdown
  {items}
  label="Actions"
  variant="ghost"
  size="sm"
  placement="bottom-end"
  triggerAriaLabel="Actions for {contactName}"
  onSelect={handleSelect}
  icon={`<circle cx="12" cy="5" r="1.5" fill="currentColor"/>
         <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
         <circle cx="12" cy="19" r="1.5" fill="currentColor"/>`}
/>
