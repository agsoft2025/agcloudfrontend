import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/+page.svelte';

describe('Home page (+page.svelte)', () => {
  it('renders the page title', () => {
    const { getByText } = render(Page);
    expect(getByText('AG Cloud Frontend')).toBeTruthy();
  });
});