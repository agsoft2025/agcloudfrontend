<script lang="ts">
  export let title: string;
  export let subtitle: string;
  export let eyebrow = 'AG Cloud';
</script>

<div class="auth-page" role="main">
  <div class="bg-canvas" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="orb orb-4"></div>
  </div>

  <div class="auth-shell">
    <!-- Left: Brand panel -->
    <aside class="brand-panel" aria-label="Product information">
      <header class="brand-header">
        <div class="brand-logo" aria-label="{eyebrow} home">
          <svg class="logo-icon" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M4.5 6.5C4.5 5.12 5.62 4 7 4H15C16.38 4 17.5 5.12 17.5 6.5C17.5 7.88 16.38 9 15 9H13L9.5 12.5V9H7C5.62 9 4.5 7.88 4.5 6.5Z" fill="currentColor" opacity="0.9"/>
            <circle cx="16" cy="16" r="4.5" fill="currentColor" opacity="0.4"/>
            <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
          </svg>
          <span class="logo-wordmark">{eyebrow}</span>
        </div>
      </header>

      <div class="brand-body">
        <p class="brand-kicker">Private Cloud Calling</p>
        <h2 class="brand-headline">The secure platform<br />for team voice.</h2>
        <p class="brand-desc">
          Enterprise-grade calling infrastructure with end-to-end session security, so only verified users can initiate and manage calls.
        </p>

        <ul class="feature-list" role="list">
          <li class="feature-item">
            <span class="feature-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span>Token-based session protection</span>
          </li>
          <li class="feature-item">
            <span class="feature-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span>Account recovery with verified email</span>
          </li>
          <li class="feature-item">
            <span class="feature-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span>Controlled access for every workspace</span>
          </li>
        </ul>
      </div>

      <div class="brand-deco" aria-hidden="true">
        <div class="deco-ring r1"></div>
        <div class="deco-ring r2"></div>
        <div class="deco-ring r3"></div>
        <div class="deco-dots">
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    </aside>

    <!-- Right: Auth card -->
    <div class="auth-card">
      <div class="mobile-brand" aria-hidden="true">
        <svg class="logo-icon" width="18" height="18" viewBox="0 0 22 22" fill="none">
          <path d="M4.5 6.5C4.5 5.12 5.62 4 7 4H15C16.38 4 17.5 5.12 17.5 6.5C17.5 7.88 16.38 9 15 9H13L9.5 12.5V9H7C5.62 9 4.5 7.88 4.5 6.5Z" fill="currentColor" opacity="0.9"/>
          <circle cx="16" cy="16" r="4.5" fill="currentColor" opacity="0.4"/>
          <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
        </svg>
        <span>{eyebrow}</span>
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

