import { expect, test } from '@playwright/test';

test('shows the home page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Sign in | AG Cloud');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('shows call workspace on home page', async ({ page }) => {
  await page.goto('/home');

  await expect(page).toHaveTitle('Home | AG Cloud');
  await expect(page.getByRole('button', { name: /One-to-One Call/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One-to-One Call' })).toBeVisible();
  await expect(page.getByLabel('Callee ID')).toBeVisible();
});

test('shows video preview stage after initiating a call', async ({ page }) => {
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
  await page.getByLabel('Callee ID').fill('callee-test-123');
  await page.getByRole('button', { name: 'Initiate call' }).click();

  await expect(page.getByRole('heading', { name: 'Waiting for response' })).toBeVisible();
  await expect(page.getByText('Starting your camera')).toBeVisible();
  await expect(page.getByText('Waiting for the other user to accept')).toBeVisible();
  await expect(page.getByLabel('Your side').getByText('call-test-123')).toBeVisible();
});

test('rejects an incoming call', async ({ page }) => {
  await page.route('http://localhost:3000/calls/incoming-123/reject', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Call rejected successfully' })
    });
  });

  await page.goto('/home');
  await page.getByLabel('Incoming call ID').fill('incoming-123');
  await page.getByRole('button', { name: 'Reject call' }).click();

  await expect(page.getByText('Call rejected successfully')).toBeVisible();
});

test('ends a call by call ID', async ({ page }) => {
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

test('ends an initiated call', async ({ page }) => {
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
  await page.getByLabel('Callee ID').fill('callee-end-123');
  await page.getByRole('button', { name: 'Initiate call' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for response' })).toBeVisible();

  await page.getByRole('button', { name: 'End active call' }).click();

  await expect(page.getByText('Call ended successfully')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Waiting for response' })).toBeHidden();
});
