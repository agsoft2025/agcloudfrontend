<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';

  // Re-read persisted session from localStorage on every page mount.
  // Keeps auth state accurate after a hard refresh.
  onMount(() => {
    authStore.initialize();
  });
</script>

<slot />
