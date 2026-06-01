<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth.store';

  /**
   * Protected route guard.
   * Unauthenticated users are immediately redirected to /signin.
   * replaceState removes the protected URL from history so the browser
   * Back button cannot return to a protected page after logout.
   */
  $: if (browser && $authStore.isInitialized && !$authStore.isAuthenticated) {
    goto('/signin', { replaceState: true });
  }
</script>

{#if $authStore.isAuthenticated}
  <slot />
{/if}
