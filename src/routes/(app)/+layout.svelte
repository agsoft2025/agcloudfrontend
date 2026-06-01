<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth.store';

  // Redirect unauthenticated users to sign-in.
  // replaceState ensures the protected URL is removed from browser history
  // so the Back button cannot return to it after logout.
  $: if (browser && $authStore.isInitialized && !$authStore.isAuthenticated) {
    goto('/signin', { replaceState: true });
  }
</script>

<!--
  Render protected content only when authenticated.
  This prevents a content flash while the goto() redirect is in flight.
-->
{#if $authStore.isAuthenticated}
  <slot />
{/if}
