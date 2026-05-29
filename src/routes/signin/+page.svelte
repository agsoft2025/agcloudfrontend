<script lang="ts">
  import { goto } from '$app/navigation';
  import { z } from 'zod';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import Input from '$lib/components/atoms/Input.svelte';
  import { getAuthErrorMessage, hasAuthToken, signIn, storeAuthTokens } from '$lib/api/auth.api';

  const signinSchema = z.object({
    email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
    password: z.string().min(1, 'Password is required.')
  });

  type SigninForm = z.infer<typeof signinSchema>;
  type FieldErrors = Partial<Record<keyof SigninForm, string>>;

  let form: SigninForm = {
    email: '',
    password: ''
  };
  let errors: FieldErrors = {};
  let serverError = '';
  let isSubmitting = false;

  function validateForm() {
    const result = signinSchema.safeParse(form);
    errors = {};

    if (result.success) {
      form = result.data;
      return result.data;
    }

    errors = result.error.issues.reduce<FieldErrors>((nextErrors, issue) => {
      const field = issue.path[0];

      if ((field === 'email' || field === 'password') && !nextErrors[field]) {
        nextErrors[field] = issue.message;
      }

      return nextErrors;
    }, {});

    return null;
  }

  async function handleSubmit() {
    serverError = '';
    const payload = validateForm();

    if (!payload) {
      return;
    }

    isSubmitting = true;

    try {
      const data = await signIn(payload);
      if (!hasAuthToken(data)) {
        serverError = 'Sign-in succeeded, but the API did not return a session token. Calls cannot be started until the backend returns token or accessToken from /auth/signin.';
        return;
      }
      storeAuthTokens(data);
      await goto('/home');
    } catch (error) {
      serverError = getAuthErrorMessage(error);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in | AG Cloud</title>
  <meta name="description" content="Sign in to AG Cloud with your email and password." />
</svelte:head>

<AuthShell title="Sign in" subtitle="Use your account email and password to continue.">
  <form class="auth-form" on:submit|preventDefault={handleSubmit} novalidate>
    {#if serverError}
      <p class="auth-alert" data-variant="error" role="alert">{serverError}</p>
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
      }}
    />

    <Input
      id="password"
      name="password"
      label="Password"
      type="password"
      bind:value={form.password}
      error={errors.password}
      autocomplete="current-password"
      placeholder="Enter your password"
      required
      disabled={isSubmitting}
      on:input={() => {
        errors.password = undefined;
        serverError = '';
      }}
    />

    <div class="auth-form-row">
      <a href="/forgot-password">Forgot password?</a>
    </div>

    <Button type="submit" size="lg" loading={isSubmitting}>
      Sign in
    </Button>
  </form>

  <p slot="footer" class="auth-footer">
    New to AG Cloud?
    <a href="/signup">Create an account</a>
  </p>
</AuthShell>
