/**
 * contacts.api.ts
 *
 * API helpers for the Contact Dashboard:
 *   - getContacts()   — list all visible users / contacts
 *   - getCallHistory()— recent call log for the current user
 *
 * Both functions use the shared axiosClient, which injects the
 * Bearer token and handles 401 → refresh automatically.
 */
import { axiosClient } from './client';
import type { UserProfile } from '$lib/stores/user.store';

// ── Contact list ───────────────────────────────────────────────────

/** Server may return an array or a wrapper object. */
interface ContactsListResponse {
  users?: UserProfile[];
  data?: UserProfile[];
  total?: number;
}

export async function getContacts(search?: string): Promise<UserProfile[]> {
  const params: Record<string, string> = {};
  if (search?.trim()) params.search = search.trim();

  const response = await axiosClient.get<UserProfile[] | ContactsListResponse>('/users', {
    params,
  });

  const data = response.data;
  if (Array.isArray(data)) return data;
  return data.users ?? data.data ?? [];
}

// ── Call history ───────────────────────────────────────────────────

export type CallDirection = 'incoming' | 'outgoing' | 'missed';

export interface CallHistoryEntry {
  /** Canonical id — may come as `id`, `_id`, or `callId` from the server. */
  id: string;
  callerId: string;
  calleeId?: string;
  receiverIds?: string[];
  callType?: 'audio' | 'video';
  /** Backend status string, e.g. 'completed', 'missed', 'rejected'. */
  status?: string;
  /** Derived client-side direction (optional, enriched by RecentCalls). */
  direction?: CallDirection;
  durationSeconds?: number;
  createdAt?: string;
  // Enriched display fields merged from userStore
  callerName?: string;
  calleeName?: string;
  callerAvatar?: string | null;
  calleeAvatar?: string | null;
}

interface CallHistoryResponse {
  calls?: CallHistoryEntry[];
  data?: CallHistoryEntry[];
  total?: number;
}

export async function getCallHistory(limit = 20): Promise<CallHistoryEntry[]> {
  const response = await axiosClient.get<CallHistoryEntry[] | CallHistoryResponse>(
    '/calls/history',
    { params: { limit } }
  );

  const data = response.data;
  if (Array.isArray(data)) return data;
  return data.calls ?? data.data ?? [];
}
