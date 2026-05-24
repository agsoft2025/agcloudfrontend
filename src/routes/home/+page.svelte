<script lang="ts">
  import CallWorkspace from '$lib/components/calls/CallWorkspace.svelte';
  import HomeSidebar, {
    type HomeSection,
    type HomeSidebarItem
  } from '$lib/components/home/HomeSidebar.svelte';

  const sidebarItems: HomeSidebarItem[] = [
    {
      id: 'one-to-one',
      label: 'One-to-One Call',
      description: 'Direct call with a single user'
    }
  ];

  let selectedSection: HomeSection = 'one-to-one';
</script>

<svelte:head>
  <title>Home | AG Cloud</title>
  <meta name="description" content="Manage AG Cloud calls." />
</svelte:head>

<main class="home-page">
  <HomeSidebar items={sidebarItems} bind:selected={selectedSection} />

  <section class="main-content" aria-live="polite">
    <CallWorkspace />
  </section>
</main>

<style lang="postcss">
  .home-page {
    min-block-size: 100vh;
    display: grid;
    grid-template-columns: 21rem minmax(0, 1fr);
    background:
      radial-gradient(circle at 85% 8%, color-mix(in srgb, var(--color-secondary) 12%, transparent), transparent 28rem),
      linear-gradient(135deg, #f5f9fc 0%, #eef7f5 100%);
  }

  .main-content {
    min-inline-size: 0;
    padding: clamp(1rem, 3vw, 2rem);
  }

  @media (max-width: 760px) {
    .home-page {
      grid-template-columns: 1fr;
    }
  }
</style>
