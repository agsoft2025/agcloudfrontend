<script lang="ts">
  import { z } from 'zod';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import Input from '$lib/components/atoms/Input.svelte';
  import { forgotPassword, getAuthErrorMessage } from '$lib/api/auth.api';

  const forgotPasswordSchema = z.object({
    email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.')
  });

  type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
  type FieldErrors = Partial<Record<keyof ForgotPasswordForm, string>>;

  let form: ForgotPasswordForm = {
    email: ''
  };
  let errors: FieldErrors = {};
  let serverError = '';
  let successMessage = '';
  let isSubmitting = false;

  function validateForm() {
    const result = forgotPasswordSchema.safeParse(form);
    errors = {};

    if (result.success) {
      form = result.data;
      return result.data;
    }

    errors = result.error.issues.reduce<FieldErrors>((nextErrors, issue) => {
      const field = issue.path[0];

      if (field === 'email' && !nextErrors.email) {
        nextErrors.email = issue.message;
      }

      return nextErrors;
    }, {});

    return null;
  }

  async function handleSubmit() {
    serverError = '';
    successMessage = '';
    const payload = validateForm();

    if (!payload) {
      return;
    }

    isSubmitting = true;

    try {
      const data = await forgotPassword(payload);
      successMessage = data.message ?? 'Password reset link sent.';
    } catch (error) {
      serverError = getAuthErrorMessage(error, 'Unable to send reset link. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Forgot password | AG Cloud</title>
  <meta name="description" content="Request an AG Cloud password reset link." />
</svelte:head>

<AuthShell title="Forgot password" subtitle="Enter your email and we will send a reset link.">
  <form class="auth-form" on:submit|preventDefault={handleSubmit} novalidate>
    {#if serverError}
      <p class="auth-alert" data-variant="error" role="alert">{serverError}</p>
    {/if}

    {#if successMessage}
      <p class="auth-alert" data-variant="success" role="status">{successMessage}</p>
    {/if}

    <Input
      id="email"
      name="email"
      label="Email"
      type="text"
      bind:value={form.email}
      error={errors.email}
      autocomplete="email"
      placeholder="you@example.com"
      required
      disabled={isSubmitting}
      on:input={() => {
        errors.email = undefined;
        serverError = '';
        successMessage = '';
      }}
    />

    <Button type="submit" size="lg" loading={isSubmitting}>
      Send reset link
    </Button>
  </form>

  <p slot="footer" class="auth-footer">
    Remember your password?
    <a href="/signin">Sign in</a>
  </p>
</AuthShell>
