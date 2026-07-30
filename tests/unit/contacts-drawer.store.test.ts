import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { contactsDrawerOpen } from '../../src/lib/stores/contacts-drawer.store';

beforeEach(() => {
  contactsDrawerOpen.set(true);
});

describe('contactsDrawerOpen', () => {
  it('defaults to open (true)', () => {
    // Re-check against a fresh set() in beforeEach since it's a bare writable
    // with no reset() helper of its own.
    expect(get(contactsDrawerOpen)).toBe(true);
  });

  it('can be closed via set(false)', () => {
    contactsDrawerOpen.set(false);
    expect(get(contactsDrawerOpen)).toBe(false);
  });

  it('can be re-opened via set(true)', () => {
    contactsDrawerOpen.set(false);
    contactsDrawerOpen.set(true);
    expect(get(contactsDrawerOpen)).toBe(true);
  });

  it('supports toggling via update()', () => {
    contactsDrawerOpen.update((open) => !open);
    expect(get(contactsDrawerOpen)).toBe(false);
    contactsDrawerOpen.update((open) => !open);
    expect(get(contactsDrawerOpen)).toBe(true);
  });

  it('notifies subscribers on change', () => {
    const log: boolean[] = [];
    const unsub = contactsDrawerOpen.subscribe((v) => log.push(v));
    contactsDrawerOpen.set(false);
    contactsDrawerOpen.set(true);
    unsub();
    expect(log).toEqual([true, false, true]);
  });

  it('does not notify after unsubscribe', () => {
    const log: boolean[] = [];
    const unsub = contactsDrawerOpen.subscribe((v) => log.push(v));
    unsub();
    contactsDrawerOpen.set(false);
    expect(log).toEqual([true]);
  });
});
