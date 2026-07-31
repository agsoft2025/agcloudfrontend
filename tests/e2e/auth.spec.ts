import { test, expect, type Page } from '@playwright/test';
import { injectAuthSession } from './helpers/auth';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Minimum password that passes both backend (≥6) and frontend (≥8) validation. */
const TEST_PASSWORD = 'Test@12345!';

// ─────────────────────────────────────────────────────────────────
// Mock factories
// ─────────────────────────────────────────────────────────────────

function mockUser(email: string) {
  return {
    id: 'mock-user-001',
    email,
    displayName: 'Test User',
    role: 'user',
    status: 'active',
    avatarUrl: null,
  };
}

function mockSignInBody(email: string) {
  const token = 'mock.jwt.token';
  return {
    message: 'Login successful',
    accessToken: token,
    token,
    user: mockUser(email),
  };
}

// ─────────────────────────────────────────────────────────────────
// Route interceptors — applied per-test to keep each test isolated
// ─────────────────────────────────────────────────────────────────

async function interceptSignUp(page: Page, email: string, statusCode = 201) {
  await page.route(`${API_BASE}/auth/signup`, (route) =>
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify(
        statusCode === 201
          ? { message: 'User registered successfully', user: { id: 'mock-user-001', email, displayName: 'Test User' } }
          : { message: 'User already exists' }
      ),
    })
  );
}

async function interceptSignIn(page: Page, email: string, statusCode = 200) {
  await page.route(`${API_BASE}/auth/signin`, (route) =>
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify(
        statusCode === 200
          ? mockSignInBody(email)
          : { message: 'Invalid email or password' }
      ),
    })
  );

  // On a successful sign-in, the app follows up with `authStore.initialize()`,
  // which calls GET /auth/me to verify the (mocked) HttpOnly cookie session.
  // That call must be mocked too or the app treats the visitor as signed out
  // immediately after "signing in".
  if (statusCode === 200) {
    await page.route(`${API_BASE}/auth/me`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser(email)),
      })
    );
  }
}

async function interceptSignOut(page: Page) {
  await page.route(`${API_BASE}/auth/signout`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Logout successful' }),
    })
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared UI action helpers
// ─────────────────────────────────────────────────────────────────

async function fillSignUpForm(page: Page, email: string, password: string) {
  await page.getByLabel('Display name').fill('Test User');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
}

async function fillSignInForm(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
}

// ─────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────

