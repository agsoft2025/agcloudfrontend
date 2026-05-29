<script lang="ts" context="module">
  export type InputType = 'text' | 'password' | 'email' | 'tel' | 'url';
  export type InputAutocomplete =
    | 'off' | 'on' | 'name' | 'username'
    | 'current-password' | 'new-password'
    | 'email' | 'tel' | 'url';
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

  const fieldId = id ?? `input-${Math.random().toString(36).slice(2, 9)}`;
  const isPassword = type === 'password';

  let showPassword = false;
  $: inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  $: errorId = error ? `${fieldId}-error` : undefined;
  $: hintId = hint ? `${fieldId}-hint` : undefined;
  $: ariaDescribedBy = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
</script>

<div class="field" class:has-error={!!error}>
  <label class="label" for={fieldId}>
    {label}
    {#if required}<span class="required" aria-hidden="true">*</span>{/if}
  </label>

  <div class="input-wrap" class:has-toggle={isPassword}>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
          </svg>
        {/if}
      </button>
    {/if}
  </div>

  {#if hint && !error}
    <p class="hint" id={hintId}>{hint}</p>
  {/if}

  {#if error}
    <p class="error-msg" id={errorId} role="alert">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
        <path d="M7 4v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="7" cy="10" r="0.75" fill="currentColor"/>
      </svg>
      {error}
    </p>
  {/if}
</div>

<style lang="postcss">
  .field { display: grid; gap: 0.35rem; }

  .label {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    color: var(--color-text-secondary);
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .required { color: var(--color-error); font-size: 0.9em; }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input {
    inline-size: 100%;
    min-block-size: 2.875rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    line-height: 1.4;
    padding: 0 var(--space-md);
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease,
      background-color 180ms ease;
  }

  .has-toggle .input { padding-inline-end: 2.75rem; }

  .input::placeholder { color: var(--color-subtle); }

  .input:hover:not(:disabled) { border-color: var(--color-border-strong); }

  .input:focus {
    border-color: var(--color-secondary);
    outline: none;
    box-shadow: 0 0 0 3px rgba(78,135,255,0.15), 0 1px 2px rgba(0,0,0,0.04);
  }

  .input:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    background: var(--color-surface-raised);
  }

  .has-error .input { border-color: var(--color-error); background: rgba(220,38,38,0.02); }

  .has-error .input:focus {
    border-color: var(--color-error);
    box-shadow: 0 0 0 3px rgba(220,38,38,0.12), 0 1px 2px rgba(0,0,0,0.04);
  }

  .toggle-visibility {
    position: absolute;
    inset-inline-end: 0.75rem;
    display: grid;
    place-items: center;
    padding: 0.25rem;
    border: none;
    background: transparent;
    color: var(--color-subtle);
    cursor: pointer;
    border-radius: var(--radius-sm);
    line-height: 0;
    transition: color 120ms ease;
  }

  .toggle-visibility:hover { color: var(--color-muted); }

  .toggle-visibility:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
  }

  .hint {
    margin: 0;
    color: var(--color-subtle);
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .error-msg {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    color: var(--color-error);
    font-size: 0.8125rem;
    line-height: 1.4;
    font-weight: 500;
    animation: err-in 0.15s ease both;
  }

  @keyframes err-in {
    from { opacity: 0; transform: translateY(-3px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
