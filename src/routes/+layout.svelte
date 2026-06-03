<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';
  import { themeStore } from '$lib/stores/theme.store';

  onMount(() => {
    // Re-read auth session from localStorage (handles hard refresh)
    authStore.initialize();
    // Start theme manager: reads localStorage, subscribes to OS changes
    themeStore.initialize();
  });

  onDestroy(() => {
    themeStore.destroy();
  });
</script>

<slot />
