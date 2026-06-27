<!--
  /settings/profile — Profile settings page (redesigned)
  ========================================================
  Script is unchanged. Only the template layout and styles
  have been updated for a wider, more professional appearance.
-->
<script lang="ts">
  import { z } from 'zod';
  import { authStore } from '$lib/stores/auth.store';
  import { userStore } from '$lib/stores/user.store';
  import { toastStore } from '$lib/stores/toast.store';
  import { updateProfile } from '$lib/api/user.api';
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import Input from '$lib/components/atoms/Input.svelte';

  // ── Schema ───────────────────────────────────────────────────────────────────

  const profileSchema = z.object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters.')
      .max(50, 'Display name must be at most 50 characters.'),
  });

  type ProfileForm = z.infer<typeof profileSchema>;
  type FieldErrors = Partial<Record<keyof ProfileForm, string>>;

  // ── State ────────────────────────────────────────────────────────────────────

  let form: ProfileForm = {
    displayName: $authStore.user?.displayName ?? '',
  };
  let errors: FieldErrors = {};
  let isSubmitting = false;

  let avatarPreview: string | null = null;
  let avatarDataUrl: string | null = null;
  let fileInputEl: HTMLInputElement;

  $: if ($authStore.user && !form.displayName) {
    form.displayName = $authStore.user.displayName ?? '';
  }

  $: currentAvatarSrc = avatarPreview ?? $authStore.user?.avatarUrl ?? undefined;
  $: currentDisplayName = form.displayName || $authStore.user?.displayName || '';

  // ── Avatar upload ────────────────────────────────────────────────────────────

  function handleAvatarClick() {
    fileInputEl.click();
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toastStore.error('Please select an image file.');
      return;
    }

    const MAX_SIZE_MB = 2;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toastStore.error(`Avatar must be under ${MAX_SIZE_MB} MB.`);
      return;
    }

    avatarPreview = URL.createObjectURL(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      avatarDataUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  function validateForm(): ProfileForm | null {
    const result = profileSchema.safeParse(form);
    errors = {};

    if (result.success) {
      form = result.data;
      return result.data;
    }

    errors = result.error.issues.reduce<FieldErrors>((acc, issue) => {
      const field = issue.path[0] as keyof ProfileForm;
      if (!acc[field]) acc[field] = issue.message;
      return acc;
    }, {});

    return null;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const payload = validateForm();
    if (!payload) return;

    isSubmitting = true;
    try {
      const updated = await updateProfile({
        displayName: payload.displayName,
        ...(avatarDataUrl ? { avatarUrl: avatarDataUrl } : {}),
      });

      authStore.setUser(updated);
      if (updated.id) userStore.setProfile(updated);

      if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
      avatarPreview = null;
      avatarDataUrl = null;

      toastStore.success('Profile updated.');
    } catch (err) {
      toastStore.error(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Profile | AG Cloud</title>
</svelte:head>

<div class="profile-page">

  <!-- ── Page heading ──────────────────────────────────────────────────────────── -->
  <header class="page-header">
    <h1 class="page-title">Profile</h1>
    <p class="page-subtitle">Manage your public identity and account details.</p>
  </header>

  <!-- ── Profile card ──────────────────────────────────────────────────────────── -->
  <div class="profile-card">

    <!-- ── Hero: avatar + identity ──────────────────────────────────────────────── -->
    <div class="hero">
      <!-- Avatar button -->
      <button
        class="avatar-wrap"
        type="button"
        aria-label="Change profile photo"
        title="Click to change photo"
        disabled={isSubmitting}
        on:click={handleAvatarClick}
      >
        <span class="avatar-ring" aria-hidden="true">
          <Avatar src={currentAvatarSrc} name={currentDisplayName} size="lg" />
        </span>

        <!-- Upload overlay — appears on hover / focus -->
        <span class="avatar-overlay" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.25"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span class="overlay-label">Change</span>
        </span>
      </button>

      <!-- Hidden file input -->
      <input
        bind:this={fileInputEl}
        type="file"
        accept="image/*"
        class="sr-only"
        aria-hidden="true"
        tabindex="-1"
        on:change={handleFileChange}
      />

      <!-- Identity summary -->
      <div class="hero-identity">
        <p class="hero-name">{currentDisplayName || 'Your name'}</p>
        <p class="hero-email">{$authStore.user?.email ?? ''}</p>
        <p class="hero-hint">
          {#if avatarPreview}
            <span class="hint-pending">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              New photo selected — save to apply
            </span>
          {:else}
            JPG, PNG or GIF · max 2 MB
          {/if}
        </p>
      </div>
    </div>

    <!-- ── Divider ────────────────────────────────────────────────────────────── -->
    <hr class="card-divider" aria-hidden="true" />

    <!-- ── Fields section ───────────────────────────────────────────────────────── -->
    <form class="fields-section" on:submit|preventDefault={handleSubmit} novalidate>

      <div class="section-header">
        <h2 class="section-title">Personal information</h2>
        <p class="section-subtitle">This information is visible to your contacts.</p>
      </div>

      <div class="field-grid">
        <!-- Display name — editable -->
        <div class="field-col">
          <Input
            id="displayName"
            name="displayName"
            label="Display name"
            type="text"
            leadingIcon="user"
            bind:value={form.displayName}
            error={errors.displayName}
            placeholder="Your display name"
            required
            disabled={isSubmitting}
            on:input={() => (errors.displayName = undefined)}
          />
        </div>

        <!-- Email — read-only display -->
        <div class="field-col">
          <div class="readonly-field" role="group" aria-labelledby="email-label">
            <span class="readonly-label" id="email-label">Email address</span>
            <div class="readonly-value-wrap">
              <span class="readonly-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16v12H4V6zm0 0l8 6 8-6"
                    stroke="currentColor" stroke-width="1.75"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="readonly-value">{$authStore.user?.email ?? ''}</span>
              <span class="readonly-badge" aria-label="Email cannot be changed">Locked</span>
            </div>
            <p class="readonly-hint">Contact support to change your email address.</p>
          </div>
        </div>
      </div>

      <!-- ── Action bar ─────────────────────────────────────────────────────────── -->
      <div class="action-bar">
        <p class="action-hint" aria-live="polite">
          {#if isSubmitting}Saving changes…{/if}
        </p>
        <Button type="submit" variant="secondary" size="md" loading={isSubmitting}>
          Save changes
        </Button>
      </div>

    </form>
  </div>
</div>

<style lang="postcss">
  /* ── Page shell ─────────────────────────────────────────────────────────────── */

  .profile-page {
    /* Wider breathing room — 720px vs. the old 520px */
    max-inline-size: 720px;
    margin-inline: auto;
    padding: 2.5rem 2rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* ── Page heading ───────────────────────────────────────────────────────────── */

  .page-header {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .page-title {
    margin: 0;
    font-size: 1.625rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-muted);
    line-height: 1.5;
  }

  /* ── Card ───────────────────────────────────────────────────────────────────── */

  .profile-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    /* Subtle lift in light mode */
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.06),
      0 1px 2px rgba(0, 0, 0, 0.04);
    overflow: hidden;
  }

  /* ── Hero ───────────────────────────────────────────────────────────────────── */

  .hero {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem 2rem 1.75rem;
    background: var(--color-surface-raised);
  }

  /* Avatar button */
  .avatar-wrap {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    border-radius: 999px;
    /* Large avatar override */
    --avatar-size: 5.5rem;
    --avatar-font-size: 1.625rem;
  }

  .avatar-ring {
    display: block;
    border-radius: 999px;
    /* Ring that pops on hover */
    transition: box-shadow 160ms ease;
  }

  .avatar-wrap:hover:not(:disabled) .avatar-ring,
  .avatar-wrap:focus-visible .avatar-ring {
    box-shadow:
      0 0 0 3px var(--color-surface),
      0 0 0 5px var(--color-secondary);
  }

  .avatar-wrap:focus-visible {
    outline: none;
  }

  .avatar-wrap:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  /* Camera overlay */
  .avatar-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    background: rgba(15, 25, 35, 0.58);
    border-radius: 999px;
    color: #ffffff;
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
    backdrop-filter: blur(1px);
  }

  .avatar-wrap:hover:not(:disabled) .avatar-overlay,
  .avatar-wrap:focus-visible .avatar-overlay {
    opacity: 1;
  }

  .overlay-label {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    line-height: 1;
  }

  /* Identity text */
  .hero-identity {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-inline-size: 0;
  }

  .hero-name {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.015em;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hero-email {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-muted);
    line-height: 1.4;
  }

  .hero-hint {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    line-height: 1.4;
  }

  .hint-pending {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--color-secondary);
    font-weight: 500;
  }

  /* ── Divider ────────────────────────────────────────────────────────────────── */

  .card-divider {
    block-size: 1px;
    border: none;
    background: var(--color-border);
    margin: 0;
  }

  /* ── Fields section ─────────────────────────────────────────────────────────── */

  .fields-section {
    padding: 1.75rem 2rem 0;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .section-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.01em;
    line-height: 1.3;
  }

  .section-subtitle {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    line-height: 1.5;
  }

  /* Two-column field grid on wider screens */
  .field-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.25rem 1.5rem;
  }

  .field-col {
    display: flex;
    flex-direction: column;
  }

  /* ── Read-only field ────────────────────────────────────────────────────────── */

  .readonly-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .readonly-label {
    display: block;
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    line-height: 1.25;
  }

  .readonly-value-wrap {
    position: relative;
    display: flex;
    align-items: center;
    block-size: 2.875rem;
    padding-inline: 0.875rem 0.875rem;
    padding-inline-start: 2.875rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    gap: 0.5rem;
  }

  .readonly-icon {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.875rem;
    color: var(--color-subtle);
    pointer-events: none;
  }

  .readonly-value {
    flex: 1;
    min-inline-size: 0;
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    color: var(--color-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .readonly-badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 0.15em 0.5em;
    border-radius: 4px;
    background: var(--color-border);
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .readonly-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-subtle);
    line-height: 1.4;
  }

  /* ── Action bar ─────────────────────────────────────────────────────────────── */

  .action-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.25rem 0 1.75rem;
    border-block-start: 1px solid var(--color-border);
    margin-block-start: 0.25rem;
  }

  .action-hint {
    flex: 1;
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    font-style: italic;
    min-block-size: 1.25rem; /* prevent layout shift */
  }

  /* ── Accessibility ──────────────────────────────────────────────────────────── */

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  /* ── Responsive ─────────────────────────────────────────────────────────────── */

  @media (max-width: 640px) {
    .profile-page {
      padding: 1.5rem 1rem 2rem;
      gap: 1.5rem;
    }

    .hero {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.5rem 1.25rem 1.25rem;
    }

    .hero-name { font-size: 1.125rem; }

    .fields-section {
      padding: 1.25rem 1.25rem 0;
      gap: 1.25rem;
    }

    /* Single column on mobile */
    .field-grid {
      grid-template-columns: 1fr;
    }

    .action-bar {
      padding-block-end: 1.25rem;
    }
  }

  @media (min-width: 641px) and (max-width: 900px) {
    .profile-page {
      padding: 2rem 1.5rem;
    }
  }
</style>
