import { apiGet, apiPut } from '$lib/api/client';
import type { AuthUser } from '$lib/stores/auth.store';
import type { UserProfile } from '$lib/stores/user.store';

export interface UpdateProfilePayload {
  displayName?: string;
  /** Regular URL or base64 data URL for the avatar image. */
  avatarUrl?: string;
}

/**
 * Fetch a user's public profile by ID via GET /users/:userId.
 * Use userStore.hydrateProfile() in components — it wraps this with caching
 * and deduplication. Call this directly only when you need a one-shot fetch.
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  return apiGet<UserProfile>(`/users/${userId}`);
}


/**
 * Update the current user's profile via PUT /users/me.
 * Returns the updated user shape from the server.
 */
export async function updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
  return apiPut<AuthUser>('/users/me', payload);
}
