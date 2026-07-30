<!--
  DropdownMenu — Accessible molecule component
  =============================================
  ARIA pattern: menu button (https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)

  Keyboard support:
    Enter / Space  → open menu or activate focused item
    ArrowDown      → focus next enabled item (wraps)
    ArrowUp        → focus previous enabled item (wraps)
    Home           → focus first enabled item
    End            → focus last enabled item
    Escape         → close menu, return focus to trigger
    Tab            → close menu, move focus naturally
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { DropdownItem, DropdownPlacement } from './DropdownMenu.types.ts';

  type Props = {
    items: DropdownItem[];
    open?: boolean;
    placement?: DropdownPlacement;
    onSelect: (item: DropdownItem) => void;
    /** Trigger button content — rendered inside the focusable trigger element */
    trigger: Snippet;
    /** Optional accessible label for the trigger button */
    triggerLabel?: string;
    /** Extra class forwarded to the root wrapper */
    class?: string;
  };

  let {
    items,
    open = $bindable(false),
    placement = 'bottom-start',
    onSelect,
    trigger,
    triggerLabel,
    class: extraClass = '',
  }: Props = $props();

  // ── DOM refs ──────────────────────────────────────────────────
  let rootRef    = $state<HTMLDivElement | null>(null);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let menuRef    = $state<HTMLUListElement | null>(null);

  // ── Stable IDs ────────────────────────────────────────────────
  // Unique suffix so multiple instances on one page don't share IDs.
  const uid    = Math.random().toString(36).slice(2, 7);
  const menuId = `dm-menu-${uid}`;
  const btnId  = `dm-trigger-${uid}`;

  // ── Helpers ───────────────────────────────────────────────────
  /** Indices of all non-disabled items — used for arrow navigation. */
  const enabledIndices = $derived(
    items.reduce<number[]>((acc, item, i) => {
      if (!item.disabled) acc.push(i);
      return acc;
    }, [])
  );

  function getItemEl(index: number): HTMLElement | null {
    return (
      menuRef?.querySelectorAll<HTMLElement>('[role="menuitem"]')[index] ?? null
    );
  }

  function focusItemAt(index: number) {
    getItemEl(index)?.focus();
  }

  // ── Open / close ──────────────────────────────────────────────
  async function openMenu(focusLast = false) {
    open = true;
    await tick();
    if (enabledIndices.length === 0) return;
    const target = focusLast
      ? enabledIndices[enabledIndices.length - 1]
      : enabledIndices[0];
    focusItemAt(target);
  }

  function closeMenu(returnFocus = true) {
    open = false;
    if (returnFocus) triggerRef?.focus();
  }

  function toggle() {
    if (open) closeMenu();
    else openMenu();
  }

  // ── Keyboard: trigger button ──────────────────────────────────
  function handleTriggerKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        event.preventDefault();
        openMenu(false);
        break;
      case 'ArrowUp':
        event.preventDefault();
        openMenu(true);
        break;
    }
  }

  // ── Keyboard: menu ────────────────────────────────────────────
  function handleMenuKeydown(event: KeyboardEvent) {
    // Determine which enabled index is currently focused.
    const activeEl     = document.activeElement;
    const allItems     = Array.from(menuRef?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const rawIndex     = allItems.indexOf(activeEl as HTMLElement);
    const posInEnabled = enabledIndices.indexOf(rawIndex);

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        closeMenu(true);
        break;

      case 'ArrowDown': {
        event.preventDefault();
        if (enabledIndices.length === 0) break;
        const next = posInEnabled === -1
          ? enabledIndices[0]
          : enabledIndices[(posInEnabled + 1) % enabledIndices.length];
        focusItemAt(next);
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        if (enabledIndices.length === 0) break;
        const len  = enabledIndices.length;
        const prev = posInEnabled === -1
          ? enabledIndices[len - 1]
          : enabledIndices[(posInEnabled - 1 + len) % len];
        focusItemAt(prev);
        break;
      }

      case 'Home':
        event.preventDefault();
        if (enabledIndices.length) focusItemAt(enabledIndices[0]);
        break;

      case 'End':
        event.preventDefault();
        if (enabledIndices.length) focusItemAt(enabledIndices[enabledIndices.length - 1]);
        break;

      case 'Tab':
        // Let focus move naturally; just close without forcing return focus.
        closeMenu(false);
        break;
    }
  }

  // ── Item interaction ──────────────────────────────────────────
  function selectItem(item: DropdownItem) {
    if (item.disabled) return;
    onSelect(item);
    closeMenu(true);
  }

  function handleItemKeydown(event: KeyboardEvent, item: DropdownItem) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectItem(item);
    }
  }

  // ── Click outside ─────────────────────────────────────────────
  $effect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef?.contains(target)) {
        closeMenu(false);
      }
    }

    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  });
</script>

<div
  bind:this={rootRef}
  class="dropdown {extraClass}"
  class:is-open={open}
  data-placement={placement}