<style lang="postcss">
  .auth-page {
    position: relative;
    min-block-size: 100dvh;
    display: grid;
    place-items: center;
    padding: clamp(1rem, 3vw, 2rem);
    overflow: hidden;
    background: #0d1117;
  }

  /* Background orbs */
  .bg-canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }

  .orb {
    position: absolute;
    border-radius: 999px;
    filter: blur(80px);
    will-change: transform;
  }

  .orb-1 {
    inline-size: 600px; block-size: 600px;
    inset-block-start: -200px; inset-inline-start: -150px;
    background: radial-gradient(circle, rgba(30,58,95,0.9) 0%, transparent 70%);
    animation: float-orb 18s ease-in-out infinite;
  }

  .orb-2 {
    inline-size: 500px; block-size: 500px;
    inset-block-end: -150px; inset-inline-end: -100px;
    background: radial-gradient(circle, rgba(26,44,74,0.8) 0%, transparent 70%);
    animation: float-orb 22s ease-in-out infinite reverse;
  }

  .orb-3 {
    inline-size: 400px; block-size: 400px;
    inset-block-start: 40%; inset-inline-start: 35%;
    background: radial-gradient(circle, rgba(44,26,74,0.7) 0%, transparent 70%);
    animation: float-orb 26s ease-in-out infinite 3s;
  }

  .orb-4 {
    inline-size: 350px; block-size: 350px;
    inset-block-start: 15%; inset-inline-end: 15%;
    background: radial-gradient(circle, rgba(15,61,74,0.7) 0%, transparent 70%);
    animation: float-orb 20s ease-in-out infinite 6s reverse;
  }

  @keyframes float-orb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%       { transform: translate(30px, -40px) scale(1.05); }
    66%       { transform: translate(-20px, 25px) scale(0.97); }
  }

  /* Shell */
  .auth-shell {
    position: relative;
    z-index: 1;
    inline-size: min(100%, 68rem);
    display: grid;
    grid-template-columns: minmax(20rem, 1.1fr) minmax(22rem, 28rem);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.06),
      0 40px 80px -20px rgba(0,0,0,0.5),
      0 0 120px -40px rgba(78,135,255,0.12);
    animation: shell-enter 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }

  @keyframes shell-enter {
    from { opacity: 0; transform: translateY(20px) scale(0.99); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Brand panel */
  .brand-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: linear-gradient(148deg, #0d1f3c 0%, #112244 25%, #0d2d3a 55%, #1a2040 80%, #0d1830 100%);
    padding: clamp(2rem, 4vw, 3rem);
  }

  .brand-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 80% 20%, rgba(78,135,255,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 50% 60% at 10% 80%, rgba(44,110,99,0.15) 0%, transparent 60%);
    pointer-events: none;
  }

  .brand-header { position: relative; z-index: 1; }

  .brand-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
  }

  .logo-icon { color: #7ecfff; flex-shrink: 0; }

  .logo-wordmark {
    color: rgba(255,255,255,0.92);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .brand-body {
    position: relative;
    z-index: 1;
    display: grid;
    gap: var(--space-lg);
    margin-block: clamp(2.5rem, 6vw, 4rem) auto;
  }

  .brand-kicker {
    margin: 0;
    color: rgba(126,207,255,0.7);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .brand-headline {
    margin: 0;
    color: #ffffff;
    font-size: clamp(2rem, 4.5vw, 3.25rem);
    font-weight: 800;
    line-height: 1.06;
    letter-spacing: -0.03em;
  }

  .brand-desc {
    margin: 0;
    max-inline-size: 30ch;
    color: rgba(255,255,255,0.52);
    font-size: 0.95rem;
    line-height: 1.65;
  }

  .feature-list {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    color: rgba(255,255,255,0.75);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .feature-check {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    inline-size: 1.4rem;
    block-size: 1.4rem;
    border-radius: 999px;
    background: rgba(126,207,255,0.1);
    color: #7ecfff;
    border: 1px solid rgba(126,207,255,0.2);
  }

  /* Decorative rings */
  .brand-deco {
    position: absolute;
    inset-block-end: -4rem;
    inset-inline-end: -4rem;
    inline-size: 22rem;
    block-size: 22rem;
    pointer-events: none;
    z-index: 0;
  }

  .deco-ring { position: absolute; inset: 0; border-radius: 999px; }
  .r1 { border: 1px solid rgba(255,255,255,0.05); }
  .r2 { inset: 2.5rem; border: 1px solid rgba(78,135,255,0.08); }
  .r3 { inset: 5rem; border: 1px solid rgba(78,135,255,0.06); }

  .deco-dots {
    position: absolute;
    inset: 4rem;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(4, 1fr);
    gap: 0.6rem;
    place-items: center;
  }

  .deco-dots span {
    inline-size: 3px;
    block-size: 3px;
    border-radius: 999px;
    background: rgba(255,255,255,0.1);
  }

  /* Auth card */
  .auth-card {
    display: grid;
    align-content: center;
    gap: var(--space-xl);
    background: #ffffff;
    padding: clamp(2rem, 5vw, 3.25rem);
  }

  .mobile-brand {
    display: none;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-primary);
    font-size: 0.95rem;
    font-weight: 700;
  }

  .mobile-brand .logo-icon { color: var(--color-secondary); }

  .form-header { display: grid; gap: 0.4rem; }

  h1 {
    margin: 0;
    color: var(--color-text);
    font-size: clamp(1.6rem, 5vw, 2.1rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .form-subtitle {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.95rem;
    line-height: 1.5;
  }

  /* Global helpers used by page-level components */
  :global(.auth-form) {
    display: grid;
    gap: var(--space-md);
  }

  :global(.auth-form-row) {
    display: flex;
    justify-content: flex-end;
    font-size: 0.875rem;
  }

  :global(.auth-footer) {
    margin: 0;
    border-block-start: 1px solid var(--color-border);
    padding-block-start: var(--space-lg);
    color: var(--color-muted);
    font-size: 0.9rem;
    text-align: center;
    line-height: 1.5;
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
    animation: alert-in 0.2s cubic-bezier(0.16,1,0.3,1) both;
  }

  @keyframes alert-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
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

  /* Responsive */
  @media (max-width: 800px) {
    .auth-page { padding: 0; background: #ffffff; }
    .bg-canvas { display: none; }
    .auth-shell {
      inline-size: 100%;
      min-block-size: 100dvh;
      grid-template-columns: 1fr;
      border-radius: 0;
      box-shadow: none;
    }
    .brand-panel { display: none; }
    .auth-card { align-content: start; padding: 2.5rem 1.5rem; }
    .mobile-brand { display: flex; }
  }

  @media (max-width: 480px) {
    .auth-card { padding: 2rem 1.25rem; }
  }
</style>
