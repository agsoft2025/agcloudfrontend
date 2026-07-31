<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';
  import { themeStore } from '$lib/stores/theme.store';
  import OfflineBanner from '$lib/components/OfflineBanner.svelte';
  import Toast from '$lib/components/molecules/Toast.svelte';

  onMount(() => {
    // Verify the session with the server via GET /auth/me (the HttpOnly
    // auth cookie is sent automatically); this also re-establishes auth
    // state after a hard refresh, since nothing is read from localStorage.
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