test.describe('Authentication Flow', () => {
  // Each test gets a unique email so there is no cross-test state
  let email: string;

  test.beforeEach(() => {
    email = `test-${Date.now()}@example.com`;
  });

  // ── 1. Sign-up ────────────────────────────────────────────────
  test.describe('Sign-up', () => {
    test('renders the sign-up page with all required fields', async ({ page }) => {
      await page.goto('/signup');

      await expect(page).toHaveTitle('Sign up | AG Cloud');
      await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
      await expect(page.getByLabel('Display name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
      await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    });

    test('shows validation errors when submitting an empty form', async ({ page }) => {
      await page.goto('/signup');

      await page.getByRole('button', { name: /create account/i }).click();

      // All three required-field errors should appear
      await expect(page.getByText('Display name is required.')).toBeVisible();
      await expect(page.getByText('Email is required.')).toBeVisible();
      await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
    });

    test('shows a validation error for an invalid email address', async ({ page }) => {
      await page.goto('/signup');

      await page.getByLabel('Display name').fill('Test User');
      await page.getByLabel('Email').fill('not-an-email');
      await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    });

    test('shows a validation error when password is too short', async ({ page }) => {
      await page.goto('/signup');

      await page.getByLabel('Display name').fill('Test User');
      await page.getByLabel('Email').fill(email);
      await page.getByRole('textbox', { name: 'Password' }).fill('short');
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible();
    });

    test('creates an account and redirects to /home on success', async ({ page }) => {
      await interceptSignUp(page, email);
      await interceptSignIn(page, email);

      await page.goto('/signup');
      await fillSignUpForm(page, email, TEST_PASSWORD);
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page).toHaveURL(/\/home/);
      await expect(page).toHaveTitle('Home | AG Cloud');
    });

    test('stores the access token in localStorage after successful sign-up', async ({ page }) => {
      await interceptSignUp(page, email);
      await interceptSignIn(page, email);

      await page.goto('/signup');
      await fillSignUpForm(page, email, TEST_PASSWORD);
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page).toHaveURL(/\/home/);

      const token = await page.evaluate(() => localStorage.getItem('accessToken'));
      expect(token).toBeTruthy();
      expect(token).toBe('mock.jwt.token');
    });

    test('shows a server error when the email is already registered', async ({ page }) => {
      // signup returns 409; no signin intercept needed
      await interceptSignUp(page, email, 409);

      await page.goto('/signup');
      await fillSignUpForm(page, email, TEST_PASSWORD);
      await page.getByRole('button', { name: /create account/i }).click();

      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText('User already exists')).toBeVisible();
    });

    test('the "Sign in" link navigates to the sign-in page', async ({ page }) => {
      await page.goto('/signup');

      await page.getByRole('link', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/signin/);
    });
  });

  // ── 2. Sign-in ────────────────────────────────────────────────
  test.describe('Sign-in', () => {
    test('renders the sign-in page with all required fields', async ({ page }) => {
      await page.goto('/signin');

      await expect(page).toHaveTitle('Sign in | AG Cloud');
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    });

    test('shows validation errors when submitting an empty form', async ({ page }) => {
      await page.goto('/signin');

      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByText('Email is required.')).toBeVisible();
      await expect(page.getByText('Password is required.')).toBeVisible();
    });

    test('signs in successfully and redirects to /home', async ({ page }) => {
      await interceptSignIn(page, email);

      await page.goto('/signin');
      await fillSignInForm(page, email, TEST_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/home/);
      await expect(page).toHaveTitle('Home | AG Cloud');
    });

    test('stores auth token in localStorage after successful sign-in', async ({ page }) => {
      await interceptSignIn(page, email);

      await page.goto('/signin');
      await fillSignInForm(page, email, TEST_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/home/);

      const [token, storedUser] = await page.evaluate(() => [
        localStorage.getItem('accessToken'),
        localStorage.getItem('authUser'),
      ]);

      expect(token).toBe('mock.jwt.token');
      expect(JSON.parse(storedUser!).email).toBe(email);
    });

    test('shows an error alert on invalid credentials', async ({ page }) => {
      await interceptSignIn(page, email, 401);

      await page.goto('/signin');
      await fillSignInForm(page, email, 'wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText('Invalid email or password')).toBeVisible();
      // Must stay on sign-in page after failure
      await expect(page).toHaveURL(/\/signin/);
    });

    test('the "Create an account" link navigates to the sign-up page', async ({ page }) => {
      await page.goto('/signin');

      await page.getByRole('link', { name: /create an account/i }).click();

      await expect(page).toHaveURL(/\/signup/);
    });

    test('the "Forgot password?" link navigates to the forgot-password page', async ({ page }) => {
      await page.goto('/signin');

      await page.getByRole('link', { name: /forgot password/i }).click();

      await expect(page).toHaveURL(/\/forgot-password/);
    });
  });

  // ── 3. Home page (authenticated) ─────────────────────────────
  test.describe('Home page', () => {
    test('shows the call workspace after sign-in', async ({ page }) => {
      await interceptSignIn(page, email);

      await page.goto('/signin');
      await fillSignInForm(page, email, TEST_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/home/);

      // Sidebar navigation is present
      await expect(page.getByRole('complementary', { name: /application navigation/i })).toBeVisible();

      // Outbound and inbound call panels are visible
      await expect(page.getByText('Outbound')).toBeVisible();
      await expect(page.getByText('Inbound')).toBeVisible();
    });

    test('shows the authenticated user display name in the sidebar', async ({ page }) => {
      await interceptSignIn(page, email);

      await page.goto('/signin');
      await fillSignInForm(page, email, TEST_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page).toHaveURL(/\/home/);

      // The sidebar footer shows the user's display name
      await expect(page.getByText('Test User')).toBeVisible();
    });
  });

  // ── 4. Sign-out ───────────────────────────────────────────────
  test.describe('Sign-out', () => {
    test('signs out and redirects to /signin', async ({ page, context }) => {
      await injectAuthSession(context, { email });
      await interceptSignOut(page);

      await page.goto('/home');
      await expect(page).toHaveURL(/\/home/);

      await page.getByRole('button', { name: /log out/i }).click();

      await expect(page).toHaveURL(/\/signin/);
      await expect(page).toHaveTitle('Sign in | AG Cloud');
    });

    test('clears localStorage tokens on sign-out', async ({ page, context }) => {
      await injectAuthSession(context, { email });
      await interceptSignOut(page);

      await page.goto('/home');
      await page.getByRole('button', { name: /log out/i }).click();

      await expect(page).toHaveURL(/\/signin/);

      const [token, user] = await page.evaluate(() => [
        localStorage.getItem('accessToken'),
        localStorage.getItem('authUser'),
      ]);

      expect(token).toBeNull();
      expect(user).toBeNull();
    });

    test('shows the sign-in page after sign-out even if /signout API fails', async ({ page, context }) => {
      await injectAuthSession(context, { email });

      // Backend sign-out fails — session must still be cleared locally
      await page.route(`${API_BASE}/auth/signout`, (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      );

      await page.goto('/home');
      await page.getByRole('button', { name: /log out/i }).click();

      // Regardless of API failure, the client clears tokens and redirects
      await expect(page).toHaveURL(/\/signin/);

      const token = await page.evaluate(() => localStorage.getItem('accessToken'));
      expect(token).toBeNull();
    });
  });

  // ── 5. Route guards ───────────────────────────────────────────
  test.describe('Route guards', () => {
    test('redirects unauthenticated users from /home to /signin', async ({ page }) => {
      // No auth session injected — visiting /home must redirect
      await page.goto('/home');

      await expect(page).toHaveURL(/\/signin/);
      await expect(page).toHaveTitle('Sign in | AG Cloud');
    });

    test('redirects authenticated users from /signin to /home', async ({ page, context }) => {
      await injectAuthSession(context, { email });

      await page.goto('/signin');

      await expect(page).toHaveURL(/\/home/);
    });

    test('redirects authenticated users from /signup to /home', async ({ page, context }) => {
      await injectAuthSession(context, { email });

      await page.goto('/signup');

      await expect(page).toHaveURL(/\/home/);
    });

    test('prevents back-button access to /home after sign-out', async ({ page }) => {
      // Sign in via UI rather than injectAuthSession — addInitScript re-runs on
      // every page.goto(), which would re-inject the token after logout and make
      // the route guard think the user is still authenticated.
      await interceptSignIn(page, email);
      await interceptSignOut(page);

      await page.goto('/signin');
      await fillSignInForm(page, email, TEST_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/home/);

      // Sign out — replaceState removes /home from the browser history stack
      await page.getByRole('button', { name: /log out/i }).click();
      await expect(page).toHaveURL(/\/signin/);

      // Direct navigation to /home after logout must be blocked by the route guard.
      await page.goto('/home');
      await expect(page).toHaveURL(/\/signin/);
    });

    test('redirects to /signin when the access token is absent', async ({ page }) => {
      // Ensure localStorage is empty (no token)
      await page.goto('/signin'); // any page to initialise the origin
      await page.evaluate(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('authUser');
      });

      await page.goto('/home');

      await expect(page).toHaveURL(/\/signin/);
    });
  });

  // ── 6. Root "/" redirect ──────────────────────────────────────
  test.describe('Root path redirect', () => {
    test('redirects unauthenticated "/" to /signin', async ({ page }) => {
      await page.goto('/');

      await expect(page).toHaveURL(/\/signin/);
    });

    test('redirects authenticated "/" to /home', async ({ page, context }) => {
      await injectAuthSession(context, { email });

      await page.goto('/');

      await expect(page).toHaveURL(/\/home/);
    });
  });

  // ── 7. Full end-to-end journey ────────────────────────────────
  test('full journey: sign-up → home → sign-out → route guard', async ({ page }) => {
    // 1. Register
    await interceptSignUp(page, email);
    await interceptSignIn(page, email);
    await interceptSignOut(page);

    await page.goto('/signup');
    await fillSignUpForm(page, email, TEST_PASSWORD);
    await page.getByRole('button', { name: /create account/i }).click();

    // 2. Should land on /home
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByText('Outbound')).toBeVisible();

    // 3. Sign out
    await page.getByRole('button', { name: /log out/i }).click();

    // 4. Should land on /signin
    await expect(page).toHaveURL(/\/signin/);

    // 5. Attempting /home without a token must redirect
    await page.goto('/home');
    await expect(page).toHaveURL(/\/signin/);
  });
});
