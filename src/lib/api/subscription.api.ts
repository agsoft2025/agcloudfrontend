import { apiGet, apiPost, apiPut, apiDelete } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationMonths: 1 | 3 | 6 | 12;
  price: number;     // INR
  currency: string;
  isActive: boolean;
  createdAt: string;
  /** Only present in admin responses */
  updatedAt?: string;
}

export interface UserSubscription {
  id: string;
  planId: string;
  planName: string;
  durationMonths: number;
  amount: number;    // INR
  currency: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  createdAt: string;
}

export interface CreateOrderResponse {
  orderId: string;
  amount: number;    // paise (INR × 100)
  currency: string;
  keyId: string;
  planName: string;
}

export interface CreatePlanPayload {
  name: string;
  durationMonths: 1 | 3 | 6 | 12;
  price: number;
}

export interface UpdatePlanPayload {
  name?: string;
  price?: number;
  isActive?: boolean;
}

// ── User-facing API ───────────────────────────────────────────────────────────

export async function getActivePlans(): Promise<SubscriptionPlan[]> {
  const data = await apiGet<{ plans: SubscriptionPlan[] }>('/subscriptions/plans');
  return data.plans;
}

export async function getMySubscription(): Promise<UserSubscription | null> {
  const data = await apiGet<{ subscription: UserSubscription | null }>('/subscriptions/me');
  return data.subscription;
}

export async function createOrder(planId: string): Promise<CreateOrderResponse> {
  return apiPost<CreateOrderResponse>('/subscriptions/create-order', { planId });
}

export async function verifyPayment(payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<UserSubscription> {
  const data = await apiPost<{ subscription: UserSubscription }>(
    '/subscriptions/verify-payment',
    payload,
  );
  return data.subscription;
}

// ── Admin API ─────────────────────────────────────────────────────────────────

export async function adminGetPlans(): Promise<SubscriptionPlan[]> {
  const data = await apiGet<{ plans: SubscriptionPlan[] }>('/admin/subscription-plans');
  return data.plans;
}

export async function adminCreatePlan(payload: CreatePlanPayload): Promise<SubscriptionPlan> {
  return apiPost<SubscriptionPlan>('/admin/subscription-plans', payload);
}

export async function adminUpdatePlan(
  id: string,
  payload: UpdatePlanPayload,
): Promise<SubscriptionPlan> {
  return apiPut<SubscriptionPlan>(`/admin/subscription-plans/${id}`, payload);
}

export async function adminDeletePlan(id: string): Promise<void> {
  await apiDelete(`/admin/subscription-plans/${id}`);
}
