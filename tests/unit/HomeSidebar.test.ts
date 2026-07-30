import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// ── Mocks — declared before imports so vi.mock hoisting takes effect ────────

const gotoMock = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => gotoMock(...args) }));

vi.mock('$app/stores', () => {
  let current = { url: new URL('http://localhost/home') };
  const subscribers = new Set<(v: typeof current) => void>();
  return {
    page: {
      subscribe(fn: (v: typeof current) => void) {
        fn(current);
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
    },
    __setPageUrl(url: string) {
      current = { url: new URL(url) };
      subscribers.forEach((fn) => fn(current));
    },
  };
});

const signOutMock = vi.fn();
vi.mock('$lib/api/auth.api', () => ({ signOut: (...args: unknown[]) => signOutMock(...args) }));

import HomeSidebar from '../../src/lib/components/home/HomeSidebar.svelte';
import { authStore, type AuthUser } from '../../src/lib/stores/auth.store';
import { userStore } from '../../src/lib/stores/user.store';
import { contactsDrawerOpen } from '../../src/lib/stores/contacts-drawer.store';
import * as appStores from '$app/stores';

const setPageUrl = (appStores as unknown as { __setPageUrl: (url: string) => void }).__setPageUrl;

const alice: AuthUser = {
  id: 'u1',
  email: 'alice@example.com',
  displayName: 'Alice Wonderland',
  role: 'admin',
};

beforeEach(() => {
  // jsdom does not implement matchMedia; HomeSidebar renders <ThemeToggle>,
  // which subscribes to themeStore.resolved and reads it on mount.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;

  setPageUrl('http://localhost/home');
  authStore.setUser(alice);
  contactsDrawerOpen.set(true);
  gotoMock.mockReset();
  signOutMock.mockReset().mockResolvedValue({ message: 'Logout successful' });
});

afterEach(() => {
  cleanup();
  authStore.clear();
  userStore.clear();
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe('HomeSidebar — rendering', () => {
  it('renders the primary navigation landmark', () => {
    const { getByRole } = render(HomeSidebar);
    expect(getByRole('complementary', { name: 'Application navigation' })).toBeTruthy();
  });

  it('renders the Contacts and Settings nav items', () => {
    const { getByText } = render(HomeSidebar);
    expect(getByText('Contacts')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders a logout button', () => {
    const { getByRole } = render(HomeSidebar);
    expect(getByRole('button', { name: 'Log out' })).toBeTruthy();
  });
});

// ── User info display ────────────────────────────────────────────────────────

describe('HomeSidebar — user info', () => {
  it('shows the display name and role for a full profile', () => {
    const { getByText } = render(HomeSidebar);
    expect(getByText('Alice Wonderland')).toBeTruthy();
    expect(getByText('Admin')).toBeTruthy();
  });

  it('shows initials from a two-word display name', () => {
    const { getByText } = render(HomeSidebar);
    expect(getByText('AW')).toBeTruthy();
  });

  it('falls back to the email local-part when there is no display name', () => {
    authStore.setUser({ id: 'u2', email: 'bob.jones@example.com' });
    const { getByText } = render(HomeSidebar);
    expect(getByText('Bob Jones')).toBeTruthy();
  });

  it('falls back to the first letter of the email for initials with no display name', () => {
    authStore.setUser({ id: 'u2', email: 'bob@example.com' });
    const { getByText } = render(HomeSidebar);
    expect(getByText('B')).toBeTruthy();
  });

  it('defaults to "User" / "U" / "Pro Enterprise" when there is no user at all', () => {
    authStore.clear();
    const { getByText } = render(HomeSidebar);
    expect(getByText('User')).toBeTruthy();
    expect(getByText('U')).toBeTruthy();
    expect(getByText('Pro Enterprise')).toBeTruthy();
  });

  it('title-cases a role for the plan label', () => {
    authStore.setUser({ ...alice, role: 'super_admin' });
    const { getByText } = render(HomeSidebar);
    expect(getByText('Super Admin')).toBeTruthy();
  });
});

// ── Contacts nav item ────────────────────────────────────────────────────────

describe('HomeSidebar — Contacts navigation', () => {
  it('toggles the contacts drawer when already on /home', async () => {
    setPageUrl('http://localhost/home');
    const { getByText } = render(HomeSidebar);
    await fireEvent.click(getByText('Contacts'));
    expect(get(contactsDrawerOpen)).toBe(false);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it('navigates to /home and opens the drawer when not already there', async () => {
    setPageUrl('http://localhost/settings/profile');
    contactsDrawerOpen.set(false);
    const { getByText } = render(HomeSidebar);
    await fireEvent.click(getByText('Contacts'));
    expect(get(contactsDrawerOpen)).toBe(true);
    expect(gotoMock).toHaveBeenCalledWith('/home');
  });

  it('treats /contacts/* routes as the active Contacts tab', async () => {
    setPageUrl('http://localhost/contacts/42');
    const { getByText } = render(HomeSidebar);
    // Active on a /contacts/* route means clicking toggles rather than navigates.
    await fireEvent.click(getByText('Contacts'));
    expect(gotoMock).not.toHaveBeenCalled();
  });
});

// ── Logout ───────────────────────────────────────────────────────────────────

describe('HomeSidebar — logout', () => {
  it('calls the sign-out API', async () => {
    const { getByRole } = render(HomeSidebar);
    await fireEvent.click(getByRole('button', { name: 'Log out' }));
    expect(signOutMock).toHaveBeenCalledOnce();
  });

  it('clears authStore and userStore', async () => {
    userStore.setProfile({ id: 'u9', email: 'x@example.com' });
    const { getByRole } = render(HomeSidebar);
    await fireEvent.click(getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(get(authStore).isAuthenticated).toBe(false));
    expect(userStore.getProfiles().size).toBe(0);
  });

  it('navigates to /signin with replaceState', async () => {
    const { getByRole } = render(HomeSidebar);
    await fireEvent.click(getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/signin', { replaceState: true }));
  });

  it('still signs the user out locally when the API call fails', async () => {
    signOutMock.mockReset().mockRejectedValueOnce(new Error('network error'));
    const { getByRole } = render(HomeSidebar);
    await fireEvent.click(getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(get(authStore).isAuthenticated).toBe(false));
    expect(gotoMock).toHaveBeenCalledWith('/signin', { replaceState: true });
  });
});

// ── Mobile drawer ────────────────────────────────────────────────────────────

describe('HomeSidebar — mobile drawer', () => {
  it('shows a backdrop when mobileOpen is true', () => {
    const { container } = render(HomeSidebar, { mobileOpen: true });
    expect(container.querySelector('.sidebar-backdrop')).toBeTruthy();
  });

  it('does not show a backdrop when mobileOpen is false', () => {
    const { container } = render(HomeSidebar, { mobileOpen: false });
    expect(container.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('closes when the backdrop is clicked', async () => {
    const { container } = render(HomeSidebar, { mobileOpen: true });
    await fireEvent.click(container.querySelector('.sidebar-backdrop')!);
    expect(container.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('closes via the close-navigation button', async () => {
    const { getByRole, container } = render(HomeSidebar, { mobileOpen: true });
    await fireEvent.click(getByRole('button', { name: 'Close navigation' }));
    expect(container.querySelector('.sidebar-backdrop')).toBeNull();
  });
});
