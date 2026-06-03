<script lang="ts">
  import { browser } from '$app/environment';
  import { createEventDispatcher, onDestroy, tick } from 'svelte';

  export let open = false;
  export let labelledBy: string | undefined = undefined;
  export let closeOnBackdrop = true;
  export let closeOnEscape = true;
  export let initialFocusSelector: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: void }>();

  let dialogElement: HTMLDivElement;
  let previouslyFocusedElement: HTMLElement | null = null;
  let previousBodyOverflow = '';
  let lastOpen = false;

  const focusableSelector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[contenteditable]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  $: if (open !== lastOpen) {
    lastOpen = open;

    if (open) {
      openModal();
    } else {
      closeModal();
    }
  }

  onDestroy(() => {
    if (open) {
      closeModal();
    }
  });

  async function openModal() {
    if (!browser) return;

    previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    await tick();
    focusInitialElement();
  }

  function closeModal() {
    if (!browser) return;

    document.body.style.overflow = previousBodyOverflow;

    if (previouslyFocusedElement?.isConnected) {
      previouslyFocusedElement.focus();
    }

    previouslyFocusedElement = null;
  }

  function requestClose() {
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdrop) {
      requestClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      requestClose();
      return;
    }

    if (event.key === 'Tab') {
      trapFocus(event);
    }
  }

  function handleFocusIn(event: FocusEvent) {
    if (!open || !dialogElement || !(event.target instanceof Node)) return;

    if (!dialogElement.contains(event.target)) {
      event.stopPropagation();
      focusInitialElement();
    }
  }

  function focusInitialElement() {
    const selectedElement = initialFocusSelector
      ? dialogElement?.querySelector<HTMLElement>(initialFocusSelector)
      : null;

    const [firstFocusable] = getFocusableElements();
    const elementToFocus = selectedElement ?? firstFocusable ?? dialogElement;

    elementToFocus?.focus();
  }

  function trapFocus(event: KeyboardEvent) {
    const focusableElements = getFocusableElements();

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogElement?.focus();
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    } else if (!dialogElement.contains(activeElement)) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  function getFocusableElements() {
    if (!dialogElement) return [];

    return Array.from(dialogElement.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => {
        const style = window.getComputedStyle(element);

        return style.display !== 'none'
          && style.visibility !== 'hidden';
      });
  }
</script>

<svelte:document on:focusin={handleFocusIn} />

{#if open}
  <div class="modal-layer">
    <button
      class="modal-backdrop"
      type="button"
      aria-label="Close modal"
      tabindex="-1"
      on:click={handleBackdropClick}
    ></button>

    <div
      bind:this={dialogElement}
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabindex="-1"
      on:keydown={handleKeydown}
    >
      <header class="modal-header">
        <slot name="header" />
      </header>

      <div class="modal-content">
        <slot />
      </div>

      <footer class="modal-footer">
        <slot name="footer" />
      </footer>
    </div>
  </div>
{/if}

<style lang="postcss">
  .modal-layer {
    position: fixed;
    z-index: 1100;
    inset: 0;
    display: grid;
    place-items: center;
    padding: var(--space-lg);
  }

  .modal-backdrop {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: rgba(15, 23, 42, 0.58);
    cursor: default;
  }

  .modal {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    inline-size: min(100%, 34rem);
    max-block-size: min(42rem, calc(100dvh - 2rem));
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-lg);
  }

  .modal:focus {
    outline: none;
  }

  .modal-header,
  .modal-content,
  .modal-footer {
    padding-inline: var(--space-xl);
  }

  .modal-header {
    padding-block: var(--space-xl) var(--space-md);
    border-block-end: 1px solid var(--color-border);
  }

  .modal-header :global(*) {
    margin-block: 0;
  }

  .modal-content {
    min-block-size: 0;
    padding-block: var(--space-lg);
    overflow: auto;
  }

  .modal-content :global(:first-child) {
    margin-block-start: 0;
  }

  .modal-content :global(:last-child) {
    margin-block-end: 0;
  }

  .modal-footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding-block: var(--space-md) var(--space-xl);
    border-block-start: 1px solid var(--color-border);
  }

  @media (max-width: 640px) {
    .modal-layer {
      align-items: end;
      padding: var(--space-sm);
    }

    .modal {
      inline-size: 100%;
      max-block-size: calc(100dvh - 1rem);
      border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-sm);
    }

    .modal-header,
    .modal-content,
    .modal-footer {
      padding-inline: var(--space-lg);
    }

    .modal-footer {
      flex-direction: column-reverse;
    }

    .modal-footer :global(.button) {
      inline-size: 100%;
    }
  }
</style>
