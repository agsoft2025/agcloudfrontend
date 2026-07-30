/**
 * ButtonDropdown — shared TypeScript types
 *
 * Extends the base DropdownItem / DropdownPlacement types from DropdownMenu.types.ts
 * so both dropdown components share a single item contract.
 */

export type { DropdownItem, DropdownPlacement } from './DropdownMenu.types.ts';

/**
 * All valid Button trigger variants — mirrors ButtonVariant from Button.svelte.
 * Declared here so ButtonDropdown.svelte does not have to import from the atom.
 */
export type DropdownTriggerVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** All valid Button trigger sizes — mirrors ButtonSize from Button.svelte. */
export type DropdownTriggerSize = 'sm' | 'md' | 'lg';
