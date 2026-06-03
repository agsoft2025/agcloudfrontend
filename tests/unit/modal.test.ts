import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ModalHarness from './ModalHarness.svelte';

describe('Modal molecule', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('identifies itself as a labelled modal dialog and moves focus inside', async () => {
    const { getByRole } = render(ModalHarness, { initiallyOpen: true });

    const dialog = getByRole('dialog', { name: 'Delete User' });

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('modal-test-title');
    await waitFor(() => {
      expect(document.activeElement).toBe(getByRole('link', { name: 'Review delete policy' }));
    });
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const { getByRole, queryByRole } = render(ModalHarness);
    const trigger = getByRole('button', { name: 'Open modal' });

    trigger.focus();
    await fireEvent.click(trigger);
    await fireEvent.keyDown(getByRole('dialog', { name: 'Delete User' }), { key: 'Escape' });

    expect(queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('cycles Tab and Shift+Tab through focusable elements inside the dialog', async () => {
    const { getByRole } = render(ModalHarness, { initiallyOpen: true });
    const dialog = getByRole('dialog', { name: 'Delete User' });
    const firstFocusable = getByRole('link', { name: 'Review delete policy' });
    const lastFocusable = getByRole('button', { name: 'Delete' });

    lastFocusable.focus();
    await fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(firstFocusable);

    firstFocusable.focus();
    await fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastFocusable);
  });

  it('closes when the backdrop is clicked', async () => {
    const { getByLabelText, queryByRole } = render(ModalHarness, { initiallyOpen: true });

    await fireEvent.click(getByLabelText('Close modal'));

    expect(queryByRole('dialog')).toBeNull();
  });
});
