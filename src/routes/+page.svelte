<script lang="ts">
  const title = 'AG Cloud Frontend';
</script>

<svelte:head>
  <title>{title}</title>
  <meta
    name="description"
    content="SvelteKit application scaffolded with TypeScript strict mode."
  />
</svelte:head>

<main>
  <section>
    <p>SvelteKit</p>
    <h1>{title}</h1>
    <span>TypeScript strict mode is enabled.</span>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
    color: #172026;
    background: #f7faf9;
  }

  main {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  section {
    display: grid;
    gap: 0.75rem;
    max-width: 44rem;
  }

  p,
  h1 {
    margin: 0;
  }

  p {
    color: #2c6e63;
    font-size: 0.875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h1 {
    font-size: clamp(2.5rem, 8vw, 5rem);
    line-height: 1;
  }

  span {
    color: #53646f;
    font-size: 1.125rem;
  }
</style>
