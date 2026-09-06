import { apiGet, apiPost, apiPut, apiDelete } from './client';

export interface PricingRate {
  id: string;
  callType: 'audio' | 'video';
  ratePerMinute: number;
  currency: string;
  effectiveFrom: string; // ISO date string
  label: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ActiveRates {
  audio: Pick<PricingRate, 'id' | 'ratePerMinute' | 'currency' | 'effectiveFrom'> | null;
  video: Pick<PricingRate, 'id' | 'ratePerMinute' | 'currency' | 'effectiveFrom'> | null;
}

export interface CreateRatePayload {
  callType: 'audio' | 'video';
  ratePerMinute: number;
  currency?: string;
  effectiveFrom: string; // ISO date string
  label?: string;
}

export interface UpdateRatePayload {
  ratePerMinute?: number;
  effectiveFrom?: string;
  label?: string;
}

export async function getAllRates(): Promise<PricingRate[]> {
  const res = await apiGet<{ rates: PricingRate[] }>('/admin/pricing');
  return res.rates;
}

export async function getActiveRates(): Promise<ActiveRates> {
  return apiGet<ActiveRates>('/admin/pricing/active');
}

export async function createRate(payload: CreateRatePayload): Promise<PricingRate> {
  return apiPost<PricingRate>('/admin/pricing', payload);
}

export async function updateRate(id: string, payload: UpdateRatePayload): Promise<PricingRate> {
  return apiPut<PricingRate>(`/admin/pricing/${id}`, payload);
}

export async function deleteRate(id: string): Promise<void> {
  return apiDelete(`/admin/pricing/${id}`);
}

export interface BillingSettings {
  freeMinutes:        number;
  gracePeriodSeconds: number;
}

export async function getBillingSettings(): Promise<BillingSettings> {
  return apiGet<BillingSettings>('/admin/billing/settings');
}

export async function updateBillingSettings(payload: BillingSettings): Promise<BillingSettings> {
  return apiPut<BillingSettings>('/admin/billing/settings', payload);
}
