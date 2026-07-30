import { ApiError, apiGet, apiPost } from './client';

export type CallType = 'audio' | 'video';

export interface InitiateCallPayload {
  calleeId?: string;
  receiverIds?: string[];
  callType: CallType;
  callMode: 'one-to-one' | 'conference';
  recording?: boolean;
}

export interface CallSummary {
  id?: string;
  _id?: string;
  callerId?: string;
  calleeId?: string;
  receiverIds?: string[];
  callMode?: 'one-to-one' | 'conference';
  roomId?: string;
  recording?: boolean;
  callType?: CallType;
  status?: string;
  createdAt?: string;
  endedAt?: string;
  updatedAt?: string;
}

export interface InitiateCallResponse {
  message?: string;
  call?: CallSummary;
  callId?: string;
  id?: string;
  _id?: string;
  token?: string;
  roomName?: string;
  url?: string;
  [key: string]: unknown;
}

export interface AcceptCallResponse {
  message?: string;
  call?: CallSummary;
  callId?: string;
  id?: string;
  _id?: string;
  token?: string;
  roomName?: string;
  url?: string;
  [key: string]: unknown;
}

export type RejectCallResponse = AcceptCallResponse;
export type EndCallResponse    = AcceptCallResponse;

export interface AddParticipantResponse {
  message?: string;
  call?: CallSummary;
  [key: string]: unknown;
}

// ── API calls ────────────────────────────────────────────────────────────────────────────────

export async function initiateCall(payload: InitiateCallPayload): Promise<InitiateCallResponse> {
  return apiPost<InitiateCallResponse>('/calls/initiate', payload);
}

export async function acceptCall(callId: string): Promise<AcceptCallResponse> {
  return apiPost<AcceptCallResponse>(`/calls/${encodeURIComponent(callId)}/accept`);
}

export async function rejectCall(callId: string): Promise<RejectCallResponse> {
  return apiPost<RejectCallResponse>(`/calls/${encodeURIComponent(callId)}/reject`);
}

export async function getCall(callId: string): Promise<{ call: CallSummary }> {
  return apiGet<{ call: CallSummary }>(`/calls/${encodeURIComponent(callId)}`);
}

export async function addParticipant(callId: string, userId: string): Promise<AddParticipantResponse> {
  return apiPost<AddParticipantResponse>(
    `/calls/${encodeURIComponent(callId)}/add-participant`,
    { userId }
  );
}

export async function endCall(callId: string): Promise<EndCallResponse> {
  return apiPost<EndCallResponse>(`/calls/${encodeURIComponent(callId)}/end`);
}

/**
 * Leave an active call without ending it for remaining participants.
 * The meeting continues; other participants receive a "call:participant-left"
 * socket event. Use endCall() only when the caller wants to terminate the
 * session for everyone (e.g. host ending the meeting).
 */
export async function leaveCall(callId: string): Promise<EndCallResponse> {
  return apiPost<EndCallResponse>(`/calls/${encodeURIComponent(callId)}/leave`);
}

export async function startRecording(callId: string): Promise<AcceptCallResponse> {
  return apiPost<AcceptCallResponse>(`/calls/${encodeURIComponent(callId)}/record/start`);
}

export async function stopRecording(callId: string): Promise<AcceptCallResponse> {
  return apiPost<AcceptCallResponse>(`/calls/${encodeURIComponent(callId)}/record/stop`);
}

// ── Response helpers ──────────────────────────────────────────────────────────────────────────────────────

export function getCallIdentifier(
  response: InitiateCallResponse | AcceptCallResponse | RejectCallResponse | EndCallResponse
): string | null {
  const nestedId = response.call?.id ?? response.call?._id;
  const id = response.callId ?? response.id ?? response._id ?? nestedId;

  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function hasLiveKitCredentials(
  response: InitiateCallResponse | AcceptCallResponse
): response is (InitiateCallResponse | AcceptCallResponse) & { token: string; roomName: string } {
  return (
    typeof response.token    === 'string' && response.token.length    > 0 &&
    typeof response.roomName === 'string' && response.roomName.length > 0
  );
}

export function getCallApiErrorMessage(
  error: unknown,
  fallback = 'The call request could not be completed.'
): string {
  if (error instanceof ApiError) {
    const data = error.body as { message?: unknown; error?: unknown } | undefined;
    const message = data?.message ?? data?.error;

    if (error.status === 401 && message === 'Authentication required') {
      return 'Your sign-in session was not sent with the call request. Please sign in again and retry.';
    }

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}
