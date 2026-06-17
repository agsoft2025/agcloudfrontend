import { apiPost } from './client';
import { ApiError } from './client';
import { authStore, type AuthUser } from '$lib/stores/auth.store';
import { userStore } from '$lib/stores/user.store';

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignUpPayload extends SignInPayload {
  displayName: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface SignInResponse {
  message?: string;
  user?: AuthUser;
  accessToken?: string;
  token?: string;
  refreshToken?: string;
}

export type SignUpResponse = SignInResponse;

export interface ForgotPasswordResponse {
  message?: string;
}

export interface ResetPasswordResponse {
  message?: string;
}

export async function signUp(payload: SignUpPayload): Promise<SignUpResponse> {
  return apiPost<SignUpResponse>('/auth/signup', payload);
}

export async function signIn(payload: SignInPayload): Promise<SignInResponse> {
  return apiPost<SignInResponse>('/auth/signin', payload);
}

export async function signOut(): Promise<{ message?: string }> {
  return apiPost<{ message?: string }>('/auth/signout');
}

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
  return apiPost<ForgotPasswordResponse>('/auth/forgot-password', payload);
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<ResetPasswordResponse> {
  return apiPost<ResetPasswordResponse>('/api/auth/reset-password', payload);
}

export function storeAuthTokens(data: unknown) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const value = data as {
    accessToken?: unknown;
    token?: unknown;
    refreshToken?: unknown;
    user?: unknown;
  };
  const accessToken = value.accessToken ?? value.token;

  authStore.setSession({
    accessToken: typeof accessToken === 'string' ? accessToken : undefined,
    refreshToken: typeof value.refreshToken === 'string' ? value.refreshToken : undefined,
    user: isAuthUser(value.user) ? value.user : undefined
  });

  if (isAuthUser(value.user)) {
    userStore.setProfile(value.user);
  }

  return typeof accessToken === 'string' && accessToken.length > 0;
}

export function hasAuthToken(data: unknown) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const value = data as { accessToken?: unknown; token?: unknown };
  const accessToken = value.accessToken ?? value.token;

  return typeof accessToken === 'string' && accessToken.length > 0;
}

export function getAuthErrorMessage(error: unknown, fallback = 'Unable to sign in. Please try again.'): string {
  if (error instanceof ApiError) {
    const data = error.body as { message?: unknown; error?: unknown } | undefined;
    const message = data?.message ?? data?.error;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as { id?: unknown; email?: unknown };

  return typeof user.id === 'string' && typeof user.email === 'string';
}
