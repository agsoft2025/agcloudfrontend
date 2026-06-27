import { apiPut } from '$lib/api/client';
import type { AuthUser } from '$lib/stores/auth.store';

export interface UpdateProfilePayload {
  displayName?: string;
  /** Regular URL or base64 data URL for the avatar image. */
  avatarUrl?: string;
}

/**
 * Update the current user's profile via PUT /users/me.
 * Returns the updated user shape from the server.
 */
export async function updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
  return apiPut<AuthUser>('/users/me', payload);
}
