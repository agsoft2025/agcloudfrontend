<script lang="ts" context="module">
  export type InputType = 'text' | 'password';
  export type InputAutocomplete =
    | 'off'
    | 'on'
    | 'name'
    | 'username'
    | 'current-password'
    | 'new-password'
    | 'email'
    | 'tel'
    | 'url';
</script>

<script lang="ts">
  export let id: string | undefined = undefined;
  export let name: string | undefined = undefined;
  export let label: string;
  export let type: InputType = 'text';
  export let value = '';
  export let placeholder = '';
  export let error: string | undefined = undefined;
  export let disabled = false;
  export let required = false;
  export let autocomplete: InputAutocomplete | undefined = undefined;
  export let describedBy: string | undefined = undefined;

  const fieldId = id ?? `input-${crypto.randomUUID()}`;

  $: errorId = error ? `${fieldId}-error` : undefined;
  $: ariaDescribedBy = [describedBy, errorId].filter(Boolean).join(' ') || undefined;
</script>

<div class="field" data-invalid={error ? 'true' : undefined}>
  <label class="label" for={fieldId}>
    {label}
    {#if required}
      <span class="required" aria-hidden="true">*</span>
    {/if}
  </label>

  <input
    class="input"
    id={fieldId}
    {name}
    {type}
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

  {#if error}
    <p class="error" id={errorId}>
      {error}
    </p>
  {/if}
</div>

<style lang="postcss">
  .field {
    display: grid;
    gap: var(--space-xs);
  }

  .label {
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 0.925rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .required {
    color: #b42318;
    margin-inline-start: 0.2rem;
  }

  .input {
    inline-size: 100%;
    min-block-size: 2.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 1rem;
    line-height: 1.4;
    padding: 0 var(--space-md);
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      background-color 160ms ease;
  }

  .input::placeholder {
    color: var(--color-muted);
    opacity: 0.8;
  }

  .input:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  }

  .input:focus {
    border-color: var(--color-secondary);
    outline: none;
    box-shadow:
      0 0 0 2px var(--color-background),
      0 0 0 5px color-mix(in srgb, var(--color-secondary) 24%, transparent);
  }

  .input:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .field[data-invalid='true'] .input {
    border-color: #b42318;
  }

  .field[data-invalid='true'] .input:focus {
    box-shadow:
      0 0 0 2px var(--color-background),
      0 0 0 5px color-mix(in srgb, #b42318 22%, transparent);
  }

  .error {
    margin: 0;
    color: #b42318;
    font-size: 0.875rem;
    line-height: 1.35;
  }
</style>
