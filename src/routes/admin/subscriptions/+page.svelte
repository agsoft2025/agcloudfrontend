<script lang="ts">
  import { onMount } from 'svelte';
  import {
    adminGetPlans,
    adminCreatePlan,
    adminUpdatePlan,
    adminDeletePlan,
    type SubscriptionPlan,
    type CreatePlanPayload,
    type UpdatePlanPayload,
  } from '$lib/api/subscription.api';
  import { toastStore } from '$lib/stores/toast.store';

  // ── State ─────────────────────────────────────────────────────────────────
  let plans: SubscriptionPlan[] = [];
  let loading = true;
  let error = '';

  type ModalMode = 'create' | 'edit' | 'delete' | null;
  let modalMode: ModalMode = null;
  let selectedPlan: SubscriptionPlan | null = null;
  let saving = false;
  let modalError = '';

  // Form
  let formName = '';
  let formDuration: 1 | 3 | 6 | 12 = 1;
  let formPrice = '';
  let formIsActive = true;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(loadData);

  async function loadData() {
    loading = true;
    error = '';
    try {
      plans = await adminGetPlans();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load plans';
    } finally {
      loading = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function planLabel(months: number) {
    if (months === 12) return '1 Year';
    if (months === 1)  return '1 Month';
    return `${months} Months`;
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openCreate() {
    modalMode = 'create';
    selectedPlan = null;
    formName = '';
    formDuration = 1;
    formPrice = '';
    formIsActive = true;
    modalError = '';
  }

  function openEdit(plan: SubscriptionPlan) {
    modalMode = 'edit';
    selectedPlan = plan;
    formName = plan.name;
    formDuration = plan.durationMonths;
    formPrice = String(plan.price);
    formIsActive = plan.isActive;
    modalError = '';
  }

  function openDelete(plan: SubscriptionPlan) {
    modalMode = 'delete';
    selectedPlan = plan;
    modalError = '';
  }

  function closeModal() {
    modalMode = null;
    selectedPlan = null;
    saving = false;
    modalError = '';
  }

  function handleBackdropKey(e: KeyboardEvent) {
    if (e.key === 'Escape') closeModal();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleCreate() {
    const price = parseFloat(formPrice);
    if (!formName.trim())          { modalError = 'Name is required.'; return; }
    if (isNaN(price) || price <= 0) { modalError = 'Price must be a positive number.'; return; }

    saving = true;
    modalError = '';
    try {
      const payload: CreatePlanPayload = {
        name:           formName.trim(),
        durationMonths: formDuration,
        price,
      };
      await adminCreatePlan(payload);
      toastStore.success('Plan created');
      closeModal();
      await loadData();
    } catch (e: unknown) {
      modalError = e instanceof Error ? e.message : 'Failed to create plan';
    } finally {
      saving = false;
    }
  }

  async function handleEdit() {
    if (!selectedPlan) return;
    const price = parseFloat(formPrice);
    if (!formName.trim())          { modalError = 'Name is required.'; return; }
    if (isNaN(price) || price <= 0) { modalError = 'Price must be a positive number.'; return; }

    saving = true;
    modalError = '';
    try {
      const payload: UpdatePlanPayload = {
        name:     formName.trim(),
        price,
        isActive: formIsActive,
      };
      await adminUpdatePlan(selectedPlan.id, payload);
      toastStore.success('Plan updated');
      closeModal();
      await loadData();
    } catch (e: unknown) {
      modalError = e instanceof Error ? e.message : 'Failed to update plan';
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!selectedPlan) return;
    saving = true;
    modalError = '';
    try {
      await adminDeletePlan(selectedPlan.id);
      toastStore.success('Plan deleted');
      closeModal();
      await loadData();
    } catch (e: unknown) {
      modalError = e instanceof Error ? e.message : 'Failed to delete plan';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window on:keydown={handleBackdropKey} />

<div class="subs-page">
  <!-- Header -->
  <header class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Subscription Plans</h1>
      <p class="page-subtitle">Create and manage plans users can subscribe to (INR ₹).</p>
    </div>
    <button class="btn btn-primary" type="button" on:click={openCreate}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Add Plan
    </button>
  </header>

  {#if loading}
    <div class="state-box"><span class="spinner" aria-label="Loading"></span> Loading…</div>
  {:else if error}
    <div class="state-box error">{error}</div>
  {:else if plans.length === 0}
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M2 10h20" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <p>No subscription plans yet.</p>
      <button class="btn btn-primary" type="button" on:click={openCreate}>Create your first plan</button>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="plans-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Duration</th>
            <th>Price (₹)</th>
            <th>Status</th>
            <th class="actions-th">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each plans as plan (plan.id)}
            <tr>
              <td class="name-cell">{plan.name}</td>
              <td class="duration-cell">{planLabel(plan.durationMonths)}</td>
              <td class="price-cell">₹{plan.price.toFixed(2)}</td>
              <td>
                {#if plan.isActive}
                  <span class="status-badge active">Active</span>
                {:else}
                  <span class="status-badge inactive">Inactive</span>
                {/if}
              </td>
              <td class="actions-cell">
                <button class="action-btn" type="button" style="color: black ;" on:click={() => openEdit(plan)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Edit
                </button>
                <button class="action-btn action-btn--danger" type="button" on:click={() => openDelete(plan)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Delete
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- ── Modal ──────────────────────────────────────────────────────────────── -->
{#if modalMode}
  <div
    class="modal-backdrop"
    aria-hidden="true"
    on:click={closeModal}
    on:keydown={(e) => e.key === 'Escape' && closeModal()}
  ></div>
  <div class="modal" role="dialog" aria-modal="true">
    {#if modalMode === 'delete'}
      <h2 class="modal-title modal-title--danger">Delete Plan</h2>
      <div class="delete-body">
        <div class="delete-icon" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
            <path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <p class="modal-body-text">
            Permanently delete the plan <strong>{selectedPlan?.name}</strong>
            (₹{selectedPlan?.price.toFixed(2)} / {planLabel(selectedPlan?.durationMonths ?? 1)})?
          </p>
          <p class="delete-warning">Existing active subscriptions will not be affected.</p>
        </div>
      </div>
      {#if modalError}<p class="modal-error">{modalError}</p>{/if}
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" on:click={closeModal} disabled={saving}>Cancel</button>
        <button class="btn btn-danger" type="button" on:click={handleDelete} disabled={saving}>
          {saving ? 'Deleting…' : 'Delete'}
        </button>
      </div>

    {:else}
      <h2 class="modal-title">{modalMode === 'create' ? 'Add Plan' : 'Edit Plan'}</h2>
      <p class="modal-note">All prices are in Indian Rupees (₹ INR).</p>

      <div class="form-grid">
        <div class="form-group span-2">
          <label class="form-label" for="f-name">Plan Name</label>
          <input
            id="f-name"
            class="form-input"
            type="text"
            maxlength="80"
            placeholder="e.g. Monthly Basic"
            bind:value={formName}
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="f-duration">Duration</label>
          {#if modalMode === 'create'}
            <select id="f-duration" class="form-select" bind:value={formDuration}>
              <option value={1}>1 Month</option>
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>1 Year</option>
            </select>
          {:else}
            <div class="form-static">{planLabel(formDuration)}</div>
          {/if}
        </div>

        <div class="form-group">
          <label class="form-label" for="f-price">Price (₹)</label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">₹</span>
            <input
              id="f-price"
              class="form-input with-prefix"
              type="number"
              min="1"
              step="0.01"
              placeholder="0.00"
              bind:value={formPrice}
            />
          </div>
        </div>

        {#if modalMode === 'edit'}
          <div class="form-group span-2">
            <label class="form-label toggle-label">
              <input type="checkbox" class="toggle-check" bind:checked={formIsActive} />
              <span>Active (visible to users)</span>
            </label>
          </div>
        {/if}
      </div>

      {#if modalError}<p class="modal-error">{modalError}</p>{/if}

      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" style="color: black;" on:click={closeModal} disabled={saving}>Cancel</button>
        <button
          class="btn btn-primary"
          type="button"
          disabled={saving}
          on:click={modalMode === 'create' ? handleCreate : handleEdit}
        >
          {saving ? 'Saving…' : modalMode === 'create' ? 'Create' : 'Save'}
        </button>
      </div>
    {/if}
  </div>
{/if}

<style lang="postcss">
  .subs-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    gap: 1.5rem;
    padding: 1.5rem 2rem;
    box-sizing: border-box;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .page-title  { margin: 0; font-size: 1.375rem; font-weight: 700; line-height: 1.2; }
  .page-subtitle { margin: 0.25rem 0 0; font-size: 0.8125rem; opacity: 0.65; }

  /* ── Table ── */
  .table-wrap {
    border: 1px solid var(--pico-muted-border-color);
    border-radius: 10px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .plans-table {
    inline-size: 100%;
    min-inline-size: 500px;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .plans-table thead {
    background: color-mix(in srgb, var(--pico-muted-background-color) 60%, transparent);
  }

  .plans-table th,
  .plans-table td {
    padding: 0.625rem 0.875rem;
    text-align: left;
    border-bottom: 1px solid var(--pico-muted-border-color);
  }

  .plans-table tbody tr:last-child td { border-bottom: none; }

  .plans-table th {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  .plans-table tbody tr:hover {
    background: color-mix(in srgb, var(--pico-primary) 5%, transparent);
  }

  .name-cell     { font-weight: 600; }
  .duration-cell { white-space: nowrap; }
  .price-cell    { font-weight: 700; font-variant-numeric: tabular-nums; }
  .actions-cell  { white-space: nowrap; }
  .actions-th    { min-inline-size: 140px; white-space: nowrap; }

  /* ── Status badges ── */
  .status-badge {
    display: inline-flex;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
  }

  .status-badge.active {
    background: color-mix(in srgb, #a6e3a1 20%, transparent);
    color: #40b870;
    border: 1px solid color-mix(in srgb, #a6e3a1 40%, transparent);
  }

  .status-badge.inactive {
    opacity: 0.5;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    background: color-mix(in srgb, currentColor 6%, transparent);
  }

  /* ── Action buttons ── */
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--pico-muted-border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--pico-color);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
    white-space: nowrap;
  }

  .action-btn:hover {
    background: var(--pico-muted-background-color);
    border-color: var(--pico-color);
  }

  .action-btn--danger {
    color: var(--pico-del-color, #f38ba8);
    border-color: color-mix(in srgb, var(--pico-del-color, #f38ba8) 40%, transparent);
  }

  .action-btn--danger:hover {
    background: color-mix(in srgb, var(--pico-del-color, #f38ba8) 12%, transparent);
    border-color: var(--pico-del-color, #f38ba8);
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem 1.5rem;
    text-align: center;
    border: 1px dashed var(--pico-muted-border-color);
    border-radius: 12px;
  }

  .empty-state p { margin: 0; opacity: 0.6; font-size: 0.9375rem; }

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

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: filter 140ms ease, opacity 140ms ease;
  }

  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-primary  { background: var(--pico-primary); color: var(--pico-primary-inverse, #fff); }
  .btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
  .btn-ghost    { background: transparent; color: var(--pico-color); border: 1px solid var(--pico-muted-border-color); }
  .btn-ghost:hover:not(:disabled)   { background: var(--pico-muted-background-color); }
  .btn-danger   { background: var(--pico-del-color, #f38ba8); color: #fff; }
  .btn-danger:hover:not(:disabled)  { filter: brightness(1.1); }

  /* ── Modal ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
  }

  .modal {
    position: fixed;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    inline-size: min(480px, calc(100vw - 2rem));
    max-block-size: calc(100dvh - 3rem);
    overflow-y: auto;
    background: var(--pico-card-background-color);
    border: 1px solid var(--pico-muted-border-color);
    border-radius: 14px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .modal-title { margin: 0; font-size: 1.125rem; font-weight: 700; }
  .modal-title--danger { color: var(--pico-del-color, #f38ba8); }
  .modal-note  { margin: 0; font-size: 0.8125rem; opacity: 0.6; }
  .modal-body-text { margin: 0; font-size: 0.875rem; line-height: 1.5; }
  .modal-error { margin: 0; font-size: 0.8125rem; color: var(--pico-del-color, #f38ba8); }
  .modal-actions { display: flex; justify-content: flex-end; gap: 0.625rem; }

  /* ── Delete ── */
  .delete-body { display: flex; gap: 1rem; align-items: flex-start; }
  .delete-icon { flex-shrink: 0; color: var(--pico-del-color, #f38ba8); opacity: 0.85; margin-block-start: 0.125rem; }
  .delete-warning { margin: 0.5rem 0 0; font-size: 0.8125rem; opacity: 0.65; line-height: 1.45; }

  /* ── Form ── */
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
  .span-2 { grid-column: span 2; }
  .form-label { font-size: 0.8125rem; font-weight: 600; }

  .form-input,
  .form-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--pico-muted-border-color);
    border-radius: 8px;
    background: var(--pico-background-color);
    color: var(--pico-color);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 120ms ease;
  }

  .form-input:focus, .form-select:focus { border-color: var(--pico-primary); }

  .form-static {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--pico-muted-background-color);
    opacity: 0.75;
    font-weight: 600;
  }

  .input-prefix-wrap { position: relative; display: flex; }
  .input-prefix {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0.75rem;
    display: flex;
    align-items: center;
    font-size: 0.875rem;
    font-weight: 700;
    opacity: 0.55;
    pointer-events: none;
  }
  .form-input.with-prefix { padding-inline-start: 1.75rem; inline-size: 100%; }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .toggle-check { accent-color: var(--pico-primary); inline-size: 1rem; block-size: 1rem; cursor: pointer; }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .subs-page  { padding: 1rem; }
    .page-header { flex-direction: column; align-items: stretch; }
    .page-header .btn { align-self: flex-start; }
    .form-grid { grid-template-columns: 1fr; }
    .form-grid .span-2 { grid-column: 1; }
    .modal-actions { flex-direction: column-reverse; }
    .modal-actions .btn { width: 100%; justify-content: center; }
  }
</style>
