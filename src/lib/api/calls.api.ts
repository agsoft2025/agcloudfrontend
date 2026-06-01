import { AxiosError } from 'axios';
import { axiosClient } from './client';
import { authStore } from '$lib/stores/auth.store';

export type CallType = 'audio' | 'video';

export interface InitiateCallPayload {
  calleeId?: string; // backward compatibility
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
export type EndCallResponse = AcceptCallResponse;

interface ApiErrorResponse {
  message?: unknown;
  error?: unknown;
}

class MissingAuthTokenError extends Error {
  constructor() {
    super('Your sign-in session is missing a token. Please sign in again before starting a call.');
    this.name = 'MissingAuthTokenError';
  }
}

export async function initiateCall(payload: InitiateCallPayload) {
  const response = await axiosClient.post<InitiateCallResponse>(
    '/calls/initiate',
    payload,
    getAuthRequestConfig()
  );

  return response.data;
}

export async function acceptCall(callId: string) {
  const response = await axiosClient.post<AcceptCallResponse>(
    `/calls/${encodeURIComponent(callId)}/accept`,
    undefined,
    getAuthRequestConfig()
  );

  return response.data;
}

export async function rejectCall(callId: string) {
  const response = await axiosClient.post<RejectCallResponse>(
    `/calls/${encodeURIComponent(callId)}/reject`,
    undefined,
    getAuthRequestConfig()
  );

  return response.data;
}

export async function getCall(callId: string) {
  const response = await axiosClient.get<{ call: CallSummary }>(
    `/calls/${encodeURIComponent(callId)}`,
    getAuthRequestConfig()
  );

  return response.data;
}

export async function endCall(callId: string) {
  const response = await axiosClient.post<EndCallResponse>(
    `/calls/${encodeURIComponent(callId)}/end`,
    undefined,
    getAuthRequestConfig()
  );

  return response.data;
}

export function getCallIdentifier(
  response: InitiateCallResponse | AcceptCallResponse | RejectCallResponse | EndCallResponse
) {
  const nestedId = response.call?.id ?? response.call?._id;
  const id = response.callId ?? response.id ?? response._id ?? nestedId;

  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function hasLiveKitCredentials(
  response: InitiateCallResponse | AcceptCallResponse
): response is (InitiateCallResponse | AcceptCallResponse) & { token: string; roomName: string } {
  return (
    typeof response.token === 'string' &&
    response.token.length > 0 &&
    typeof response.roomName === 'string' &&
    response.roomName.length > 0
  );
}

export function getCallApiErrorMessage(error: unknown, fallback = 'The call request could not be completed.') {
  if (error instanceof MissingAuthTokenError) {
    return error.message;
  }

  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    const message = data?.message ?? data?.error;

    if (error.response?.status === 401 && message === 'Authentication required') {
      return 'Your sign-in session was not sent with the call request. Please sign in again and retry.';
    }

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

export async function startRecording(callId: string) {
  const response = await axiosClient.post<AcceptCallResponse>(
    `/calls/${encodeURIComponent(callId)}/record/start`,
    undefined,
    getAuthRequestConfig()
  );
  return response.data;
}

export async function stopRecording(callId: string) {
  const response = await axiosClient.post<AcceptCallResponse>(
    `/calls/${encodeURIComponent(callId)}/record/stop`,
    undefined,
    getAuthRequestConfig()
  );
  return response.data;
}

function getAuthRequestConfig() {
  const accessToken = authStore.getAccessToken();

  if (!accessToken) {
    throw new MissingAuthTokenError();
  }

  return {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  };
}
