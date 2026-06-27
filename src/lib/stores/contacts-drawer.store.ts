import { writable } from 'svelte/store';

/**
 * Controls whether the Contacts list panel is open (visible) or collapsed.
 * Toggled by clicking the "Contacts" nav item while already on the contacts page.
 */
export const contactsDrawerOpen = writable(true);
