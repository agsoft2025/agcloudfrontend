<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth.store';

  /**
   * Public-only route guard.
   * Already-authenticated users are redirected to /home.
   */
  $: if (browser && $authStore.isInitialized && $authStore.isAuthenticated) {
    goto('/home', { replaceState: true });
  }
</script>

{#if !$authStore.isAuthenticated}
  <slot />
{/if}
