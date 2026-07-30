/**
 * DropdownMenu — shared TypeScript types
 */

export type DropdownItem = {
  id: string;
  label: string;
  /** Raw SVG path markup injected inside a 24×24 viewBox svg element */
  icon?: string;
  disabled?: boolean;
  /** Renders item in the danger/destructive colour */
  danger?: boolean;
};

export type DropdownPlacement = 'bottom-start' | 'bottom-end';
