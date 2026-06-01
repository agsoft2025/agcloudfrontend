<script lang="ts">
  export let title: string;
  export let subtitle: string;
  export let eyebrow = 'AG Cloud';
</script>

<div class="auth-page" role="main">
  <div class="auth-shell">
    <aside class="brand-panel" aria-label="Product information">
      <header class="brand-header">
        <div class="brand-logo" aria-label="{eyebrow} home">
          <img class="brand-logo-image" src="/logo.png" alt={eyebrow} />
        </div>
      </header>

      <div class="brand-body">
        <p class="brand-kicker">Private Cloud Calling</p>
        <h2 class="brand-headline">
          The secure platform<br />
          <span class="brand-headline-accent">for team voice.</span>
        </h2>
        <p class="brand-desc">
          Enterprise-grade calling infrastructure with end-to-end session security, so only verified users can initiate and manage calls.
        </p>

        <ul class="feature-list" role="list">
          <li class="feature-item">
            <span class="feature-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2.5 7L5.5 10L11.5 4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span>Token-based session protection</span>
          </li>
          <li class="feature-item">
            <span class="feature-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2.5 7L5.5 10L11.5 4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span>Account recovery with verified email</span>
          </li>
          <li class="feature-item">
            <span class="feature-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2.5 7L5.5 10L11.5 4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span>Controlled access for every workspace</span>
          </li>
        </ul>
      </div>

      <div class="brand-illustration" aria-hidden="true">
        <img src="/authimg1.png" alt="" loading="eager" />
      </div>
    </aside>

    <div class="auth-card">
      <div class="auth-card-inner">
        <div class="mobile-brand" aria-hidden="true">
          <img class="brand-logo-image brand-logo-image--mobile" src="/logo.png" alt="" />
        </div>

        <header class="form-header">
          <h1 id="auth-title">{title}</h1>
          <p class="form-subtitle">{subtitle}</p>
        </header>

        <slot />
        <slot name="footer" />
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .auth-page {
    display: grid;
    place-items: center;
    min-block-size: 100dvh;
    background:
      radial-gradient(circle at 12% 14%, rgba(78, 135, 255, 0.12) 0, transparent 24rem),
      radial-gradient(circle at 88% 86%, rgba(44, 110, 99, 0.1) 0, transparent 24rem),
      linear-gradient(135deg, #f8fafc 0%, #eef5f4 100%);
    overflow: auto;
  }

  :global(html:has(.auth-page)),
  :global(body:has(.auth-page)) {
    min-block-size: 100%;
  }

  .auth-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.04fr) minmax(22rem, 0.86fr);
    inline-size: min(100%, 72rem);
    min-block-size: min(42rem, calc(100dvh - clamp(2rem, 6vw, 4rem)));
    overflow: hidden;
    border: 1px solid rgba(218, 226, 238, 0.92);
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: none;
    backdrop-filter: blur(18px);
  }

  /* Brand panel */
  .brand-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    justify-content: center;
    padding: clamp(1.5rem, 3vw, 2.5rem);
    background:
      linear-gradient(155deg, rgba(239, 246, 255, 0.98) 0%, rgba(248, 252, 255, 0.96) 48%, rgba(255, 255, 255, 0.94) 100%);
  }

  .brand-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 55% 45% at 85% 15%, rgba(78, 135, 255, 0.1) 0%, transparent 55%),
      radial-gradient(ellipse 40% 50% at 5% 90%, rgba(44, 110, 99, 0.08) 0%, transparent 55%);
    pointer-events: none;
  }

  .brand-header {
    position: relative;
    z-index: 1;
    margin-block-end: clamp(rem, 3vh, 2.25rem);
  }

  .brand-logo-image {
  height: clamp(60px, 8vh, 120px);
  width: auto;
}

  .brand-logo {
    display: inline-flex;
    align-items: center;
  }

  .brand-logo-image {
    display: block;
    inline-size: auto;
    block-size: 5rem;
    max-inline-size: 12rem;
    object-fit: contain;
  }

  .brand-body {
    position: relative;
    z-index: 1;
    display: grid;
    gap: clamp(0.8rem, 1.7vh, 1.2rem);
    margin-block: 0;
    max-inline-size: 34rem;
    min-block-size: 0;
  }

  .brand-kicker {
    margin: 0;
    color: #5b8fd4;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .brand-headline {
    margin: 0;
    color: #0f1923;
    font-size: clamp(1.9rem, 3vw, 2.75rem);
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.03em;
  }

  .brand-headline-accent {
    color: var(--color-secondary);
  }

  .brand-desc {
    margin: 0;
    max-inline-size: 65ch;
    color: #526173;
    font-size: 0.95rem;
    line-height: 1.65;
  }

  .feature-list {
    display: grid;
    gap: 0.7rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    color: #374151;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .feature-check {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border-radius: 999px;
    background: rgba(78, 135, 255, 0.12);
    color: var(--color-secondary);
    border: 1px solid rgba(78, 135, 255, 0.22);
  }

  .brand-illustration {
    position: relative;
    z-index: 1;
    inline-size: min(100%, 20rem);
    aspect-ratio: 16 / 9;
    margin-block-start: clamp(1.25rem, 3vh, 2rem);
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: none;
    overflow: hidden;
  }

  .brand-illustration img {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
    object-position: center;
  }

  /* Auth card */
  .auth-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 1), rgba(248, 250, 252, 0.84));
    padding: clamp(1.5rem, 3vw, 2.5rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .auth-card-inner {
    display: grid;
    gap: clamp(1rem, 2vh, 1.35rem);
    inline-size: min(100%, 25.5rem);
    margin-block: auto;
  }

  .mobile-brand {
    display: none;
    align-items: center;
  }

  .brand-logo-image--mobile {
    block-size: 2.5rem;
    max-inline-size: 10rem;
  }

  .form-header {
    display: grid;
    gap: 0.55rem;
  }

  h1 {
    margin: 0;
    color: #0f1923;
    font-size: clamp(1.85rem, 4vw, 2.35rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.12;
  }

  .form-subtitle {
    margin: 0;
    color: #526173;
    font-size: 0.95rem;
    line-height: 1.55;
  }

  /* Global helpers used by page-level components */
  :global(.auth-form) {
    display: grid;
    gap: 0.95rem;
  }

  :global(.auth-form-row) {
    display: flex;
    justify-content: flex-end;
    margin-block-start: -0.25rem;
    font-size: 0.875rem;
  }

  :global(.auth-footer) {
    margin: 0;
    padding-block-start: 0.25rem;
    color: #526173;
    font-size: 0.9rem;
    text-align: center;
    line-height: 1.55;
  }

  :global(.auth-card a) {
    color: var(--color-secondary);
    font-weight: 700;
    text-decoration: none;
    transition: color 120ms ease;
  }

  :global(.auth-card a:hover) {
    color: var(--color-secondary-hover);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :global(.auth-alert) {
    margin: 0;
    border-radius: var(--radius-md);
    padding: 0.8rem 1rem;
    font-size: 0.875rem;
    line-height: 1.5;
    font-weight: 500;
    animation: alert-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes alert-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  :global(.auth-alert[data-variant='error']) {
    border: 1px solid var(--color-error-border);
    background: var(--color-error-bg);
    color: var(--color-error);
  }

  :global(.auth-alert[data-variant='success']) {
    border: 1px solid var(--color-success-border);
    background: var(--color-success-bg);
    color: var(--color-success);
  }

  :global(.auth-card .password-field) {
    display: grid;
    gap: 0.5rem;
  }

  :global(.auth-card .button[data-variant='secondary']) {
    border-radius: 12px;
    box-shadow: none;
  }

  :global(.auth-card .button[data-variant='secondary']:hover:not(:disabled)) {
    box-shadow: none;
  }

  @media (max-height: 720px) {
    .auth-shell {
      min-block-size: auto;
    }

    .brand-panel {
      padding-block: 1.25rem;
    }

    .brand-header {
      margin-block-end: 1rem;
    }

    .brand-desc {
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .feature-list {
      gap: 0.5rem;
    }

    .brand-illustration {
      aspect-ratio: 16 / 9;
      margin-block-start: 1rem;
    }
  }

  /* Responsive */
  @media (max-width: 900px) {
    .auth-page {
      padding: clamp(1rem, 4vw, 1.5rem);
    }

    .auth-shell {
      grid-template-columns: 1fr;
      inline-size: min(100%, 32rem);
      min-block-size: auto;
      max-block-size: none;
      border-radius: 24px;
    }

    .brand-panel {
      display: none;
    }

    .auth-card {
      align-items: center;
      min-block-size: min(40rem, calc(100dvh - 2rem));
      padding: clamp(1.5rem, 5vw, 2rem);
      overflow: visible;
    }

    .auth-card-inner {
      margin-block: auto;
    }

    .mobile-brand {
      display: flex;
    }
  }

  @media (max-width: 900px) and (max-height: 700px) {
    .auth-page {
      place-items: start center;
    }

    .auth-card {
      align-items: flex-start;
      min-block-size: auto;
    }

    .auth-card-inner {
      margin-block: 0;
    }
  }

  @media (max-width: 480px) {
    .auth-page {
      padding: 0;
      background: #ffffff;
    }

    .auth-shell {
      inline-size: 100%;
      min-block-size: 100dvh;
      border: none;
      border-radius: 0;
      box-shadow: none;
    }

    .auth-card {
      min-block-size: 100dvh;
      padding: 1.35rem 1rem;
      background: #ffffff;
    }
  }
</style>
