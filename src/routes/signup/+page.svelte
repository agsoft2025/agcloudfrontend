<script lang="ts">
  import { goto } from '$app/navigation';
  import { z } from 'zod';
  import AuthShell from '$lib/components/auth/AuthShell.svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import Input from '$lib/components/atoms/Input.svelte';
  import PasswordStrength from '$lib/components/atoms/PasswordStrength.svelte';
  import { getAuthErrorMessage, hasAuthToken, signIn, signUp, storeAuthTokens } from '$lib/api/auth.api';

  const signupSchema = z.object({
    displayName: z.string().trim().min(1, 'Display name is required.'),
    email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.')
  });

  type SignupForm = z.infer<typeof signupSchema>;
  type FieldErrors = Partial<Record<keyof SignupForm, string>>;

  let form: SignupForm = { displayName: '', email: '', password: '' };
  let errors: FieldErrors = {};
  let serverError = '';
  let isSubmitting = false;

  function validateForm() {
    const result = signupSchema.safeParse(form);
    errors = {};
    if (result.success) { form = result.data; return result.data; }
    errors = result.error.issues.reduce<FieldErrors>((acc, issue) => {
      const field = issue.path[0];
      if ((field === 'displayName' || field === 'email' || field === 'password') && !acc[field]) {
        acc[field] = issue.message;
      }
      return acc;
    }, {});
    return null;
  }

  async function handleSubmit() {
    serverError = '';
    const payload = validateForm();
    if (!payload) return;
    isSubmitting = true;
    try {
      await signUp(payload);
      const data = await signIn({ email: payload.email, password: payload.password });
      if (!hasAuthToken(data)) {
        serverError = 'Account created, but the API did not return a session token. Calls cannot be started until the backend returns token or accessToken from /auth/signin.';
        return;
      }
      storeAuthTokens(data);
      await goto('/home');
    } catch (error) {
      serverError = getAuthErrorMessage(error, 'Unable to create your account. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Sign up | AG Cloud</title>
  <meta name="description" content="Create your AG Cloud account." />
</svelte:head>

<AuthShell title="Create account" subtitle="Enter your details to set up your account.">
  <form class="auth-form" on:submit|preventDefault={handleSubmit} novalidate>
    {#if serverError}
      <p class="auth-alert" data-variant="error" role="alert">{serverError}</p>
    {/if}

    <Input
      id="displayName"
      name="displayName"
      label="Display name"
      type="text"
      leadingIcon="user"
      appearance="auth"
      bind:value={form.displayName}
      error={errors.displayName}
      autocomplete="name"
      placeholder="Your name"
      required
      disabled={isSubmitting}
      on:input={() => { errors.displayName = undefined; serverError = ''; }}
    />

    <Input
      id="email"
      name="email"
      label="Email"
      type="text"
      leadingIcon="email"
      appearance="auth"
      bind:value={form.email}
      error={errors.email}
      autocomplete="email"
      placeholder="you@example.com"
      required
      disabled={isSubmitting}
      on:input={() => { errors.email = undefined; serverError = ''; }}
    />

    <div class="password-field">
      <Input
        id="password"
        name="password"
        label="Password"
        type="password"
        leadingIcon="password"
        appearance="auth"
        bind:value={form.password}
        error={errors.password}
        autocomplete="new-password"
        placeholder="Create a password (min. 8 characters)"
        required
        disabled={isSubmitting}
        on:input={() => { errors.password = undefined; serverError = ''; }}
      />
      <PasswordStrength password={form.password} />
    </div>

    <Button type="submit" size="lg" variant="secondary" fullWidth loading={isSubmitting}>
      Create account
    </Button>
  </form>

  <p slot="footer" class="auth-footer">
    Already have an account?
    <a href="/signin">Sign in</a>
  </p>
</AuthShell>

