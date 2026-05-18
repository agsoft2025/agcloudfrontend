import { expect, test } from '@playwright/test';

test('shows the home page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('AG Cloud Frontend');
  await expect(page.getByRole('heading', { name: 'AG Cloud Frontend' })).toBeVisible();
  await expect(page.getByText('SvelteKit')).toBeVisible();
});