>
  <!-- ── Trigger ──────────────────────────────────────────────── -->
  <button
    bind:this={triggerRef}
    id={btnId}
    class="dropdown-trigger"
    type="button"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={menuId}
    aria-label={triggerLabel}
    onclick={toggle}
    onkeydown={handleTriggerKeydown}
  >
    {@render trigger()}
  </button>

  <!-- ── Menu panel ───────────────────────────────────────────── -->
  {#if open}
    <ul
      bind:this={menuRef}
      id={menuId}
      class="dropdown-menu"
      role="menu"
      aria-labelledby={btnId}
      onkeydown={handleMenuKeydown}
    >
      {#each items as item, index (item.id)}
        <li role="none" class="menu-item-wrapper">
          <button
            class="menu-item"
            class:is-danger={item.danger}
            class:is-disabled={item.disabled}
            role="menuitem"
            type="button"
            tabindex={item.disabled ? -1 : 0}
            aria-disabled={item.disabled ?? false}
            onclick={() => selectItem(item)}
            onkeydown={(e) => handleItemKeydown(e, item)}
          >
            {#if item.icon}
              <span class="item-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  {@html item.icon}
                </svg>
              </span>
            {/if}
            <span class="item-label">{item.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="postcss">
  /* ── Root wrapper ─────────────────────────────────────────────
     position: relative keeps the floating panel anchored to the
     trigger while placement data-attribute controls alignment.   */
  .dropdown {
    position: relative;
    display: inline-block;
  }

  /* ── Trigger ──────────────────────────────────────────────────
     Intentionally unstyled — consumers style their own trigger.
     Only resets and focus ring are applied here.                */
  .dropdown-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
    line-height: 1;
    -webkit-tap-highlight-color: transparent;
  }

  .dropdown-trigger:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--radius-sm);
  }

  /* ── Floating panel ───────────────────────────────────────────
     Appears below the trigger, min-width matches trigger width.
     z-index: 900 sits below modals (1100) but above most content. */
  .dropdown-menu {
    position: absolute;
    inset-block-start: calc(100% + 6px);
    z-index: 900;
    min-inline-size: max(14rem, 100%);
    padding: var(--space-xs);
    margin: 0;
    list-style: none;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow:
      var(--shadow-lg),
      0 0 0 1px color-mix(in srgb, var(--color-border) 60%, transparent);
    outline: none;

    /* Smooth entrance */
    animation: menu-appear var(--duration-fast) var(--ease-out) both;
  }

  /* Alignment variants */
  .dropdown[data-placement='bottom-start'] .dropdown-menu {
    inset-inline-start: 0;
  }

  .dropdown[data-placement='bottom-end'] .dropdown-menu {
    inset-inline-end: 0;
  }

  @keyframes menu-appear {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* ── List item wrapper ────────────────────────────────────────
     role="none" on <li> is already set; no visual styles needed. */
  .menu-item-wrapper {
    padding: 0;
  }

  /* Optional visual separator between item groups.
     Usage: <li role="none" class="menu-separator" aria-hidden="true"></li> */
  :global(.menu-separator) {
    block-size: 1px;
    margin-block: var(--space-xs);
    margin-inline: var(--space-xs);
    background: var(--color-border);
    list-style: none;
  }

  /* ── Menu item button ─────────────────────────────────────────
     Full-width, flex row, no default button chrome.             */
  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    inline-size: 100%;
    padding: 0.5rem var(--space-sm);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9rem;
    font-weight: 500;
    line-height: 1.4;
    text-align: start;
    cursor: pointer;
    user-select: none;
    transition:
      background-color var(--duration-fast) ease,
      color var(--duration-fast) ease;

    /* Prevent text wrapping on short items */
    white-space: nowrap;
  }

  /* Hover state */
  .menu-item:hover:not(.is-disabled) {
    background: var(--color-surface-raised);
    color: var(--color-text);
  }

  /* Focus state — keyboard navigation */
  .menu-item:focus-visible {
    outline: none;
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-text);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-secondary) 55%, transparent);
  }

  /* Active / pressed state */
  .menu-item:active:not(.is-disabled) {
    background: color-mix(in srgb, var(--color-secondary) 14%, transparent);
    transform: scale(0.99);
  }

  /* Disabled state */
  .menu-item.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none; /* belt-and-suspenders alongside aria-disabled */
  }

  /* Danger / destructive action */
  .menu-item.is-danger {
    color: var(--color-error);
  }

  .menu-item.is-danger:hover:not(.is-disabled) {
    background: var(--color-error-bg);
    color: var(--color-error);
  }

  .menu-item.is-danger:focus-visible {
    background: var(--color-error-bg);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-error) 45%, transparent);
  }

  /* ── Icon ─────────────────────────────────────────────────────
     Fixed-size container prevents layout shift regardless of icon. */
  .item-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    inline-size: 1rem;
    block-size: 1rem;
    color: var(--color-muted);
    transition: color var(--duration-fast) ease;
  }

  .menu-item:hover:not(.is-disabled) .item-icon,
  .menu-item:focus-visible .item-icon {
    color: var(--color-text-secondary);
  }

  .menu-item.is-danger .item-icon {
    color: var(--color-error);
    opacity: 0.8;
  }

  /* ── Label ────────────────────────────────────────────────────*/
  .item-label {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Dark theme adjustments ───────────────────────────────────
     Most tokens auto-switch via themes.css. Only values that need
     explicit overrides are listed here.                          */
  :global([data-theme='dark']) .dropdown-menu {
    box-shadow:
      var(--shadow-xl),
      0 0 0 1px color-mix(in srgb, var(--color-border-strong) 50%, transparent);
  }
</style>
