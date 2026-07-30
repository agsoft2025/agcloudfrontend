<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth.store';

  // Redirect already-authenticated users away from auth pages.
  // Prevents signed-in users from seeing login/signup screens.
  $: if (browser && $authStore.isInitialized && $authStore.isAuthenticated) {
    goto('/home', { replaceState: true });
  }
</script>

<!--
  Render auth page content only when not authenticated.
  Prevents a flash of the login form for already-signed-in users.
-->
{#if !$authStore.isAuthenticated}
  <slot />
{/if}
