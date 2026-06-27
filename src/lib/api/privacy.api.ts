/**
 * src/lib/api/privacy.api.ts
 *
 * Blocked-user management — always via the shared API client.
 */

import { apiGet, apiPost } from './client';
import type { BlockedUser } from '$lib/stores/privacy.store';

interface BlockedUsersResponse {
  users: BlockedUser[];
}

interface UnblockPayload {
  userId: string;
}

/**
 * Fetch the caller's current blocklist.
 * GET /privacy/blocked-users
 */
export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const data = await apiGet<BlockedUsersResponse>('/privacy/blocked-users');
  return data.users ?? [];
}

/**
 * Remove a user from the caller's blocklist.
 * POST /privacy/unblock  { userId }
 */
export async function unblockUser(userId: string): Promise<void> {
  await apiPost<void>('/privacy/unblock', { userId } satisfies UnblockPayload);
}
