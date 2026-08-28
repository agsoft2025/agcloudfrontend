<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getActivePlans,
    getMySubscription,
    createOrder,
    verifyPayment,
    type SubscriptionPlan,
    type UserSubscription,
  } from '$lib/api/subscription.api';
  import { toastStore } from '$lib/stores/toast.store';

  // ── State ─────────────────────────────────────────────────────────────────
  let plans: SubscriptionPlan[] = [];
  let currentSub: UserSubscription | null = null;
  let loading = true;
  let error = '';
  let subscribing: string | null = null; // planId being processed

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(loadData);

  async function loadData() {
    loading = true;
    error = '';
    try {
      [plans, currentSub] = await Promise.all([getActivePlans(), getMySubscription()]);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load subscription data';
    } finally {
      loading = false;
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  $: isActive = currentSub?.status === 'active' && !!currentSub.endDate &&
    new Date(currentSub.endDate) > new Date();

  $: daysLeft = (() => {
    if (!currentSub?.endDate) return 0;
    const ms = new Date(currentSub.endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  })();

  // ── Razorpay checkout ─────────────────────────────────────────────────────
  function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) { resolve(true); return; }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function handleSubscribe(plan: SubscriptionPlan) {
    subscribing = plan.id;
    try {
      const order = await createOrder(plan.id);
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toastStore.error('Failed to load Razorpay checkout. Check your internet connection.');
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const rzp = new (window as any).Razorpay({
          key:         order.keyId,
          amount:      order.amount,
          currency:    order.currency,
          name:        'AG Cloud',
          description: order.planName,
          order_id:    order.orderId,
          theme:       { color: '#6c63ff' },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const activated = await verifyPayment({
                razorpayOrderId:   response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              currentSub = activated;
              toastStore.success(`Subscribed to ${plan.name}!`);
              resolve();
            } catch (e: unknown) {
              reject(e);
            }
          },
          modal: {
            ondismiss: () => resolve(), // user closed without paying
          },
        });
        rzp.open();
      });
    } catch (e: unknown) {
      toastStore.error(e instanceof Error ? e.message : 'Payment failed. Please try again.');
    } finally {
      subscribing = null;
    }
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function fmtDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  }

  function planLabel(months: number) {
    if (months === 12) return '1 Year';
    if (months === 1)  return '1 Month';
    return `${months} Months`;
  }

  function statusColor(status: UserSubscription['status']) {
    return status === 'active' ? 'active' : status === 'pending' ? 'pending' : 'expired';
  }
</script>

