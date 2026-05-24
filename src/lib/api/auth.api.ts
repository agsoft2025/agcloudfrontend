import { AxiosError } from 'axios';
import { axiosClient } from './client';
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

interface ApiErrorResponse {
  message?: unknown;
  error?: unknown;
}

export async function signUp(payload: SignUpPayload) {
  const response = await axiosClient.post<SignUpResponse>('/auth/signup', payload);

  return response.data;
}

export async function signIn(payload: SignInPayload) {
  const response = await axiosClient.post<SignInResponse>('/auth/signin', payload);

  return response.data;
}

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const response = await axiosClient.post<ForgotPasswordResponse>('/auth/forgot-password', payload);

  return response.data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const response = await axiosClient.post<ResetPasswordResponse>('/api/auth/reset-password', payload);

  return response.data;
}

export function storeAuthTokens(data: unknown) {
  if (!data || typeof data !== 'object') {
    return;
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
}

export function getAuthErrorMessage(error: unknown, fallback = 'Unable to sign in. Please try again.') {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined;
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
