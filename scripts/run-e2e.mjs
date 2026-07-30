/**
 * run-e2e.mjs — used by `npm run test:e2e`
 *
 * Builds the app, starts the Vite preview server on port 4173, runs
 * Playwright against it, then shuts the server down.
 *
 * SKIP_WEB_SERVER=1 tells playwright.config.ts not to launch a second
 * dev server (we're already providing one here).
 * PLAYWRIGHT_BASE_URL tells the config which URL to use.
 */
import { spawn } from 'node:child_process';
import { preview } from 'vite';

const PREVIEW_PORT = 4173;
const PREVIEW_URL  = `http://127.0.0.1:${PREVIEW_PORT}`;

const server = await preview({
  preview: {
    host:       '127.0.0.1',
    port:       PREVIEW_PORT,
    strictPort: true,
  },
});

const child = spawn(
  process.execPath,
  ['node_modules/playwright/cli.js', 'test', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: PREVIEW_URL,
      SKIP_WEB_SERVER: '1',          // don't start a second server
    },
  }
);

const exitCode = await new Promise((resolve) => {
  child.on('exit', (code) => resolve(code ?? 1));
});

await new Promise((resolve) => server.httpServer.close(resolve));

process.exit(exitCode);
