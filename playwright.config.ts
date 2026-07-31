/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * Running tests two ways:
 *   1. `npx playwright test`  — Playwright auto-starts `vite dev` on port 5173
 *      and tears it down when tests finish. No manual server needed.
 *
 *   2. `npm run test:e2e`  — The run-e2e.mjs script builds the app, starts the
 *      Vite preview server on port 4173, then calls Playwright. Set
 *      PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 to override the default.
 *
 * Environment variables:
 *   PLAYWRIGHT_BASE_URL  Override the app base URL (default: http://127.0.0.1:5173)
 *   CI                   When set, retries are enabled and a fresh server is always started.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: 'tests/e2e',

  /* Run each test file in parallel; tests within a file run serially by default */
  fullyParallel: false,

  /* Fail the build on CI if any test.only was accidentally left in source */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Use 1 worker in CI; let Playwright decide locally */
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    /* Capture screenshot only on failure */
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /calls\.livekit\.spec\.ts/,
    },
    {
      /**
       * Dedicated project for tests/e2e/calls.livekit.spec.ts — the 5 tests
       * that require a real, reachable LiveKit deployment (see that file's
       * header comment). Gets fake media devices + auto-granted permissions
       * so getUserMedia()/getDisplayMedia() don't block on OS/browser
       * pickers in headless/CI runs. Every test in the file self-skips
       * unless RUN_LIVEKIT_E2E=1 is set, so this project is a no-op harness
       * change otherwise.
       */
      name: 'chromium-livekit',
      testMatch: /calls\.livekit\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['camera', 'microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--auto-select-desktop-capture-source=Entire screen',
          ],
        },
      },
    },
  ],

  /**
   * Auto-start the Vite dev server before the test run and shut it down
   * after. When a server is already running on the port (e.g. you ran
   * `npm run dev` yourself), Playwright reuses it instead of starting another
   * one — unless CI is set, in which case a fresh server is always started.
   *
   * This block is skipped when Playwright is launched via run-e2e.mjs
   * because that script already starts its own preview server.
   */
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 60_000,
      },
});
