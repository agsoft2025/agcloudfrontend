import { spawn } from 'node:child_process';
import { preview } from 'vite';

const server = await preview({
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true
  }
});

const child = spawn(process.execPath, ['node_modules/playwright/cli.js', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false
});

const exitCode = await new Promise((resolve) => {
  child.on('exit', (code) => resolve(code ?? 1));
});

await new Promise((resolve) => server.httpServer.close(resolve));

process.exit(exitCode);
