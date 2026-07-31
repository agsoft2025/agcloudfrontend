import { expect, test } from '@playwright/test';
import { injectAuthSession } from './helpers/auth';

// ── Auth session injection ────────────────────────────────────────────────────
// All tests that visit /home need an authenticated session because the route
// guard redirects unauthenticated visitors to /signin. injectAuthSession()
// mocks GET /auth/me (what authStore.initialize() actually checks) rather
// than just seeding localStorage.

// ── Tests ─────────────────────────────────────────────────────────────────────

test('shows the home page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Sign in | AG Cloud');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  // getByRole scopes to only the input, excluding the "Show password" toggle button
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
});

test('shows call workspace on home page', async ({ page, context }) => {
  await injectAuthSession(context);
  await page.goto('/home');

  await expect(page).toHaveTitle('Home | AG Cloud');
  await expect(page.getByRole('button', { name: /One-to-One Call/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One-to-One Call' })).toBeVisible();
  // Label is "Recipient user ID" (one-to-one mode default)
  await expect(page.getByLabel('Recipient user ID')).toBeVisible();
});

test('shows video preview stage after initiating a call', async ({ page, context }) => {
  await injectAuthSession(context);

  await page.route('http://localhost:3000/calls/initiate', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Call request sent.',
        callId: 'call-test-123'
      })
    });
  });

  await page.goto('/home');
  await page.getByLabel('Recipient user ID').fill('callee-test-123');
  // Submit button text is "Start call"
  await page.getByRole('button', { name: 'Start call' }).click();
  console.log(await page.locator('body').textContent());

  await expect(
    page.getByText('Call request sent to callee-test-123.')
  ).toBeVisible();

  await expect(
    page.getByText('call-test-123')
  ).toBeVisible();
});

test('rejects an incoming call', async ({ page, context }) => {
  await injectAuthSession(context);

  await page.route('http://localhost:3000/calls/incoming-123/reject', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Call rejected successfully' })
    });
  });

  await page.goto('/home');
  await page.getByLabel('Incoming call ID').fill('incoming-123');
  // Reject button text is "Decline"
  await page.getByRole('button', { name: 'Decline' }).click();

  await expect(page.getByText('Call rejected successfully')).toBeVisible();
});

test('ends a call by call ID', async ({ page, context }) => {
  await injectAuthSession(context);

  await page.route('http://localhost:3000/calls/incoming-123/end', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Call ended successfully' })
    });
  });

  await page.goto('/home');
  await page.getByLabel('Incoming call ID').fill('incoming-123');
  await page.getByRole('button', { name: 'End call' }).click();

  await expect(page.getByText('Call ended successfully')).toBeVisible();
});

test('ends an initiated call', async ({ page, context }) => {
  await injectAuthSession(context);

  await page.route('http://localhost:3000/calls/initiate', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Call request sent.', callId: 'call-end-123' })
    });
  });
  await page.route('http://localhost:3000/calls/call-end-123/end', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Call ended successfully' })
    });
  });

  await page.goto('/home');
  await page.getByLabel('Recipient user ID').fill('callee-end-123');
  await page.getByRole('button', { name: 'Start call' }).click();
  await expect(
    page.getByText('Call request sent to callee-end-123.')
  ).toBeVisible();

  await page.getByTitle('End call').click();

  await expect(
    page.getByText('Call ended successfully')
  ).toBeVisible();
});
