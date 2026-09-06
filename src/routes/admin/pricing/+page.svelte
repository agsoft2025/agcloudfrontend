<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getAllRates,
    getActiveRates,
    createRate,
    updateRate,
    deleteRate,
    getBillingSettings,
    updateBillingSettings,
    type PricingRate,
    type CreateRatePayload,
    type UpdateRatePayload,
    type ActiveRates,
    type BillingSettings,
  } from '$lib/api/pricing.api';
  import { toastStore } from '$lib/stores/toast.store';

  // ── State ─────────────────────────────────────────────────────────────────
  let rates: PricingRate[] = [];
  let activeRates: ActiveRates = { audio: null, video: null };
  let settings: BillingSettings = { freeMinutes: 1, gracePeriodSeconds: 60 };
  let loading = true;
  let error = '';

  // Settings form
  let settingsFreeMinutes = 1;
  let settingsGracePeriod = 60;
  let savingSettings = false;
  let settingsError = '';
  let settingsDirty = false;

  // Rate modal
  type ModalMode = 'create' | 'edit' | 'delete' | null;
  let modalMode: ModalMode = null;
  let selectedRate: PricingRate | null = null;
  let saving = false;
  let modalError = '';

  // Rate form
  let formCallType: 'audio' | 'video' = 'audio';
  let formRatePerMinute = '';
  let formEffectiveFrom = '';
  let formLabel = '';

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(loadData);

  async function loadData() {
    loading = true;
    error = '';
    try {
      [rates, activeRates, settings] = await Promise.all([
        getAllRates(),
        getActiveRates(),
        getBillingSettings(),
      ]);
      settingsFreeMinutes = settings.freeMinutes;
      settingsGracePeriod = settings.gracePeriodSeconds;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load pricing data';
    } finally {
      loading = false;
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  $: audioRates = rates
    .filter((r) => r.callType === 'audio')
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
  $: videoRates = rates
    .filter((r) => r.callType === 'video')
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

  $: settingsDirty =
    settingsFreeMinutes !== settings.freeMinutes ||
    settingsGracePeriod !== settings.gracePeriodSeconds;

  // ── Settings save ─────────────────────────────────────────────────────────
  async function saveSettings() {
    if (settingsFreeMinutes < 1 || settingsFreeMinutes > 60) {
      settingsError = 'Free minutes must be between 1 and 60.';
      return;
    }
    if (settingsGracePeriod < 10 || settingsGracePeriod > 300) {
      settingsError = 'Grace period must be between 10 and 300 seconds.';
      return;
    }
    savingSettings = true;
    settingsError = '';
    try {
      settings = await updateBillingSettings({
        freeMinutes:        settingsFreeMinutes,
        gracePeriodSeconds: settingsGracePeriod,
      });
      settingsFreeMinutes = settings.freeMinutes;
      settingsGracePeriod = settings.gracePeriodSeconds;
      toastStore.success('Settings saved');
    } catch (e: unknown) {
      settingsError = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      savingSettings = false;
    }
  }

  // ── Rate modal helpers ────────────────────────────────────────────────────
  function openCreate() {
    modalMode = 'create';
    selectedRate = null;
    formCallType = 'audio';
    formRatePerMinute = '';
    const now = new Date();
    now.setSeconds(0, 0);
    formEffectiveFrom = toLocalDateTimeInput(now);  // local time for datetime-local input
    formLabel = '';
    modalError = '';
  }

  function openEdit(rate: PricingRate) {
    modalMode = 'edit';
    selectedRate = rate;
    formCallType = rate.callType;
    formRatePerMinute = String(rate.ratePerMinute);
    formEffectiveFrom = toLocalDateTimeInput(new Date(rate.effectiveFrom));  // local time
    formLabel = rate.label ?? '';
    modalError = '';
  }

  function openDelete(rate: PricingRate) {
    modalMode = 'delete';
    selectedRate = rate;
    modalError = '';
  }

  function closeModal() {
    modalMode = null;
    selectedRate = null;
    saving = false;
    modalError = '';
  }

  function handleBackdropKey(e: KeyboardEvent) {
    if (e.key === 'Escape') closeModal();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleCreate() {
    const rate = parseFloat(formRatePerMinute);
    if (isNaN(rate) || rate <= 0) { modalError = 'Rate must be a positive number.'; return; }
    if (!formEffectiveFrom) { modalError = 'Effective date is required.'; return; }

    saving = true;
    modalError = '';
    try {
      const payload: CreateRatePayload = {
        callType:      formCallType,
        ratePerMinute: rate,
        currency:      'INR',
        effectiveFrom: new Date(formEffectiveFrom).toISOString(),
        label:         formLabel.trim() || undefined,
      };
      await createRate(payload);
      toastStore.success('Rate created successfully');
      closeModal();
      await loadData();  // re-fetch authoritative state from server
    } catch (e: unknown) {
      modalError = e instanceof Error ? e.message : 'Failed to create rate';
    } finally {
      saving = false;
    }
  }

  async function handleEdit() {
    if (!selectedRate) return;
    const rate = parseFloat(formRatePerMinute);
    if (isNaN(rate) || rate <= 0) { modalError = 'Rate must be a positive number.'; return; }
    if (!formEffectiveFrom) { modalError = 'Effective date is required.'; return; }

    saving = true;
    modalError = '';
    try {
      const payload: UpdateRatePayload = {
        ratePerMinute: rate,
        effectiveFrom: new Date(formEffectiveFrom).toISOString(),
        label:         formLabel.trim(),  // send "" to clear an existing label
      };
      await updateRate(selectedRate.id, payload);
      toastStore.success('Rate updated');
      closeModal();
      await loadData();  // re-fetch authoritative state from server
    } catch (e: unknown) {
      modalError = e instanceof Error ? e.message : 'Failed to update rate';
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!selectedRate) return;
    saving = true;
    modalError = '';
    try {
      await deleteRate(selectedRate.id);
      toastStore.success('Rate deleted');
      closeModal();
      await loadData();  // re-fetch authoritative state from server
    } catch (e: unknown) {
      modalError = e instanceof Error ? e.message : 'Failed to delete rate';
    } finally {
      saving = false;
    }
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function fmtRate(r: PricingRate) {
    return `₹${r.ratePerMinute.toFixed(2)}/min`;
  }

  function isActive(rate: PricingRate, active: typeof activeRates.audio): boolean {
    return !!active && active.id === rate.id;
  }

  /**
   * Convert a Date to the string format required by <input type="datetime-local">
   * (local time, no timezone suffix: "YYYY-MM-DDTHH:MM").
   * Using local parts avoids the UTC-vs-local shift that .toISOString().slice(0,16) causes.
   */
  function toLocalDateTimeInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
</script>

<svelte:window on:keydown={handleBackdropKey} />

<div class="pricing-page">
  <!-- Header -->
  <header class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Call Pricing</h1>
      <p class="page-subtitle">
        Manage per-minute rates for audio and video calls (INR). Rates can be scheduled for future dates.
      </p>
    </div>
    <button class="btn btn-primary" type="button" on:click={openCreate}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Add Rate
    </button>
  </header>

  <!-- Loading / Error -->
  {#if loading}
    <div class="state-box"><span class="spinner" aria-label="Loading"></span> Loading…</div>
  {:else if error}
    <div class="state-box error">{error}</div>
  {:else}

    <!-- Active rates summary -->
    <div class="active-summary">
      <div class="active-card">
        <span class="active-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.72 12 19.79 19.79 0 011.65 3.32 2 2 0 013.63 1.27h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.91a16 16 0 006.35 6.35l.98-.97a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7a2 2 0 011.72 2.03z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Audio (active)
        </span>
        <span class="active-value">
          {activeRates.audio ? `₹${activeRates.audio.ratePerMinute.toFixed(2)}/min` : '—'}
        </span>
      </div>
      <div class="active-card">
        <span class="active-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Video (active)
        </span>
        <span class="active-value">
          {activeRates.video ? `₹${activeRates.video.ratePerMinute.toFixed(2)}/min` : '—'}
        </span>
      </div>
    </div>

    <!-- ── Free minutes & grace period settings ── -->
    <section class="settings-section">
      <h2 class="section-title">Free Call Settings</h2>
      <p class="section-subtitle">
        Every user gets free minutes per call. After that, a grace period warning is shown before the call is cut.
        Admins cannot manually modify individual user charges.
      </p>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-field">
            <label class="form-label" for="s-free-minutes">Free minutes per call</label>
            <p class="field-hint">Call is free for this many minutes. Default: 1.</p>
            <div class="settings-input-row">
              <input
                id="s-free-minutes"
                class="form-input settings-num"
                type="number"
                min="1"
                max="60"
                step="1"
                bind:value={settingsFreeMinutes}
              />
              <span class="input-unit">min</span>
            </div>
          </div>

          <div class="settings-field">
            <label class="form-label" for="s-grace">Grace period after free minutes</label>
            <p class="field-hint">Warning is shown; call ends after this. Default: 60 s.</p>
            <div class="settings-input-row">
              <input
                id="s-grace"
                class="form-input settings-num"
                type="number"
                min="10"
                max="300"
                step="5"
                bind:value={settingsGracePeriod}
              />
              <span class="input-unit">sec</span>
            </div>
          </div>
        </div>

        {#if settingsError}
          <p class="settings-error">{settingsError}</p>
        {/if}

        <div class="settings-actions">
          <button
            class="btn btn-primary"
            type="button"
            disabled={savingSettings || !settingsDirty}
            on:click={saveSettings}
          >
            {savingSettings ? 'Saving…' : 'Save Settings'}
          </button>
          {#if !settingsDirty}
            <span class="saved-note">Saved</span>
          {/if}
        </div>
      </div>
    </section>

    <!-- Rate tables -->
    <div class="rate-tables">
      {#each [
        { label: 'Audio Call Rates', type: 'audio', list: audioRates, active: activeRates.audio },
        { label: 'Video Call Rates', type: 'video', list: videoRates, active: activeRates.video },
      ] as group}
        <section class="rate-section">
          <h2 class="section-title">{group.label}</h2>
          {#if group.list.length === 0}
            <p class="empty-note">No rates configured. Add one to enable billing for {group.type} calls.</p>
          {:else}
            <div class="table-wrap">
              <table class="rate-table">
                <thead>
                  <tr>
                    <th>Rate (₹/min)</th>
                    <th>Effective From</th>
                    <th>Label</th>
                    <th>Status</th>
                    <th class="actions-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each group.list as rate (rate.id)}
                    <tr class:active-row={isActive(rate, group.active)}>
                      <td class="rate-cell">{fmtRate(rate)}</td>
                      <td class="date-cell">{fmtDate(rate.effectiveFrom)}</td>
                      <td class="label-cell">{rate.label ?? '—'}</td>
                      <td>
                        {#if isActive(rate, group.active)}
                          <span class="status-badge active">Active</span>
                        {:else if new Date(rate.effectiveFrom) > new Date()}
                          <span class="status-badge scheduled">Scheduled</span>
                        {:else}
                          <span class="status-badge expired">Superseded</span>
                        {/if}
                      </td>
                      <td class="actions-cell">
                        <button class="action-btn" type="button" style="color: black;" on:click={() => openEdit(rate)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Edit
                        </button>
                        <button class="action-btn action-btn--danger" type="button" on:click={() => openDelete(rate)}>
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
        </section>
      {/each}
    </div>
  {/if}
</div>

<!-- ── Rate Modal ─────────────────────────────────────────────────────────── -->
{#if modalMode}
  <div class="modal-backdrop" aria-hidden="true" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()}></div>
  <div class="modal" role="dialog" aria-modal="true">
    {#if modalMode === 'delete'}
      <h2 class="modal-title modal-title--danger">Delete Rate</h2>
      <div class="delete-confirm-body">
        <div class="delete-confirm-icon" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
            <path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <p class="modal-body-text">
            You are about to permanently delete the
            <strong>{selectedRate?.callType} call rate</strong> of
            <strong>{selectedRate ? fmtRate(selectedRate) : ''}</strong>.
          </p>
          <p class="delete-warning">This action cannot be undone. Active calls will not be affected, but no new charges will accrue at this rate.</p>
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
      <h2 class="modal-title">{modalMode === 'create' ? 'Add Rate' : 'Edit Rate'}</h2>
      <p class="modal-note">All rates are in Indian Rupees (₹ INR).</p>

      <div class="form-grid">
        {#if modalMode === 'create'}
          <div class="form-group">
            <label class="form-label" for="f-call-type">Call Type</label>
            <select id="f-call-type" class="form-select" bind:value={formCallType}>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Currency</label>
            <div class="form-static">₹ INR (fixed)</div>
          </div>
        {:else}
          <div class="form-group">
            <label class="form-label">Call Type</label>
            <div class="form-static">{formCallType.charAt(0).toUpperCase() + formCallType.slice(1)}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Currency</label>
            <div class="form-static">₹ INR (fixed)</div>
          </div>
        {/if}

        <div class="form-group span-2">
          <label class="form-label" for="f-rate">Rate per Minute (₹)</label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">₹</span>
            <input
              id="f-rate"
              class="form-input with-prefix"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              bind:value={formRatePerMinute}
            />
          </div>
        </div>

        <div class="form-group span-2">
          <label class="form-label" for="f-effective">Effective From</label>
          <input id="f-effective" class="form-input" type="datetime-local" bind:value={formEffectiveFrom}/>
        </div>

        <div class="form-group span-2">
          <label class="form-label" for="f-label">
            Label <span class="optional">(optional)</span>
          </label>
          <input
            id="f-label"
            class="form-input"
            type="text"
            maxlength="120"
            placeholder="e.g. Standard rate"
            bind:value={formLabel}
          />
        </div>
      </div>

      {#if modalError}<p class="modal-error">{modalError}</p>{/if}

      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" on:click={closeModal} disabled={saving}>Cancel</button>
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
  .pricing-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    gap: 1.5rem;
    padding: 1.5rem 2rem;
    width: 100%;
    box-sizing: border-box;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .page-title { margin: 0; font-size: 1.375rem; font-weight: 700; line-height: 1.2; }
  .page-subtitle { margin: 0.25rem 0 0; font-size: 0.8125rem; opacity: 0.65; }

  /* ── Active summary ── */
  .active-summary { display: flex; gap: 0.75rem; flex-wrap: wrap; }

  .active-card {
    flex: 1;
    min-inline-size: 160px;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.875rem 1rem;
    border-radius: 10px;
    background: var(--pico-card-background-color);
    border: 1px solid var(--pico-muted-border-color);
  }

  .active-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    opacity: 0.6;
  }

  .active-value { font-size: 1rem; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* ── Settings section ── */
  .settings-section { display: flex; flex-direction: column; gap: 0.625rem; }

  .section-title { margin: 0; font-size: 1rem; font-weight: 700; }

  .section-subtitle { margin: 0.25rem 0 0; font-size: 0.8125rem; opacity: 0.65; max-inline-size: 620px; }

  .settings-card {
    padding: 1.125rem 1.25rem;
    border-radius: 10px;
    background: var(--pico-card-background-color);
    border: 1px solid var(--pico-muted-border-color);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .settings-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }

  .settings-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-inline-size: 160px;
    flex: 1;
  }

  .field-hint { margin: 0; font-size: 0.75rem; opacity: 0.55; }

  .settings-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-block-start: 0.25rem;
  }

  .settings-num {
    inline-size: 5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .input-unit { font-size: 0.8125rem; opacity: 0.6; font-weight: 600; }

  .settings-error { margin: 0; font-size: 0.8125rem; color: var(--pico-del-color, #f38ba8); }

  .settings-actions { display: flex; align-items: center; gap: 0.75rem; }

  .saved-note { font-size: 0.8125rem; opacity: 0.5; }

  /* ── Rate tables ── */
  .rate-tables { display: flex; flex-direction: column; gap: 2rem; }
  .rate-section { display: flex; flex-direction: column; gap: 0.75rem; }

  .empty-note { margin: 0; font-size: 0.875rem; opacity: 0.6; font-style: italic; }

  .table-wrap {
    border: 1px solid var(--pico-muted-border-color);
    border-radius: 10px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .rate-table {
    inline-size: 100%;
    min-inline-size: 580px; /* horizontal scroll kicks in below this */
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .rate-table thead {
    background: color-mix(in srgb, var(--pico-muted-background-color) 60%, transparent);
  }

  .rate-table th,
  .rate-table td {
    padding: 0.625rem 0.875rem;
    text-align: left;
    border-bottom: 1px solid var(--pico-muted-border-color);
  }

  .rate-table tbody tr:last-child td { border-bottom: none; }

  .rate-table th {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  .rate-table tbody tr:hover {
    background: color-mix(in srgb, var(--pico-primary) 5%, transparent);
  }

  .active-row {
    background: color-mix(in srgb, var(--pico-primary) 8%, transparent) !important;
  }

  .rate-cell { font-weight: 700; font-variant-numeric: tabular-nums; }
  .date-cell { white-space: nowrap; }
  .label-cell { opacity: 0.75; }
  .actions-cell { white-space: nowrap; }

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

  .status-badge.scheduled {
    background: color-mix(in srgb, #89b4fa 15%, transparent);
    color: #89b4fa;
    border: 1px solid color-mix(in srgb, #89b4fa 35%, transparent);
  }

  .status-badge.expired {
    background: color-mix(in srgb, currentColor 8%, transparent);
    color: currentColor;
    opacity: 0.5;
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  }

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

  .btn-primary { background: var(--pico-primary); color: var(--pico-primary-inverse, #fff); }
  .btn-primary:hover:not(:disabled) { filter: brightness(1.1); }

  .btn-ghost {
    background: transparent;
    color: #000;
    border: 1px solid var(--pico-muted-border-color);
  }
  .btn-ghost:hover:not(:disabled) { background: var(--pico-muted-background-color); }

  .btn-danger { background: var(--pico-del-color, #f38ba8); color: #fff; }
  .btn-danger:hover:not(:disabled) { filter: brightness(1.1); }

  /* ── Actions column ── */
  .actions-th {
    white-space: nowrap;
    min-inline-size: 140px;
  }

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
    color: var(--pico-del-color, #f38ba8);
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

  @keyframes spin { to { transform: rotate(360deg); } }

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
    inline-size: min(520px, calc(100vw - 2rem));
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

  .modal-note { margin: 0; font-size: 0.8125rem; opacity: 0.6; }

  .modal-body-text { margin: 0; font-size: 0.875rem; line-height: 1.5; opacity: 0.85; }

  .modal-error { margin: 0; font-size: 0.8125rem; color: var(--pico-del-color, #f38ba8); }

  .modal-actions { display: flex; justify-content: flex-end; gap: 0.625rem; }

  /* ── Form ── */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
  .span-2 { grid-column: span 2; }

  .form-label { font-size: 0.8125rem; font-weight: 600; }
  .optional { font-weight: 400; opacity: 0.6; }

  .form-input,
  .form-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--pico-muted-border-color);
    border-radius: 8px;
    background: var(--pico-background-color);
    color: var(--pico-color);
    font-size: 0.875rem;
    transition: border-color 120ms ease;
    outline: none;
  }

  .form-input:focus,
  .form-select:focus { border-color: var(--pico-primary); }

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

  .form-input.with-prefix {
    padding-inline-start: 1.75rem;
    inline-size: 100%;
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .pricing-page {
      padding: 1rem;
      gap: 1.25rem;
    }

    .page-header {
      flex-direction: column;
      align-items: stretch;
    }

    .page-header .btn {
      align-self: flex-start;
    }

    .active-summary {
      gap: 0.5rem;
    }

    .active-card {
      min-inline-size: 0;
      flex: 1 1 calc(50% - 0.25rem);
    }

    .settings-row {
      flex-direction: column;
      gap: 1rem;
    }

    .settings-field {
      min-inline-size: 0;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .form-grid .span-2 {
      grid-column: 1;
    }

    .modal-actions {
      flex-direction: column-reverse;
    }

    .modal-actions .btn {
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 400px) {
    .active-card {
      flex: 1 1 100%;
    }
  }

  /* ── Delete confirmation ── */
  .modal-title--danger { color: var(--pico-del-color, #f38ba8); }

  .delete-confirm-body {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .delete-confirm-icon {
    flex-shrink: 0;
    color: var(--pico-del-color, #f38ba8);
    opacity: 0.85;
    margin-block-start: 0.125rem;
  }

  .delete-warning {
    margin: 0.5rem 0 0;
    font-size: 0.8125rem;
    opacity: 0.65;
    line-height: 1.45;
  }

</style>
