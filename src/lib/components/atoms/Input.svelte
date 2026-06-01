<script lang="ts" context="module">
  export type InputType = 'text' | 'password' | 'email' | 'tel' | 'url';
  export type InputAutocomplete =
    | 'off' | 'on' | 'name' | 'username'
    | 'current-password' | 'new-password'
    | 'email' | 'tel' | 'url';
  export type LeadingIcon = 'email' | 'password' | 'user';
  export type InputAppearance = 'default' | 'auth';
</script>

<script lang="ts">
  export let id: string | undefined = undefined;
  export let name: string | undefined = undefined;
  export let label: string;
  export let type: InputType = 'text';
  export let value = '';
  export let placeholder = '';
  export let error: string | undefined = undefined;
  export let hint: string | undefined = undefined;
  export let disabled = false;
  export let required = false;
  export let autocomplete: InputAutocomplete | undefined = undefined;
  export let describedBy: string | undefined = undefined;
  export let leadingIcon: LeadingIcon | undefined = undefined;
  export let appearance: InputAppearance = 'default';

  const fieldId = id ?? `input-${Math.random().toString(36).slice(2, 9)}`;
  const isPassword = type === 'password';

  let showPassword = false;
  $: inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  $: errorId = error ? `${fieldId}-error` : undefined;
  $: hintId = hint ? `${fieldId}-hint` : undefined;
  $: ariaDescribedBy = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
</script>

<div
  class="field"
  class:appearance-auth={appearance === 'auth'}
  class:has-error={!!error}
  class:has-leading-icon={!!leadingIcon}
  class:has-toggle={isPassword}
>
  <label class="label" for={fieldId}>
    {label}
    {#if required}<span class="required" aria-hidden="true">*</span>{/if}
  </label>

  <div class="input-wrap">
    {#if leadingIcon}
      <span class="leading-icon" aria-hidden="true">
        {#if leadingIcon === 'email'}
          <svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16v12H4V6zm0 0l8 6 8-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else if leadingIcon === 'password'}
          <svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.75"/>
            <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        {:else if leadingIcon === 'user'}
          <svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75"/>
            <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        {/if}
      </span>
    {/if}

    <input
      class="input"
      id={fieldId}
      {name}
      type={inputType}
      bind:value
      {placeholder}
      {disabled}
      {required}
      {autocomplete}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={ariaDescribedBy}
      on:input
      on:change
      on:focus
      on:blur
      on:keydown
    />

    {#if isPassword}
      <button
        type="button"
        class="toggle-visibility"
        tabindex="-1"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        on:click={() => (showPassword = !showPassword)}
      >
        {#if showPassword}
          <svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        {:else}
          <svg class="icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
          </svg>
        {/if}
      </button>
    {/if}
  </div>

  <div class="field-message" aria-live="polite">
    {#if hint && !error}
      <p class="hint" id={hintId}>{hint}</p>
    {:else if error}
      <p class="error-msg" id={errorId} role="alert">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
          <path d="M7 4v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="7" cy="10" r="0.75" fill="currentColor"/>
        </svg>
        <span>{error}</span>
      </p>
    {/if}
  </div>
</div>

<style lang="postcss">
  .field {
    --control-height: 2.875rem;
    --icon-gutter: 2.875rem;
    --icon-color: #9ca3af;
    --field-label-gap: 0.375rem;
    --field-message-gap: 0.375rem;
    display: grid;
    grid-template-rows: auto auto auto;
    row-gap: var(--field-label-gap);
  }

  .field-message {
    margin-block-start: calc(var(--field-message-gap) - var(--field-label-gap));
  }

  .field.appearance-auth {
    --control-height: 3rem;
    --icon-gutter: 3rem;
    --field-label-gap: 0.375rem;
    --field-message-gap: 0.25rem;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    margin: 0;
    color: var(--color-text-secondary);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .appearance-auth .label {
    color: #0f1923;
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .required { color: var(--color-error); font-size: 0.9em; }

  .input-wrap {
    position: relative;
    display: block;
    block-size: var(--control-height);
    inline-size: 100%;
  }

  .leading-icon,
  .toggle-visibility {
    position: absolute;
    inset-block: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--icon-gutter);
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .leading-icon {
    inset-inline-start: 0;
    color: var(--icon-color);
    pointer-events: none;
    z-index: 1;
  }

  .icon-svg { display: block; flex-shrink: 0; }

  .input {
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 400;
    line-height: 1.25;
    padding-block: 0;
    padding-inline: 0.875rem;
    transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
  }

  .has-leading-icon .input { padding-inline-start: var(--icon-gutter) !important; }
  .has-toggle .input { padding-inline-end: var(--icon-gutter) !important; }
  .has-leading-icon:not(.has-toggle) .input { padding-inline-end: 0.875rem !important; }

  /* Pico applies padding + invalid icon; keep our layout */
  .input[aria-invalid] {
    background-image: none !important;
    background-position: unset !important;
    background-size: unset !important;
    background-repeat: unset !important;
  }

  .has-leading-icon .input[aria-invalid] { padding-inline-start: var(--icon-gutter) !important; }
  .has-toggle .input[aria-invalid] { padding-inline-end: var(--icon-gutter) !important; }
  .has-leading-icon:not(.has-toggle) .input[aria-invalid] { padding-inline-end: 0.875rem !important; }

  .appearance-auth .input {
    border: 1px solid transparent;
    border-radius: 10px;
    background: #eef3f9;
  }

  .appearance-auth .input:hover:not(:disabled) { background: #e8eef6; }

  .appearance-auth .input:focus {
    border-color: var(--color-secondary);
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(78, 135, 255, 0.14);
  }

  .input::placeholder { color: var(--color-subtle); opacity: 1; }
  .input:hover:not(:disabled) { border-color: var(--color-border-strong); }

  .input:focus {
    border-color: var(--color-secondary);
    outline: none;
    box-shadow: 0 0 0 3px rgba(78, 135, 255, 0.15), 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .input:disabled { cursor: not-allowed; opacity: 0.55; background: var(--color-surface-raised); }

  .has-error .input { border-color: var(--color-error); background: rgba(220, 38, 38, 0.02); }
  .appearance-auth.has-error .input { background: #fef8f8; }

  .has-error .input:focus {
    border-color: var(--color-error);
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .toggle-visibility {
    inset-inline-end: 0;
    border: none;
    background: transparent;
    color: var(--icon-color);
    cursor: pointer;
    border-radius: var(--radius-sm);
    z-index: 1;
    transition: color 120ms ease;
  }

  .toggle-visibility:hover { color: var(--color-muted); }
  .toggle-visibility:focus-visible { outline: 2px solid var(--color-secondary); outline-offset: 1px; }

  .hint { margin: 0; color: var(--color-subtle); font-size: 0.8125rem; line-height: 1.35; }

  .error-msg {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    margin: 0;
    color: var(--color-error);
    font-size: 0.8125rem;
    line-height: 1.35;
    font-weight: 500;
    animation: err-in 0.15s ease both;
  }

  .error-msg > svg { flex-shrink: 0; margin-block-start: 0.1rem; }

  @keyframes err-in {
    from { opacity: 0; transform: translateY(-3px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
