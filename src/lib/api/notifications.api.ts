/**
 * src/lib/api/notifications.api.ts
 *
 * FCM token registration / unregistration.
 * Uses the shared apiPost helper from lib/api/client.ts — never raw fetch.
 */

import { apiPost } from './client';

export interface RegisterTokenPayload {
  token: string;
}

export interface UnregisterTokenPayload {
  token: string;
}

/**
 * Register an FCM token with the backend so the server can push
 * notifications to this device.
 *
 * POST /api/notifications/register
 */
export async function registerNotificationToken(token: string): Promise<void> {
  await apiPost<void>('/notifications/register', { token } satisfies RegisterTokenPayload);
}

/**
 * Unregister an FCM token so the server stops pushing to this device.
 *
 * POST /api/notifications/unregister
 */
export async function unregisterNotificationToken(token: string): Promise<void> {
  await apiPost<void>('/notifications/unregister', { token } satisfies UnregisterTokenPayload);
}
