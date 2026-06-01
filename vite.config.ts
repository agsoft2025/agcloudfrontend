import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
      $routes: resolve(__dirname, 'src/routes'),
      $components: resolve(__dirname, 'src/components')
    }
  }
});
