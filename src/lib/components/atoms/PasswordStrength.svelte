<script lang="ts">
  export let password: string;

  const LEVELS = [
    { label: '',       color: '' },
    { label: 'Weak',   color: '#dc2626' },
    { label: 'Fair',   color: '#d97706' },
    { label: 'Good',   color: '#2563eb' },
    { label: 'Strong', color: '#16a34a' },
  ] as const;

  function getScore(pw: string): number {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
  }

  $: score = getScore(password);
  $: info = LEVELS[score];
  const bars = [1, 2, 3, 4];
</script>

{#if password.length > 0}
  <div
    class="strength-meter"
    aria-live="polite"
    aria-label="Password strength: {info.label}"
  >
    <div class="bars" role="presentation">
      {#each bars as bar}
        <div
          class="bar"
          class:filled={score >= bar}
          style="background-color: {score >= bar ? info.color : ''}"
        ></div>
      {/each}
    </div>
    {#if info.label}
      <span class="strength-label" style="color: {info.color}">{info.label}</span>
    {/if}
  </div>
{/if}

<style lang="postcss">
  .strength-meter {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    animation: fade-in 0.2s var(--ease-out) both;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .bars {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .bar {
    flex: 1;
    block-size: 3px;
    border-radius: 999px;
    background: var(--color-border);
    transition: background-color 0.25s var(--ease-in-out);
  }

  .strength-label {
    font-size: 0.75rem;
    font-weight: 700;
    min-inline-size: 3.5rem;
    text-align: right;
    transition: color 0.2s ease;
  }
</style>