<div class="sub-page">
  <header class="page-header">
    <h1 class="page-title">Subscription</h1>
    <p class="page-subtitle">Choose a plan to unlock premium access.</p>
  </header>

  {#if loading}
    <div class="state-box"><span class="spinner" aria-label="Loading"></span> Loading…</div>
  {:else if error}
    <div class="state-box error">{error}</div>
  {:else}

    <!-- Current plan status -->
    <section class="current-section">
      <h2 class="section-title">Current Plan</h2>
      {#if currentSub}
        <div class="status-card" class:status-card--active={isActive}>
          <div class="status-row">
            <div class="status-info">
              <span class="plan-name">{currentSub.planName}</span>
              <span class="status-badge status-badge--{statusColor(currentSub.status)}">
                {currentSub.status.charAt(0).toUpperCase() + currentSub.status.slice(1)}
              </span>
            </div>
            {#if isActive}
              <div class="days-pill">{daysLeft}d left</div>
            {/if}
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Start date</span>
              <span class="detail-value">{fmtDate(currentSub.startDate)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Expiry date</span>
              <span class="detail-value">{fmtDate(currentSub.endDate)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Amount paid</span>
              <span class="detail-value">₹{currentSub.amount.toFixed(2)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Duration</span>
              <span class="detail-value">{planLabel(currentSub.durationMonths)}</span>
            </div>
          </div>
        </div>
      {:else}
        <p class="no-sub">You don't have an active subscription yet.</p>
      {/if}
    </section>

    <!-- Available plans -->
    <section class="plans-section">
      <h2 class="section-title">
        {isActive ? 'Upgrade or Renew' : 'Available Plans'}
      </h2>
      {#if plans.length === 0}
        <p class="no-plans">No plans are available at this time. Check back later.</p>
      {:else}
        <div class="plans-grid">
          {#each plans as plan (plan.id)}
            {@const isCurrent = currentSub?.planId === plan.id && isActive}
            <div class="plan-card" class:plan-card--current={isCurrent}>
              {#if isCurrent}
                <div class="current-tag">Current</div>
              {/if}
              <div class="plan-header">
                <span class="plan-duration">{planLabel(plan.durationMonths)}</span>
                <span class="plan-name-label">{plan.name}</span>
              </div>
              <div class="plan-price">
                <span class="price-amount">₹{plan.price.toFixed(0)}</span>
                <span class="price-period">/ {planLabel(plan.durationMonths).toLowerCase()}</span>
              </div>
              <div class="per-month">
                ₹{(plan.price / plan.durationMonths).toFixed(2)} / month
              </div>
              <button
                class="btn btn-subscribe"
                class:btn-current={isCurrent}
                type="button"
                disabled={subscribing !== null || isCurrent}
                on:click={() => handleSubscribe(plan)}
              >
                {#if subscribing === plan.id}
                  <span class="spinner-sm"></span> Processing…
                {:else if isCurrent}
                  Active Plan
                {:else}
                  Subscribe
                {/if}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style lang="postcss">
  .sub-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    gap: 2rem;
    padding: 1.5rem 2rem;
    box-sizing: border-box;
  }

  .page-header { display: flex; flex-direction: column; gap: 0.25rem; }
  .page-title  { margin: 0; font-size: 1.375rem; font-weight: 700; line-height: 1.2; }
  .page-subtitle { margin: 0; font-size: 0.8125rem; opacity: 0.65; }

  .section-title { margin: 0 0 0.875rem; font-size: 1rem; font-weight: 700; }

  /* ── Current plan card ── */
  .current-section { display: flex; flex-direction: column; }

  .status-card {
    padding: 1.25rem;
    border-radius: 12px;
    border: 1px solid var(--pico-muted-border-color);
    background: var(--pico-card-background-color);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .status-card--active {
    border-color: color-mix(in srgb, #a6e3a1 50%, transparent);
    background: color-mix(in srgb, #a6e3a1 6%, var(--pico-card-background-color));
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .status-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .plan-name {
    font-size: 1.125rem;
    font-weight: 700;
  }

  .days-pill {
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    background: color-mix(in srgb, #a6e3a1 20%, transparent);
    color: #40b870;
    border: 1px solid color-mix(in srgb, #a6e3a1 40%, transparent);
    font-size: 0.75rem;
    font-weight: 700;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.875rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .detail-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    opacity: 0.55;
  }

  .detail-value {
    font-size: 0.9rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .no-sub {
    margin: 0;
    font-size: 0.875rem;
    opacity: 0.6;
    font-style: italic;
  }

  /* ── Status badges ── */
  .status-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
  }

  .status-badge--active {
    background: color-mix(in srgb, #a6e3a1 20%, transparent);
    color: #40b870;
    border: 1px solid color-mix(in srgb, #a6e3a1 40%, transparent);
  }

  .status-badge--pending {
    background: color-mix(in srgb, #fab387 15%, transparent);
    color: #f59e0b;
    border: 1px solid color-mix(in srgb, #fab387 35%, transparent);
  }

  .status-badge--expired {
    opacity: 0.55;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    background: color-mix(in srgb, currentColor 6%, transparent);
  }

  /* ── Plans grid ── */
  .plans-section { display: flex; flex-direction: column; }

  .no-plans { margin: 0; font-size: 0.875rem; opacity: 0.6; font-style: italic; }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .plan-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    border-radius: 12px;
    border: 1px solid var(--pico-muted-border-color);
    background: var(--pico-card-background-color);
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }

  .plan-card:hover {
    border-color: color-mix(in srgb, var(--pico-primary) 50%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pico-primary) 10%, transparent);
  }

  .plan-card--current {
    border-color: color-mix(in srgb, var(--pico-primary) 60%, transparent);
    background: color-mix(in srgb, var(--pico-primary) 5%, var(--pico-card-background-color));
  }

  .current-tag {
    position: absolute;
    inset-block-start: -1px;
    inset-inline-end: 1rem;
    background: var(--pico-primary);
    color: var(--pico-primary-inverse, #fff);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.2rem 0.55rem;
    border-radius: 0 0 6px 6px;
  }

  .plan-header {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .plan-duration {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    opacity: 0.55;
  }

  .plan-name-label {
    font-size: 0.95rem;
    font-weight: 700;
  }

  .plan-price {
    display: flex;
    align-items: baseline;
    gap: 0.2rem;
  }

  .price-amount {
    font-size: 1.875rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .price-period {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .per-month {
    font-size: 0.75rem;
    opacity: 0.55;
    margin-block-start: -0.25rem;
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.55rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: filter 140ms ease, opacity 140ms ease;
    margin-block-start: auto;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-subscribe {
    background: var(--pico-primary);
    color: var(--pico-primary-inverse, #fff);
    inline-size: 100%;
  }

  .btn-subscribe:hover:not(:disabled) { filter: brightness(1.1); }

  .btn-current {
    background: color-mix(in srgb, var(--pico-primary) 15%, transparent);
    color: var(--pico-primary);
    cursor: default;
  }

  /* ── State boxes ── */
  .state-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    border-radius: 10px;
    border: 1px solid var(--pico-muted-border-color);
    color: var(--pico-muted-color);
    font-size: 0.875rem;
  }

  .state-box.error { color: var(--pico-del-color, #f38ba8); }

  .spinner {
    inline-size: 1rem;
    block-size: 1rem;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .spinner-sm {
    display: inline-block;
    inline-size: 0.875rem;
    block-size: 0.875rem;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .sub-page { padding: 1rem; gap: 1.5rem; }
    .plans-grid { grid-template-columns: 1fr 1fr; }
  }

  @media (max-width: 400px) {
    .plans-grid { grid-template-columns: 1fr; }
  }
</style>
