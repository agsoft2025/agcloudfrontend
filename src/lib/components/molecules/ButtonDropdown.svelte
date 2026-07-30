<!--
  ButtonDropdown — Button-triggered accessible dropdown menu
  ===========================================================
  Design system relationship:
    The trigger is a native <button> whose CSS token system is identical
    to Button.svelte (same --btn-* custom properties, same data-variant /
    data-size attributes, same size tokens). This makes it visually
    indistinguishable from the Button atom while allowing the trigger to
    carry the ARIA menu-button attributes that Button.svelte does not expose
    (aria-haspopup, aria-expanded, aria-controls). Nesting <Button> inside
    another <button> would produce invalid HTML and break accessibility trees,
    so this composition is intentional and correct.

  ARIA pattern: Menu Button
    https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

  Keyboard support:
    Enter / Space  → open menu (from trigger), activate focused item (inside menu)
    ArrowDown      → open menu focusing first item (from trigger); next item (inside)
    ArrowUp        → open menu focusing last item (from trigger); previous item (inside)
    Home           → first enabled item
    End            → last enabled item
    Escape         → close, return focus to trigger
    Tab            → close, let focus move naturally

  Events (Svelte 5 callback props):
    onSelect(item) → fired when a menu item is chosen
    onOpen()       → fired when the panel opens
    onClose()      → fired when the panel closes
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';
  import type {
    DropdownItem,
    DropdownPlacement,
    DropdownTriggerVariant,
    DropdownTriggerSize,
  } from './ButtonDropdown.types.ts';

  // ── Props ─────────────────────────────────────────────────────
  type Props = {
    /** Menu items to render. */
    items: DropdownItem[];
    /** Text label shown inside the trigger button. */
    label: string;
    /** Optional raw SVG path markup rendered as a leading icon in the trigger. */
    icon?: string;
    /** Visual style of the trigger button — matches Button atom variants. */
    variant?: DropdownTriggerVariant;
    /** Size of the trigger button — matches Button atom sizes. */
    size?: DropdownTriggerSize;
    /** Disable the trigger (and prevent opening). */
    disabled?: boolean;
    /** Panel placement relative to the trigger. */
    placement?: DropdownPlacement;
    /** Controls open/close state — supports bind:open from parent. */
    open?: boolean;
    /** aria-label for the trigger button when label alone is insufficient. */
    triggerAriaLabel?: string;
    /** Optional content rendered inside the trigger after the label (e.g. a custom badge). */
    triggerSuffix?: Snippet;
    /** Extra CSS class forwarded to the root wrapper div. */
    class?: string;
    // ── Callback props (Svelte 5 event pattern) ────────────────
    onSelect?: (item: DropdownItem) => void;
    onOpen?: () => void;
    onClose?: () => void;
  };

  let {
    items,
    label,
    icon,
    variant = 'ghost',
    size = 'md',
    disabled = false,
    placement = 'bottom-start',
    open = $bindable(false),
    triggerAriaLabel,
    triggerSuffix,
    class: extraClass = '',
    onSelect,
    onOpen,
    onClose,
  }: Props = $props();

  // ── DOM refs ──────────────────────────────────────────────────
  let rootRef    = $state<HTMLDivElement | null>(null);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let menuRef    = $state<HTMLUListElement | null>(null);

  // ── Stable IDs ────────────────────────────────────────────────
  const uid    = Math.random().toString(36).slice(2, 8);
  const menuId = `bd-menu-${uid}`;
  const btnId  = `bd-trigger-${uid}`;

  // ── Derived helpers ───────────────────────────────────────────
  /** Indices of all non-disabled items — for arrow key navigation. */
  const enabledIndices = $derived(
    items.reduce<number[]>((acc, item, i) => {
      if (!item.disabled) acc.push(i);
      return acc;
    }, [])
  );

  function itemElAt(index: number): HTMLElement | null {
    return menuRef?.querySelectorAll<HTMLElement>('[role="menuitem"]')[index] ?? null;
  }

  function focusItemAt(index: number) {
    itemElAt(index)?.focus();
  }

  // ── Open / close ──────────────────────────────────────────────
  async function openMenu(focusLast = false) {
    if (disabled) return;
    open = true;
    onOpen?.();
    await tick();
    if (enabledIndices.length === 0) return;
    const target = focusLast
      ? enabledIndices[enabledIndices.length - 1]
      : enabledIndices[0];
    focusItemAt(target);
  }

  function closeMenu(returnFocus = true) {
    open = false;
    onClose?.();
    if (returnFocus) triggerRef?.focus();
  }

  function toggle() {
    if (open) closeMenu();
    else openMenu();
  }

  // ── Keyboard: trigger ─────────────────────────────────────────
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
    const activeEl     = document.activeElement;
    const allItems     = Array.from(
      menuRef?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const rawIndex     = allItems.indexOf(activeEl as HTMLElement);
    const posInEnabled = enabledIndices.indexOf(rawIndex);

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        closeMenu(true);
        break;

      case 'ArrowDown': {
        event.preventDefault();
        if (!enabledIndices.length) break;
        const next =
          posInEnabled === -1
            ? enabledIndices[0]
            : enabledIndices[(posInEnabled + 1) % enabledIndices.length];
        focusItemAt(next);
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        if (!enabledIndices.length) break;
        const len  = enabledIndices.length;
        const prev =
          posInEnabled === -1
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
        // Let natural focus move; close without stealing return focus.
        closeMenu(false);
        break;
    }
  }

  // ── Item selection ────────────────────────────────────────────
  function selectItem(item: DropdownItem) {
    if (item.disabled) return;
    onSelect?.(item);
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
      if (!rootRef?.contains(event.target as Node)) {
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
  class="bd-root {extraClass}"
  class:is-open={open}
  data-placement={placement}
>

  <!-- ── Trigger button ───────────────────────────────────────
       Styled identically to Button.svelte via shared CSS custom
       properties. Carries the ARIA menu-button attributes.     -->
  <button
    bind:this={triggerRef}
    id={btnId}
    class="bd-trigger"
    type="button"
    data-variant={variant}
    data-size={size}
    {disabled}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={menuId}
    aria-label={triggerAriaLabel}
    onclick={toggle}
    onkeydown={handleTriggerKeydown}
  >
    {#if icon}
      <span class="bd-trigger-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          {@html icon}
        </svg>
      </span>
    {/if}

    <span class="bd-trigger-label">{label}</span>

    {#if triggerSuffix}
      {@render triggerSuffix()}
    {/if}

    <!-- Chevron indicator — rotates when open -->
    <span class="bd-chevron" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M3 5L7 9L11 5"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  </button>

  <!-- ── Dropdown panel ────────────────────────────────────────
       Appears on open, positioned below the trigger via CSS.   -->
  {#if open}
    <ul
      bind:this={menuRef}
      id={menuId}
      class="bd-menu"
      role="menu"
      aria-labelledby={btnId}
      onkeydown={handleMenuKeydown}
    >
      {#each items as item (item.id)}
        <li role="none" class="bd-item-row">
          <!-- Optional visual separator -->
          {#if item.id === '__separator__'}
            <div class="bd-separator" role="separator" aria-hidden="true"></div>
          {:else}
            <button
              class="bd-item"
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
                <span class="bd-item-icon" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    {@html item.icon}
                  </svg>
                </span>
              {/if}
              <span class="bd-item-label">{item.label}</span>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

</div>

<style lang="postcss">
  /* ═══════════════════════════════════════════════════════════
     TRIGGER BUTTON
     Visual tokens are 1:1 with Button.svelte — same --btn-*
     custom properties, same data-variant / data-size selectors.
     Any future change to Button.svelte should be mirrored here.
     ═══════════════════════════════════════════════════════════ */

  .bd-trigger {
    /* Shared base — identical to .button in Button.svelte */
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    min-inline-size: max-content;
    border: 1.5px solid var(--btn-border, var(--color-primary));
    border-radius: var(--radius-md);
    background: var(--btn-bg, var(--color-primary));
    color: var(--btn-color, #ffffff);
    font-family: var(--font-sans);
    font-weight: 700;
    line-height: 1;
    text-align: center;
    cursor: pointer;
    user-select: none;
    box-shadow: var(--btn-shadow, 0 1px 2px rgba(0, 0, 0, 0.08));
    transition:
      background-color 180ms ease,
      border-color     180ms ease,
      box-shadow       180ms ease,
      transform        120ms ease,
      opacity          180ms ease;
  }

  .bd-trigger:hover:not(:disabled) {
    box-shadow: var(--btn-shadow-hover, 0 4px 12px rgba(0, 0, 0, 0.15));
    transform: translateY(-1px);
  }

  .bd-trigger:active:not(:disabled) {
    transform: translateY(0);
  }

  .bd-trigger:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px var(--color-surface),
      0 0 0 4px var(--btn-ring, var(--color-secondary));
  }

  .bd-trigger:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    transform: none;
    box-shadow: none;
  }

  /* Open state — keep trigger visually "pressed" while menu is visible */
  .is-open .bd-trigger:not(:disabled) {
    transform: translateY(0);
    box-shadow: var(--btn-shadow, 0 1px 2px rgba(0, 0, 0, 0.08));
  }

  /* ── Sizes (mirror Button.svelte exactly) ─────────────────── */
  .bd-trigger[data-size='sm'] {
    min-block-size: 2rem;
    padding: 0 var(--space-md);
    font-size: 0.8125rem;
    border-radius: var(--radius-sm);
  }

  .bd-trigger[data-size='md'] {
    min-block-size: 2.5rem;
    padding: 0 var(--space-lg);
    font-size: 0.9375rem;
  }

  .bd-trigger[data-size='lg'] {
    min-block-size: 3rem;
    padding: 0 calc(var(--space-lg) + var(--space-sm));
    font-size: 1rem;
    letter-spacing: -0.01em;
  }

  /* ── Variants (mirror Button.svelte exactly) ──────────────── */

  /* Primary — dark navy */
  .bd-trigger[data-variant='primary'] {
    --btn-bg:           #1e2d4a;
    --btn-border:       #1e2d4a;
    --btn-ring:         rgba(30, 45, 74, 0.4);
    --btn-shadow:       0 2px 4px rgba(30, 45, 74, 0.22), 0 1px 2px rgba(0, 0, 0, 0.1);
    --btn-shadow-hover: 0 6px 16px rgba(30, 45, 74, 0.32);
    background: linear-gradient(135deg, #1e2d4a 0%, #2a3d66 100%);
  }

  .bd-trigger[data-variant='primary']:hover:not(:disabled) {
    background: linear-gradient(135deg, #162238 0%, #1e2d4a 100%);
    border-color: #162238;
  }

  /* Secondary — blue accent */
  .bd-trigger[data-variant='secondary'] {
    --btn-bg:           var(--color-secondary);
    --btn-border:       var(--color-secondary);
    --btn-ring:         rgba(78, 135, 255, 0.35);
    --btn-shadow:       0 2px 4px rgba(78, 135, 255, 0.2);
    --btn-shadow-hover: 0 6px 16px rgba(78, 135, 255, 0.32);
    background: var(--color-secondary);
  }

  .bd-trigger[data-variant='secondary']:hover:not(:disabled) {
    background: var(--color-secondary-hover);
    border-color: var(--color-secondary-hover);
  }

  /* Ghost — transparent, theme-adaptive */
  .bd-trigger[data-variant='ghost'] {
    --btn-bg:           transparent;
    --btn-border:       var(--color-border);
    --btn-color:        var(--color-text);
    --btn-ring:         var(--focus-ring-color);
    --btn-shadow:       none;
    --btn-shadow-hover: var(--shadow-sm);
    background: transparent;
  }

  .bd-trigger[data-variant='ghost']:hover:not(:disabled) {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
  }

  /* Ghost open state — matches hover */
  .is-open .bd-trigger[data-variant='ghost']:not(:disabled) {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
  }

  /* Danger — red */
  .bd-trigger[data-variant='danger'] {
    --btn-bg:           var(--color-error);
    --btn-border:       var(--color-error);
    --btn-ring:         rgba(220, 38, 38, 0.3);
    --btn-shadow:       0 2px 4px rgba(220, 38, 38, 0.2);
    --btn-shadow-hover: 0 6px 16px rgba(220, 38, 38, 0.28);
    background: var(--color-error);
  }

  .bd-trigger[data-variant='danger']:hover:not(:disabled) {
    filter: brightness(0.88);
  }

  /* ── Trigger internals ────────────────────────────────────── */
  .bd-trigger-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .bd-trigger-label {
    flex: 1;
    white-space: nowrap;
  }

  .bd-chevron {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    transition: transform 200ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
    /* Slight opacity reduction to not compete with label */
    opacity: 0.7;
  }

  /* Rotate chevron when menu is open */
  .is-open .bd-chevron {
    transform: rotate(180deg);
  }

  /* ═══════════════════════════════════════════════════════════
     ROOT WRAPPER
     position:relative anchors the floating panel.
     ═══════════════════════════════════════════════════════════ */
  .bd-root {
    position: relative;
    display: inline-block;
  }

  /* ═══════════════════════════════════════════════════════════
     DROPDOWN PANEL
     ═══════════════════════════════════════════════════════════ */
  .bd-menu {
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
      0 0 0 1px color-mix(in srgb, var(--color-border) 55%, transparent);
    outline: none;
    animation: bd-appear var(--duration-fast, 120ms) var(--ease-out, cubic-bezier(0.16,1,0.3,1)) both;
  }

  /* Alignment */
  .bd-root[data-placement='bottom-start'] .bd-menu {
    inset-inline-start: 0;
  }

  .bd-root[data-placement='bottom-end'] .bd-menu {
    inset-inline-end: 0;
  }

  @keyframes bd-appear {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     MENU ITEMS
     ═══════════════════════════════════════════════════════════ */
  .bd-item-row {
    padding: 0;
  }

  .bd-item {
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
      background-color var(--duration-fast, 120ms) ease,
      color            var(--duration-fast, 120ms) ease;
    white-space: nowrap;
  }

  /* Hover */
  .bd-item:hover:not(.is-disabled) {
    background: var(--color-surface-raised);
  }

  /* Keyboard focus */
  .bd-item:focus-visible {
    outline: none;
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-secondary) 50%, transparent);
  }

  /* Active / press */
  .bd-item:active:not(.is-disabled) {
    background: color-mix(in srgb, var(--color-secondary) 14%, transparent);
    transform: scale(0.99);
  }

  /* Disabled */
  .bd-item.is-disabled {
    opacity: 0.42;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Danger / destructive */
  .bd-item.is-danger {
    color: var(--color-error);
  }

  .bd-item.is-danger:hover:not(.is-disabled) {
    background: var(--color-error-bg);
    color: var(--color-error);
  }

  .bd-item.is-danger:focus-visible {
    background: var(--color-error-bg);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-error) 40%, transparent);
  }

  /* Icon */
  .bd-item-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    inline-size: 0.9375rem;
    block-size: 0.9375rem;
    color: var(--color-muted);
    transition: color var(--duration-fast, 120ms) ease;
  }

  .bd-item:hover:not(.is-disabled) .bd-item-icon,
  .bd-item:focus-visible .bd-item-icon {
    color: var(--color-text-secondary);
  }

  .bd-item.is-danger .bd-item-icon {
    color: var(--color-error);
    opacity: 0.8;
  }

  /* Label */
  .bd-item-label {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Visual separator (uses id="__separator__" convention) */
  .bd-separator {
    block-size: 1px;
    margin-block: var(--space-xs);
    margin-inline: var(--space-xs);
    background: var(--color-border);
  }

  /* ── Dark theme adjustments ───────────────────────────────── */
  :global([data-theme='dark']) .bd-menu {
    box-shadow:
      var(--shadow-xl),
      0 0 0 1px color-mix(in srgb, var(--color-border-strong) 45%, transparent);
  }
</style>
