/**
 * contacts.api.ts
 *
 * API helpers for the Contact Dashboard:
 *   - getContacts()    — list all visible users / contacts
 *   - getCallHistory() — recent call log for the current user
 */
import { apiGet } from './client';
import type { UserProfile } from '$lib/stores/user.store';

// ── Contact list ───────────────────────────────────────────────────────────────

interface ContactsListResponse {
  users?: UserProfile[];
  data?: UserProfile[];
  total?: number;
}

export async function getContacts(search?: string): Promise<UserProfile[]> {
  const params: Record<string, string> = {};
  if (search?.trim()) params.search = search.trim();

  const data = await apiGet<UserProfile[] | ContactsListResponse>('/users', params);

  if (Array.isArray(data)) return data;
  return data.users ?? data.data ?? [];
}

// ── Call history ───────────────────────────────────────────────────────────────

export type CallDirection = 'incoming' | 'outgoing' | 'missed';

export interface CallHistoryEntry {
  id: string;
  callerId: string;
  calleeId?: string;
  receiverIds?: string[];
  callType?: 'audio' | 'video';
  callMode?: 'one-to-one' | 'conference';
  status?: string;
  participantStatus?: 'invited' | 'joined' | 'rejected' | 'left' | 'missed';
  isActive?: boolean;
  participantCount?: number;
  direction?: CallDirection;
  durationSeconds?: number;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
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
  const data = await apiGet<CallHistoryEntry[] | CallHistoryResponse>(
    '/calls/history',
    { limit }
  );

  if (Array.isArray(data)) return data;
  return data.calls ?? data.data ?? [];
}
