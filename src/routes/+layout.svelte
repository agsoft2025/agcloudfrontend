<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';
  import { themeStore } from '$lib/stores/theme.store';
  import OfflineBanner from '$lib/components/OfflineBanner.svelte';
  import Toast from '$lib/components/molecules/Toast.svelte';

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

<OfflineBanner />
<Toast />
<slot />
