<!--
  SettingsDropdown — example usage of DropdownMenu
  ==================================================
  Shows a settings gear menu in a top nav / header bar.
-->
<script lang="ts">
  import DropdownMenu from '../DropdownMenu.svelte';
  import type { DropdownItem } from '../DropdownMenu.types.ts';

  type Props = {
    onNavigate?: (route: string) => void;
  };

  let { onNavigate }: Props = $props();

  let open = $state(false);

  const items: DropdownItem[] = [
    {
      id: 'profile-settings',
      label: 'Profile Settings',
      icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.75"/>`,
    },
    {
      id: 'device-settings',
      label: 'Device Settings',
      icon: `<rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
             <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
             <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>`,
    },
    {
      id: 'notification-settings',
      label: 'Notification Settings',
      icon: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
             <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    {
      id: 'privacy-settings',
      label: 'Privacy Settings',
      icon: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
             <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
  ];

  function handleSelect(item: DropdownItem) {
    onNavigate?.(item.id);
  }
</script>

<DropdownMenu
  {items}
  bind:open
  placement="bottom-end"
  onSelect={handleSelect}
  triggerLabel="Open settings menu"
>
  {#snippet trigger()}
    <span class="settings-trigger-inner">
      <!-- Gear / settings icon -->
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/>
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="sr-only">Settings</span>
    </span>
  {/snippet}
</DropdownMenu>

<style lang="postcss">
  .settings-trigger-inner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    transition:
      background-color var(--duration-fast) ease,
      color var(--duration-fast) ease;
  }

  :global(.dropdown-trigger:hover) .settings-trigger-inner,
  :global(.dropdown-trigger:focus-visible) .settings-trigger-inner {
    background: var(--color-surface-raised);
    color: var(--color-text-secondary);
  }

  :global(.is-open) .settings-trigger-inner {
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-secondary);
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
