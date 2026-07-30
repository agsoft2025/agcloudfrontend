<!--
  SettingsMenu — ButtonDropdown example: header settings navigation
  =================================================================
  Ghost button with gear icon, secondary size, bottom-end placement.
-->
<script lang="ts">
  import ButtonDropdown from '../ButtonDropdown.svelte';
  import type { DropdownItem } from '../ButtonDropdown.types.ts';

  type Props = {
    onNavigate?: (route: string) => void;
  };

  let { onNavigate }: Props = $props();

  const items: DropdownItem[] = [
    {
      id: 'profile-settings',
      label: 'Profile Settings',
      icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/>`,
    },
    {
      id: 'device-settings',
      label: 'Device Settings',
      icon: `<rect x="2" y="3" width="20" height="14" rx="2" ry="2"
               stroke="currentColor" stroke-width="1.75" fill="none"/>
             <line x1="8" y1="21" x2="16" y2="21"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
             <line x1="12" y1="17" x2="12" y2="21"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <path d="M13.73 21a2 2 0 0 1-3.46 0"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      id: 'privacy',
      label: 'Privacy',
      icon: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"
               stroke="currentColor" stroke-width="1.75" fill="none"/>
             <path d="M7 11V7a5 5 0 0 1 10 0v4"
               stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
  ];

  function handleSelect(item: DropdownItem) {
    onNavigate?.(item.id);
  }
</script>

<!-- Gear icon trigger -->
<ButtonDropdown
  {items}
  label="Settings"
  variant="ghost"
  size="md"
  placement="bottom-end"
  triggerAriaLabel="Open settings menu"
  onSelect={handleSelect}
  icon={`<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/>
         <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06
                  a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
                  A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83
                  l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
                  A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83
                  l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
                  a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83
                  l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
                  a1.65 1.65 0 0 0-1.51 1z"
           stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`}
/>
