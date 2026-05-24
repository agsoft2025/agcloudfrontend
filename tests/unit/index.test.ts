import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/+page.svelte';
import HomePage from '../../src/routes/home/+page.svelte';

describe('Root page (+page.svelte)', () => {
  it('renders sign in as the entry page', () => {
    const { getByRole, getByText } = render(Page);
    expect(getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(getByText('Use your account email and password to continue.')).toBeTruthy();
  });
});

describe('Home page', () => {
  it('renders call navigation and default one-to-one content', () => {
    const { getByRole, getByText } = render(HomePage);

    expect(getByRole('button', { name: /One-to-One Call/i })).toBeTruthy();
    expect(getByText('Start a direct call with a single recipient.')).toBeTruthy();
  });
});
