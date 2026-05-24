<script lang="ts">
  export let title: string;
  export let subtitle: string;
  export let eyebrow = 'AG Cloud';
</script>

<main class="auth-page">
  <section class="auth-shell" aria-labelledby="auth-title">
    <aside class="security-copy" aria-label="Security information">
      <p class="security-kicker">Secure access</p>
      <h2>Built for private cloud calling</h2>
      <p>
        AG Cloud protects account access before every call action, so only verified users can start,
        accept, or manage sessions.
      </p>

      <ul class="security-list">
        <li>Token-based session protection</li>
        <li>Account recovery with verified email flow</li>
        <li>Controlled access for every call workspace</li>
      </ul>
    </aside>

    <div class="auth-panel">
      <header class="header">
        <p class="eyebrow">{eyebrow}</p>
        <h1 id="auth-title">{title}</h1>
        <p class="subtitle">{subtitle}</p>
      </header>

      <slot />

      <slot name="footer" />
    </div>
  </section>
</main>

<style lang="postcss">
  .auth-page {
    min-block-size: 100vh;
    display: grid;
    place-items: center;
    background:
      linear-gradient(135deg, #d8f0eb 0%, #e8f1ff 48%, #dfe7f7 100%);
    padding: clamp(1rem, 4vw, 2.5rem);
  }

  .auth-shell {
    inline-size: min(100%, 64rem);
    display: grid;
    grid-template-columns: minmax(18rem, 1fr) minmax(22rem, 29rem);
    align-items: stretch;
  }

  .eyebrow,
  .security-kicker,
  .security-copy h2,
  .security-copy p,
  h1,
  .subtitle,
  :global(.auth-footer),
  :global(.auth-alert) {
    margin: 0;
  }

  .security-copy {
    display: grid;
    align-content: center;
    gap: var(--space-md);
    min-block-size: 100%;
    border-radius: var(--radius-md);
    background: linear-gradient(160deg, #20324f 0%, #245366 50%, #2c6e63 100%);
    color: var(--color-surface);
    padding: clamp(1.5rem, 4vw, 2.5rem);
  }

  .security-kicker {
    color: rgb(255 255 255 / 72%);
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .security-copy h2 {
    color: var(--color-surface);
    font-size: clamp(2.4rem, 6vw, 4.25rem);
    line-height: 1;
  }

  .security-copy p {
    max-inline-size: 28rem;
    color: rgb(255 255 255 / 76%);
    font-size: 1.05rem;
    line-height: 1.6;
  }

  .security-list {
    display: grid;
    gap: var(--space-sm);
    margin: var(--space-sm) 0 0;
    padding: 0;
    list-style: none;
  }

  .security-list li {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--color-surface);
    font-weight: 700;
  }

  .security-list li::before {
    content: '';
    flex: 0 0 auto;
    inline-size: 0.55rem;
    block-size: 0.55rem;
    border-radius: 999px;
    background: #7df2bd;
    box-shadow: 0 0 0 0.3rem rgb(125 242 189 / 18%);
  }

  .auth-panel {
    display: grid;
    align-content: center;
    gap: var(--space-lg);
    min-block-size: 100%;
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: clamp(1.5rem, 5vw, 3rem);
  }

  .header {
    display: grid;
    gap: var(--space-sm);
  }

  .eyebrow {
    color: var(--color-tertiary);
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    color: var(--color-text);
    font-size: clamp(2rem, 7vw, 3rem);
    line-height: 1.04;
  }

  .subtitle,
  :global(.auth-footer) {
    color: var(--color-muted);
    line-height: 1.5;
  }

  :global(.auth-form) {
    display: grid;
    gap: var(--space-md);
  }

  :global(.auth-form-row) {
    display: flex;
    justify-content: flex-end;
    font-size: 0.925rem;
  }

  :global(.auth-footer) {
    border-block-start: 1px solid var(--color-border);
    padding-block-start: var(--space-lg);
    text-align: center;
  }

  :global(.auth-panel a) {
    color: var(--color-secondary);
    font-weight: 800;
    text-decoration: none;
  }

  :global(.auth-panel a:hover) {
    text-decoration: underline;
  }

  :global(.auth-alert) {
    border-radius: var(--radius-md);
    padding: var(--space-md);
    line-height: 1.4;
  }

  :global(.auth-alert[data-variant='error']) {
    border: 1px solid color-mix(in srgb, #b42318 30%, transparent);
    background: color-mix(in srgb, #b42318 8%, var(--color-surface));
    color: #b42318;
  }

  :global(.auth-alert[data-variant='success']) {
    border: 1px solid color-mix(in srgb, var(--color-tertiary) 30%, transparent);
    background: color-mix(in srgb, var(--color-tertiary) 8%, var(--color-surface));
    color: var(--color-tertiary);
  }

  @media (max-width: 760px) {
    .auth-page {
      padding: var(--space-md);
    }

    .auth-shell {
      inline-size: 100%;
      grid-template-columns: 1fr;
      gap: var(--space-lg);
    }

    .security-copy {
      max-inline-size: none;
    }

    .security-copy h2 {
      font-size: 2.2rem;
    }

    .auth-panel {
      align-content: start;
    }
  }
</style>
