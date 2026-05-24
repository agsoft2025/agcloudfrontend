<script lang="ts">
  import { page } from '$app/stores';
  import { z } from 'zod';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import Input from '$lib/components/atoms/Input.svelte';
  import { getAuthErrorMessage, resetPassword } from '$lib/api/auth.api';

  const resetPasswordSchema = z
    .object({
      password: z.string().min(8, 'Password must be at least 8 characters.'),
      confirmPassword: z.string().min(1, 'Confirm your password.')
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: 'Passwords do not match.',
      path: ['confirmPassword']
    });

  type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
  type FieldErrors = Partial<Record<keyof ResetPasswordForm, string>>;

  let form: ResetPasswordForm = {
    password: '',
    confirmPassword: ''
  };
  let errors: FieldErrors = {};
  let serverError = '';
  let successMessage = '';
  let isSubmitting = false;

  $: token = $page.url.searchParams.get('token') ?? '';

  function validateForm() {
    const result = resetPasswordSchema.safeParse(form);
    errors = {};

    if (result.success) {
      return result.data;
    }

    errors = result.error.issues.reduce<FieldErrors>((nextErrors, issue) => {
      const field = issue.path[0];

      if ((field === 'password' || field === 'confirmPassword') && !nextErrors[field]) {
        nextErrors[field] = issue.message;
      }

      return nextErrors;
    }, {});

    return null;
  }

  async function handleSubmit() {
    serverError = '';
    successMessage = '';

    if (!token) {
      serverError = 'Reset token is missing. Please use the link from your email.';
      return;
    }

    const payload = validateForm();

    if (!payload) {
      return;
    }

    isSubmitting = true;

    try {
      const data = await resetPassword({
        token,
        password: payload.password
      });

      successMessage = data.message ?? 'Password reset successfully.';
      form = {
        password: '',
        confirmPassword: ''
      };
    } catch (error) {
      serverError = getAuthErrorMessage(error, 'Unable to reset password. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Reset password | AG Cloud</title>
  <meta name="description" content="Reset your AG Cloud password." />
</svelte:head>

<AuthShell title="Reset password" subtitle="Create a new password for your account.">
  <form class="auth-form" on:submit|preventDefault={handleSubmit} novalidate>
    {#if serverError}
      <p class="auth-alert" data-variant="error" role="alert">{serverError}</p>
    {/if}

    {#if successMessage}
      <p class="auth-alert" data-variant="success" role="status">{successMessage}</p>
    {/if}

    <Input
      id="password"
      name="password"
      label="New password"
      type="password"
      bind:value={form.password}
      error={errors.password}
      autocomplete="new-password"
      placeholder="Enter new password"
      required
      disabled={isSubmitting}
      on:input={() => {
        errors.password = undefined;
        serverError = '';
        successMessage = '';
      }}
    />

    <Input
      id="confirmPassword"
      name="confirmPassword"
      label="Confirm password"
      type="password"
      bind:value={form.confirmPassword}
      error={errors.confirmPassword}
      autocomplete="new-password"
      placeholder="Confirm new password"
      required
      disabled={isSubmitting}
      on:input={() => {
        errors.confirmPassword = undefined;
        serverError = '';
        successMessage = '';
      }}
    />

    <Button type="submit" size="lg" loading={isSubmitting}>
      Reset password
    </Button>
  </form>

  <p slot="footer" class="auth-footer">
    Back to
    <a href="/signin">sign in</a>
  </p>
</AuthShell>
