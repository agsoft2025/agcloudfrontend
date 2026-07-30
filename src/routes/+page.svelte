<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth.store';

  // Root "/" — redirect based on auth state.
  // replaceState keeps "/" out of history so Back doesn't return to it.
  $: if (browser && $authStore.isInitialized) {
    if ($authStore.isAuthenticated) {
      goto('/home', { replaceState: true });
    } else {
      goto('/signin', { replaceState: true });
    }
  }
</script>
