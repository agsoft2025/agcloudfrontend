<!--
  Admin > Reports
  ===============
  Search for a user by name/email → view paginated call + subscription
  history → download complete history as CSV.

  Pagination is driven from the backend (page/limit/callType/status query
  params). The Download button fetches the separate /export endpoint which
  returns all records, regardless of the current page.

  Dropdown fix: items use on:mousedown|preventDefault so the input never
  loses focus — no blur/click race condition.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Avatar   from '$lib/components/atoms/Avatar.svelte';
  import Spinner  from '$lib/components/atoms/Spinner.svelte';
  import {
    adminGetEnrichedUsers,
    adminGetUserReport,
    adminExportUserReport,
    type AdminEnrichedUser,
    type AdminUserReport,
    type AdminReportCall,
    type AdminReportSubscription,
  } from '$lib/api/subscription.api';

  // ── Constants ─────────────────────────────────────────────────
  const PAGE_SIZE = 20;

  // ── User search ───────────────────────────────────────────────
  let allUsers:      AdminEnrichedUser[] = [];
  let usersLoading   = true;
  let searchQuery    = '';
  let showDropdown   = false;
  let searchWrapEl: HTMLDivElement | undefined;

  $: filteredUsers = searchQuery.trim().length < 1
    ? []
    : allUsers.filter((u) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          (u.displayName ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }).slice(0, 10);

  // ── Selected user + report ────────────────────────────────────
  let selectedUserId: string | null        = null;
  let selectedUser:   AdminEnrichedUser | null = null;
  let report:         AdminUserReport | null   = null;
  let reportLoading   = false;

  // ── Pagination state ──────────────────────────────────────────
  let currentPage  = 1;
  let totalPages   = 1;
  let totalCalls   = 0;

  // ── Backend-driven filters ────────────────────────────────────
  let filterCallType = '';
  let filterStatus   = '';

  // ── Download state ────────────────────────────────────────────
  let downloading = false;

  // ── Toast ─────────────────────────────────────────────────────
  type ToastKind = 'error' | 'success';
  let toastMsg:     string    = '';
  let toastKind:    ToastKind = 'error';
  let toastVisible  = false;
  let toastTimer:   ReturnType<typeof setTimeout> | null = null;

  function showToast(msg: string, kind: ToastKind = 'error') {
    toastMsg     = msg;
    toastKind    = kind;
    toastVisible = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible = false; }, 5000);
  }
  function dismissToast() {
    toastVisible = false;
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  // ── Unique call statuses (for filter dropdown) ────────────────
  $: callStatuses = [...new Set((report?.calls ?? []).map((c) => c.status))].sort();

  // ── Load user list on mount ───────────────────────────────────
  onMount(async () => {
    try   { allUsers = await adminGetEnrichedUsers(); }
    catch { /* non-fatal */ }
    finally { usersLoading = false; }
  });

  // ── Close dropdown on outside click ──────────────────────────
  function handleWindowClick(e: MouseEvent) {
    if (searchWrapEl && !searchWrapEl.contains(e.target as Node)) {
      showDropdown = false;
    }
  }
  onMount   (() => window.addEventListener('click', handleWindowClick, true));
  onDestroy (() => window.removeEventListener('click', handleWindowClick, true));

  // ── Load a page of call history ───────────────────────────────
  async function loadReport(userId: string, page: number) {
    reportLoading = true;
    try {
      report      = await adminGetUserReport(userId, page, PAGE_SIZE, filterCallType || undefined, filterStatus || undefined);
      currentPage = report.page;
      totalPages  = report.totalPages;
      totalCalls  = report.totalCalls;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load report. Please try again.');
      report = null;
    } finally {
      reportLoading = false;
    }
  }

  // ── Select user from search dropdown ─────────────────────────
  async function selectUser(u: AdminEnrichedUser) {
    if (selectedUserId === u.id && report !== null) return;  // no-op on same user

    selectedUserId  = u.id;
    selectedUser    = u;
    searchQuery     = u.displayName?.trim() || u.email.split('@')[0];
    showDropdown    = false;
    report          = null;
    currentPage     = 1;
    filterCallType  = '';
    filterStatus    = '';

    await loadReport(u.id, 1);
  }

  function clearSelection() {
    selectedUserId  = null;
    selectedUser    = null;
    report          = null;
    searchQuery     = '';
    showDropdown    = false;
    currentPage     = 1;
    filterCallType  = '';
    filterStatus    = '';
    dismissToast();
  }

  // ── Filter change → reset to page 1 and reload ───────────────
  async function applyFilters() {
    if (!selectedUserId) return;
    currentPage = 1;
    await loadReport(selectedUserId, 1);
  }

  // ── Page navigation ───────────────────────────────────────────
  async function goToPage(page: number) {
    if (!selectedUserId || page < 1 || page > totalPages || page === currentPage) return;
    await loadReport(selectedUserId, page);
    // Scroll call table into view
    document.querySelector('.calls-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Pagination page numbers (window around current page) ──────
  function getPageNumbers(current: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const delta = 2;
    const left  = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);
    const pages: (number | '…')[] = [1];
    if (left > 2)     pages.push('…');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push('…');
    pages.push(total);
    return pages;
  }
  $: pageNumbers = getPageNumbers(currentPage, totalPages);

  // ── Helpers ───────────────────────────────────────────────────
  function uiName(u: AdminEnrichedUser | null): string {
    if (!u) return '';
    return u.displayName?.trim() || u.email.split('@')[0];
  }
  function initials(u: AdminEnrichedUser | null): string {
    return uiName(u).slice(0, 2).toUpperCase();
  }
  function fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDur(sec: number): string {
    if (sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  function fmtMin(sec: number): string {
    return (sec / 60).toFixed(2) + ' min';
  }
  function fmtMoney(n: number | null): string {
    if (n === null) return '—';
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function planLabel(months: number): string {
    if (months === 12) return '1 Year';
    if (months === 6)  return '6 Months';
    if (months === 3)  return '3 Months';
    return '1 Month';
  }
  function callStatusCls(status: string): string {
    switch (status) {
      case 'ended':     return 'st-ended';
      case 'active':    return 'st-active';
      case 'initiated': return 'st-init';
      case 'missed':
      case 'rejected':
      case 'cancelled': return 'st-missed';
      default:          return 'st-other';
    }
  }
  function subStatusCls(s: string): string {
    if (s === 'active')  return 'sub-active';
    if (s === 'expired') return 'sub-expired';
    return 'sub-none';
  }

  // ── CSV export — fetches ALL records via /export endpoint ─────
  function escapeCsv(val: string | number | null | undefined): string {
    const s = val === null || val === undefined ? '' : String(val);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  }

  /** Find the subscription active at call time, or the most recent one. */
  function subAtCallTime(
    call: AdminReportCall,
    subs: AdminReportSubscription[],
  ): AdminReportSubscription | null {
    if (subs.length === 0) return null;
    const callDate = call.startedAt ? new Date(call.startedAt) : null;
    if (callDate) {
      const active = subs.find((s) => {
        const start = s.startDate ? new Date(s.startDate) : null;
        const end   = s.endDate   ? new Date(s.endDate)   : null;
        return start && end && callDate >= start && callDate <= end;
      });
      if (active) return active;
    }
    // Fall back to most recent
    return subs[0] ?? null;
  }

  async function downloadCsv() {
    if (!selectedUserId || !selectedUser) return;
    downloading = true;
    try {
      const data = await adminExportUserReport(selectedUserId);
      if (data.calls.length === 0) {
        showToast('No call history to export for this user.', 'error');
        return;
      }

      const header = [
        'Date/Time', 'Start Time', 'End Time',
        'Caller Name', 'Caller Email',
        'Receiver(s)',
        'Call Type', 'Call Mode', 'Status',
        'Duration', 'Duration (s)',
        'Audio Minutes', 'Video Minutes',
        'Amount Charged (₹)',
        'Subscription Plan', 'Subscription Status',
      ].map(escapeCsv).join(',');

      const rows = data.calls.map((c: AdminReportCall) => {
        const sub   = subAtCallTime(c, data.subscriptions);
        const durS  = c.durationSeconds;
        const audioMin = c.callType === 'audio' ? (durS / 60).toFixed(2) : '0.00';
        const videoMin = c.callType === 'video' ? (durS / 60).toFixed(2) : '0.00';
        return [
          c.startedAt ? new Date(c.startedAt).toLocaleString() : (c.createdAt ? new Date(c.createdAt).toLocaleString() : ''),
          c.startedAt ? new Date(c.startedAt).toLocaleString() : '',
          c.endedAt   ? new Date(c.endedAt).toLocaleString()   : '',
          c.callerName, c.callerEmail,
          c.receivers.map((r) => `${r.displayName || r.email} <${r.email}>`).join('; '),
          c.callType, c.callMode, c.status,
          fmtDur(durS), durS,
          audioMin, videoMin,
          c.amountCharged ?? '',
          sub ? `${sub.planName} (${planLabel(sub.durationMonths)})` : 'None',
          sub ? sub.status : 'None',
        ].map(escapeCsv).join(',');
      });

      const u       = data.user;
      const safeName = (u.displayName || u.email).replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const csv = [
        `# User Report — ${u.displayName || u.email} <${u.email}>`,
        `# User ID: ${u.id}`,
        `# Generated: ${new Date().toLocaleString()}`,
        `# Total Calls: ${data.totalCalls}  |  Subscriptions: ${data.subscriptions.length}`,
        '',
        header,
        ...rows,
      ].join('\r\n');

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${safeName}-call-history.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Downloaded ${data.calls.length} records for ${u.displayName || u.email}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      downloading = false;
    }
  }

  $: rangeStart = totalCalls === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  $: rangeEnd   = Math.min(currentPage * PAGE_SIZE, totalCalls);
</script>

<!-- ── Toast ──────────────────────────────────────────────────────── -->
{#if toastVisible}
  <div class="toast toast--{toastKind}" role="alert" aria-live="assertive">
    {#if toastKind === 'success'}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
        <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    {:else}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
    {/if}
    <span class="toast-msg">{toastMsg}</span>
    <button class="toast-close" type="button" aria-label="Dismiss" on:click={dismissToast}>
      <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
{/if}

<div class="admin-page">
  <!-- ── Header ───────────────────────────────────────────────── -->
  <header class="admin-page-header">
    <div class="header-row">
      <div>
        <h1 class="admin-page-title">Reports</h1>
        <p class="admin-page-desc">Search a user to view their paginated call &amp; subscription history.</p>
      </div>
      <button
        class="download-btn"
        type="button"
        disabled={!report || totalCalls === 0 || downloading}
        on:click={downloadCsv}
      >
        {#if downloading}
          <Spinner size="sm" />
          Exporting…
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Download History
        {/if}
      </button>
    </div>
  </header>

  <!-- ── Search ───────────────────────────────────────────────── -->
  <div class="search-section">
    <div class="search-wrap" bind:this={searchWrapEl}>
      <div class="search-field" class:focused={showDropdown}>
        {#if usersLoading}
          <span class="search-icon"><Spinner size="sm" /></span>
        {:else}
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        {/if}
        <input
          class="search-input"
          type="text"
          placeholder="Search by name or email…"
          aria-label="Search users"
          aria-autocomplete="list"
          aria-expanded={showDropdown && filteredUsers.length > 0}
          autocomplete="off"
          spellcheck="false"
          bind:value={searchQuery}
          on:focus={() => { showDropdown = true; }}
          on:input={() => { showDropdown = true; }}
        />
        {#if searchQuery}
          <button
            class="search-clear"
            type="button"
            aria-label="Clear"
            on:mousedown|preventDefault={clearSelection}
          >
            <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
            </svg>
          </button>
        {/if}
      </div>

      <!-- KEY FIX: on:mousedown|preventDefault prevents input blur before click fires -->
      {#if showDropdown && filteredUsers.length > 0}
        <ul class="search-dropdown" role="listbox" aria-label="Matching users">
          {#each filteredUsers as u (u.id)}
            <li
              class="dropdown-item"
              class:is-selected={selectedUserId === u.id}
              role="option"
              aria-selected={selectedUserId === u.id}
              on:mousedown|preventDefault={() => selectUser(u)}
            >
              <Avatar
                src={u.avatarUrl ?? undefined}
                name={(u.displayName ?? u.email).slice(0, 2).toUpperCase()}
                size="sm"
              />
              <div class="dropdown-info">
                <span class="dropdown-name">{u.displayName?.trim() || u.email.split('@')[0]}</span>
                <span class="dropdown-email">{u.email}</span>
              </div>
              {#if u.subscription?.status === 'active'}
                <span class="dropdown-badge">Active Sub</span>
              {/if}
            </li>
          {/each}
        </ul>
      {:else if showDropdown && searchQuery.trim().length >= 1 && !usersLoading && filteredUsers.length === 0}
        <div class="search-no-results" role="status">
          No users match "<strong>{searchQuery.trim()}</strong>"
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Main report ───────────────────────────────────────────── -->
  {#if reportLoading && !report}
    <div class="state-box">
      <Spinner size="md" />
      <span>Loading report…</span>
    </div>

  {:else if !selectedUser}
    <div class="state-box state-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <p>Search and select a user to view their report.</p>
    </div>

  {:else if report}
    <!-- ── User card ───────────────────────────────────────────── -->
    <div class="user-card">
      <Avatar src={report.user.avatarUrl ?? undefined} name={initials(selectedUser)} size="lg" />
      <div class="user-card-info">
        <p class="user-card-name">{report.user.displayName || report.user.email.split('@')[0]}</p>
        <p class="user-card-email">{report.user.email}</p>
        <div class="user-card-meta">
          <span class="role-badge role-badge--{report.user.role}">{report.user.role}</span>
          <span class="status-dot status-dot--{report.user.status}">
            <span class="dot" aria-hidden="true"></span>{report.user.status}
          </span>
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="dim">Joined {fmtDate(report.user.createdAt)}</span>
        </div>
      </div>
      <div class="user-card-stats">
        <div class="stat">
          <span class="stat-val">{totalCalls}</span>
          <span class="stat-lbl">Total Calls</span>
        </div>
        <div class="stat">
          <span class="stat-val">{report.subscriptions.length}</span>
          <span class="stat-lbl">Subscriptions</span>
        </div>
      </div>
    </div>

    <!-- ── Subscription history ────────────────────────────────── -->
    <section class="report-section">
      <h2 class="section-heading">Subscription History</h2>
      {#if report.subscriptions.length === 0}
        <div class="empty-section">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M2 10h20" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <p>No subscription history for this user.</p>
        </div>
      {:else}
        <div class="table-wrap">
          <table class="report-table" aria-label="Subscription history">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Duration</th>
                <th scope="col" class="col-r">Amount Paid</th>
                <th scope="col">Status</th>
                <th scope="col">Start Date</th>
                <th scope="col">Expiry Date</th>
                <th scope="col">Purchased On</th>
              </tr>
            </thead>
            <tbody>
              {#each report.subscriptions as sub (sub.id)}
                <tr>
                  <td class="strong">{sub.planName}</td>
                  <td>{planLabel(sub.durationMonths)}</td>
                  <td class="col-r mono">{fmtMoney(sub.amount)}</td>
                  <td><span class="sub-badge {subStatusCls(sub.status)}">{sub.status}</span></td>
                  <td class="nowrap">{fmtDate(sub.startDate)}</td>
                  <td class="nowrap">{fmtDate(sub.endDate)}</td>
                  <td class="nowrap dim">{fmtDate(sub.createdAt)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- ── Call history ────────────────────────────────────────── -->
    <section class="report-section calls-section">
      <div class="section-head-row">
        <h2 class="section-heading">
          Call History
          {#if totalCalls > 0}
            <span class="count-chip">{totalCalls}</span>
          {/if}
        </h2>

        <!-- Filters (applied server-side) -->
        <div class="call-filters">
          <label class="filter-label">
            <span class="filter-lbl">Type</span>
            <select class="filter-select" bind:value={filterCallType} on:change={applyFilters}>
              <option value="">All</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label class="filter-label">
            <span class="filter-lbl">Status</span>
            <select class="filter-select" bind:value={filterStatus} on:change={applyFilters}>
              <option value="">All</option>
              {#each callStatuses as st}
                <option value={st}>{st}</option>
              {/each}
            </select>
          </label>
          {#if filterCallType || filterStatus}
            <button class="clear-filter-btn" type="button"
              on:click={() => { filterCallType = ''; filterStatus = ''; applyFilters(); }}>
              Clear filters
            </button>
          {/if}
        </div>
      </div>

      {#if reportLoading}
        <!-- Page-change loading overlay keeps the table skeleton visible -->
        <div class="page-loading">
          <Spinner size="md" />
          <span>Loading page {currentPage}…</span>
        </div>
      {:else if totalCalls === 0}
        <div class="empty-section">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.65 3.32 2 2 0 0 1 3.63 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.35 6.35l.98-.97a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>
            {#if filterCallType || filterStatus}
              No calls match the selected filters.
            {:else}
              No call history for this user.
            {/if}
          </p>
        </div>
      {:else}
        <!-- ── Table ──────────────────────────────────────────── -->
        <div class="table-wrap">
          <table class="report-table" aria-label="Call history page {currentPage} of {totalPages}">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Mode</th>
                <th scope="col">Status</th>
                <th scope="col" class="col-r">Duration</th>
                <th scope="col">Date &amp; Time</th>
                <th scope="col">Caller</th>
                <th scope="col">Receiver(s)</th>
                <th scope="col" class="col-r">Charged</th>
              </tr>
            </thead>
            <tbody>
              {#each report.calls as call (call.id)}
                <tr>
                  <td>
                    <span class="type-badge type-badge--{call.callType}">
                      {#if call.callType === 'audio'}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.65 3.32 2 2 0 0 1 3.63 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.35 6.35l.98-.97a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      {:else}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <polygon points="23 7 16 12 23 17 23 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="currentColor"/>
                          <rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                        </svg>
                      {/if}
                      {call.callType}
                    </span>
                  </td>
                  <td class="dim">{call.callMode}</td>
                  <td><span class="call-status {callStatusCls(call.status)}">{call.status}</span></td>
                  <td class="col-r mono">{fmtDur(call.durationSeconds)}</td>
                  <td class="nowrap">{fmt(call.startedAt ?? call.createdAt)}</td>
                  <td>
                    <div class="person-cell">
                      {#if call.callerId === report?.user.id}
                        <span class="you-badge">You</span>
                      {/if}
                      <span class="person-name">{call.callerName || call.callerEmail}</span>
                      <span class="person-email">{call.callerEmail}</span>
                    </div>
                  </td>
                  <td>
                    <div class="person-cell">
                      {#each call.receivers as r (r.userId)}
                        {#if r.userId === report?.user.id}
                          <span class="you-badge">You</span>
                        {/if}
                        <span class="person-name">{r.displayName || r.email}</span>
                        <span class="person-email">{r.email}</span>
                      {/each}
                      {#if call.receivers.length === 0}
                        <span class="dim">—</span>
                      {/if}
                    </div>
                  </td>
                  <td class="col-r mono">
                    {#if call.amountCharged !== null}
                      <span class="charge">{fmtMoney(call.amountCharged)}</span>
                    {:else}
                      <span class="dim" title="Subscribed — not billed separately">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- ── Pagination ──────────────────────────────────────── -->
        {#if totalPages > 1 || totalCalls > 0}
          <div class="pagination" aria-label="Call history pagination">
            <span class="pag-info">
              Showing {rangeStart}–{rangeEnd} of {totalCalls} call{totalCalls === 1 ? '' : 's'}
            </span>

            <div class="pag-controls">
              <button
                class="page-btn"
                type="button"
                aria-label="Previous page"
                disabled={currentPage === 1 || reportLoading}
                on:click={() => goToPage(currentPage - 1)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>

              {#each pageNumbers as pg}
                {#if pg === '…'}
                  <span class="page-ellipsis" aria-hidden="true">…</span>
                {:else}
                  <button
                    class="page-btn page-num"
                    class:active={pg === currentPage}
                    type="button"
                    aria-label="Page {pg}"
                    aria-current={pg === currentPage ? 'page' : undefined}
                    disabled={pg === currentPage || reportLoading}
                    on:click={() => goToPage(pg as number)}
                  >
                    {pg}
                  </button>
                {/if}
              {/each}

              <button
                class="page-btn"
                type="button"
                aria-label="Next page"
                disabled={currentPage === totalPages || reportLoading}
                on:click={() => goToPage(currentPage + 1)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        {/if}
      {/if}
    </section>
  {/if}
</div>

<style lang="postcss">
  /* ── Toast ───────────────────────────────────────────────────── */
  .toast {
    position: fixed; inset-block-start: 1.25rem; inset-inline-end: 1.25rem;
    z-index: 300; display: flex; align-items: center; gap: 0.6rem;
    padding: 0.7rem 1rem; border-radius: var(--radius-md, 8px);
    max-inline-size: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    animation: toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(-12px) scale(0.96); }
    to   { opacity: 1; transform: none; }
  }
  .toast--error   { background: #fee2e2; border: 1.5px solid #fca5a5; color: #b91c1c; }
  .toast--success { background: #dcfce7; border: 1.5px solid #86efac; color: #166534; }
  .toast-msg      { flex: 1; font-size: 0.875rem; font-weight: 500; line-height: 1.4; }
  .toast-close    {
    display: grid; place-items: center; flex-shrink: 0;
    inline-size: 1.5rem; block-size: 1.5rem;
    border: none; background: rgba(0,0,0,0.08); border-radius: 4px;
    cursor: pointer; color: inherit; transition: background-color 120ms ease;
  }
  .toast-close:hover { background: rgba(0,0,0,0.15); }

  /* ── Page shell ──────────────────────────────────────────────── */
  .admin-page {
    display: flex; flex-direction: column; flex: 1; min-block-size: 0;
    padding: 2rem 2.5rem; overflow-y: auto; gap: 1.5rem;
  }

  /* ── Header ──────────────────────────────────────────────────── */
  .admin-page-header { flex-shrink: 0; }
  .header-row {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 1rem; padding-block-end: 1.25rem; border-block-end: 1px solid var(--color-border);
  }
  .admin-page-title { margin: 0 0 0.25rem; font-size: 1.375rem; font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; }
  .admin-page-desc  { margin: 0; font-size: 0.875rem; color: var(--color-text); opacity: 0.6; }

  .download-btn {
    display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0;
    padding: 0.45rem 1rem; font-size: 0.8125rem; font-weight: 600;
    border: 1.5px solid var(--color-border); border-radius: var(--radius-md, 8px);
    background: var(--color-surface); color: var(--color-text); cursor: pointer;
    transition: background-color 140ms ease, border-color 140ms ease, opacity 140ms ease;
  }
  .download-btn:hover:not(:disabled) { background: var(--color-surface-raised); border-color: var(--color-border-strong); }
  .download-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Search ───────────────────────────────────────────────────── */
  .search-section { flex-shrink: 0; }
  .search-wrap    { position: relative; max-inline-size: 520px; }

  .search-field {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 0.75rem; background: var(--color-surface);
    border: 1.5px solid var(--color-border); border-radius: var(--radius-md, 8px);
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }
  .search-field.focused,
  .search-field:focus-within {
    border-color: var(--color-secondary, #6366f1);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-secondary, #6366f1) 15%, transparent);
  }
  .search-icon  { flex-shrink: 0; color: var(--color-text); opacity: 0.45; display: flex; align-items: center; }
  .search-input {
    flex: 1; border: none; background: transparent; font-size: 0.9375rem;
    font-family: inherit; color: var(--color-text); outline: none; min-inline-size: 0;
  }
  .search-input::placeholder { color: var(--color-text); opacity: 0.4; }
  .search-clear {
    display: grid; place-items: center; inline-size: 1.35rem; block-size: 1.35rem;
    border: none; background: color-mix(in srgb, var(--color-text) 10%, transparent);
    border-radius: 50%; color: var(--color-text); cursor: pointer; opacity: 0.6; flex-shrink: 0;
    transition: opacity 120ms ease;
  }
  .search-clear:hover { opacity: 1; }

  .search-dropdown {
    position: absolute; inset-block-start: calc(100% + 6px); inset-inline-start: 0;
    inline-size: 100%; z-index: 100; list-style: none; margin: 0; padding: 0.25rem;
    background: var(--color-surface); border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.2);
    max-block-size: 340px; overflow-y: auto; pointer-events: auto;
  }
  .dropdown-item {
    display: flex; align-items: center; gap: 0.65rem;
    padding: 0.55rem 0.65rem; border-radius: 6px; cursor: pointer;
    user-select: none; transition: background-color 100ms ease;
  }
  .dropdown-item:hover,
  .dropdown-item.is-selected { background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
  .dropdown-info  { display: flex; flex-direction: column; flex: 1; min-inline-size: 0; }
  .dropdown-name  { font-size: 0.875rem; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dropdown-email { font-size: 0.72rem; color: var(--color-text); opacity: 0.55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dropdown-badge {
    flex-shrink: 0; font-size: 0.625rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 0.15rem 0.4rem; border-radius: 4px;
    background: color-mix(in srgb, #38a169 12%, transparent); color: #276749;
  }
  .search-no-results {
    position: absolute; inset-block-start: calc(100% + 6px); inset-inline-start: 0;
    inline-size: 100%; z-index: 100; padding: 0.75rem 1rem;
    background: var(--color-surface); border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md, 8px); font-size: 0.875rem; color: var(--color-text); opacity: 0.65;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }

  /* ── States ───────────────────────────────────────────────────── */
  .state-box {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0.75rem; flex: 1; min-block-size: 14rem;
    color: var(--color-text); opacity: 0.55; font-size: 0.9375rem;
  }
  .state-box p    { margin: 0; }
  .state-placeholder { opacity: 0.38; }

  /* ── User card ────────────────────────────────────────────────── */
  .user-card {
    display: flex; align-items: center; gap: 1rem; flex-shrink: 0;
    padding: 1.1rem 1.35rem; background: var(--color-surface);
    border: 1px solid var(--color-border); border-radius: var(--radius-lg, 12px);
    box-shadow: var(--shadow-xs);
  }
  .user-card-info   { flex: 1; min-inline-size: 0; }
  .user-card-name   { margin: 0 0 0.15rem; font-size: 1rem; font-weight: 700; color: var(--color-text); }
  .user-card-email  { margin: 0 0 0.4rem; font-size: 0.8125rem; color: var(--color-text); opacity: 0.6; }
  .user-card-meta   { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .meta-sep   { color: var(--color-text); opacity: 0.3; }
  .user-card-stats  { display: flex; gap: 1.5rem; flex-shrink: 0; }
  .stat     { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; }
  .stat-val { font-size: 1.375rem; font-weight: 800; color: var(--color-text); line-height: 1; }
  .stat-lbl { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-text); opacity: 0.5; }

  /* ── Badges ───────────────────────────────────────────────────── */
  .role-badge { display: inline-block; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 4px; }
  .role-badge--admin { background: color-mix(in srgb, #7c3aed 12%, transparent); color: #5b21b6; }
  .role-badge--user  { background: color-mix(in srgb, var(--color-text) 8%, transparent); color: var(--color-text); opacity: 0.8; }

  .status-dot     { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8125rem; text-transform: capitalize; }
  .dot            { display: inline-block; inline-size: 7px; block-size: 7px; border-radius: 999px; flex-shrink: 0; }
  .status-dot--active    .dot { background: #38a169; }
  .status-dot--suspended .dot { background: #dd6b20; }

  .sub-badge   { display: inline-block; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 4px; }
  .sub-active  { background: color-mix(in srgb, #38a169 12%, transparent); color: #276749; }
  .sub-expired { background: color-mix(in srgb, #dd6b20 10%, transparent); color: #c05621; }
  .sub-none    { background: color-mix(in srgb, var(--color-text) 7%, transparent); color: var(--color-text); opacity: 0.6; }

  /* ── Report sections ──────────────────────────────────────────── */
  .report-section    { display: flex; flex-direction: column; gap: 0.75rem; flex-shrink: 0; }
  .section-heading   { margin: 0; font-size: 0.9375rem; font-weight: 700; color: var(--color-text); display: flex; align-items: center; gap: 0.5rem; }
  .count-chip {
    font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 99px;
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
  }
  .section-head-row  { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }

  .empty-section {
    display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
    padding: 2.5rem 1rem; color: var(--color-text); opacity: 0.45;
    font-size: 0.875rem; text-align: center;
  }
  .empty-section p { margin: 0; }

  /* ── Loading overlay (page change) ───────────────────────────── */
  .page-loading {
    display: flex; align-items: center; justify-content: center; gap: 0.75rem;
    min-block-size: 8rem; color: var(--color-text); opacity: 0.55; font-size: 0.9rem;
  }

  /* ── Filters ──────────────────────────────────────────────────── */
  .call-filters    { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
  .filter-label    { display: flex; align-items: center; gap: 0.4rem; }
  .filter-lbl      { font-size: 0.75rem; font-weight: 600; color: var(--color-text); opacity: 0.6; }
  .filter-select {
    padding: 0.3rem 1.75rem 0.3rem 0.55rem; font-size: 0.8rem; font-family: inherit;
    color: var(--color-text); background: var(--color-surface); border: 1.5px solid var(--color-border);
    border-radius: 6px; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 0.5rem center;
  }
  .filter-select:focus { outline: 2px solid var(--color-secondary); outline-offset: 1px; }
  .clear-filter-btn {
    font-size: 0.75rem; font-weight: 600; color: var(--color-primary); background: none;
    border: none; cursor: pointer; padding: 0; text-decoration: underline; transition: opacity 120ms ease;
  }
  .clear-filter-btn:hover { opacity: 0.75; }

  /* ── Tables ───────────────────────────────────────────────────── */
  .table-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-lg, 12px); }
  .report-table { inline-size: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  .report-table thead { background: color-mix(in srgb, var(--color-surface) 60%, var(--color-border) 40%); }
  .report-table th {
    padding: 0.6rem 0.85rem; text-align: start; font-size: 0.68rem; font-weight: 700;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-text); opacity: 0.6;
    border-block-end: 1px solid var(--color-border); white-space: nowrap;
  }
  .report-table th.col-r { text-align: right; }
  .report-table tbody tr { border-block-end: 1px solid var(--color-border); transition: background-color 120ms ease; }
  .report-table tbody tr:last-child { border-block-end: none; }
  .report-table tbody tr:hover { background: color-mix(in srgb, var(--color-primary) 4%, transparent); }
  .report-table td { padding: 0.6rem 0.85rem; color: var(--color-text); vertical-align: middle; }
  .col-r  { text-align: right; }
  .nowrap { white-space: nowrap; }
  .strong { font-weight: 700; }
  .mono   { font-variant-numeric: tabular-nums; }
  .dim    { color: var(--color-text); opacity: 0.45; }
  .charge { font-weight: 600; color: #dd6b20; }

  .type-badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 0.2rem 0.5rem; border-radius: 4px;
  }
  .type-badge--audio { background: color-mix(in srgb, #3182ce 10%, transparent); color: #2b6cb0; }
  .type-badge--video { background: color-mix(in srgb, #7c3aed 10%, transparent); color: #5b21b6; }

  .call-status { display: inline-block; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 4px; }
  .st-ended  { background: color-mix(in srgb, #718096 10%, transparent); color: #4a5568; }
  .st-active { background: color-mix(in srgb, #38a169 12%, transparent); color: #276749; }
  .st-init   { background: color-mix(in srgb, #3182ce 10%, transparent); color: #2b6cb0; }
  .st-missed { background: color-mix(in srgb, #dd6b20 10%, transparent); color: #c05621; }
  .st-other  { background: color-mix(in srgb, var(--color-text) 8%, transparent); color: var(--color-text); opacity: 0.7; }

  .person-cell  { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.4rem; }
  .person-name  { font-weight: 600; font-size: 0.8125rem; white-space: nowrap; }
  .person-email { font-size: 0.72rem; color: var(--color-text); opacity: 0.55; white-space: nowrap; }
  .you-badge {
    font-size: 0.6rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
    padding: 0.1rem 0.35rem; border-radius: 3px;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
  }

  /* ── Pagination ───────────────────────────────────────────────── */
  .pagination {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-shrink: 0; flex-wrap: wrap;
    padding-block-start: 0.25rem;
  }
  .pag-info { font-size: 0.8125rem; color: var(--color-text); opacity: 0.55; font-variant-numeric: tabular-nums; }
  .pag-controls { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }

  .page-btn {
    display: grid; place-items: center; min-inline-size: 2rem; block-size: 2rem;
    padding: 0 0.3rem;
    border: 1.5px solid var(--color-border); border-radius: 6px;
    background: var(--color-surface); color: var(--color-text);
    cursor: pointer; font-size: 0.8125rem; font-weight: 500;
    transition: background-color 120ms ease, border-color 120ms ease;
  }
  .page-btn:hover:not(:disabled) { background: var(--color-surface-raised); border-color: var(--color-border-strong); }
  .page-btn:disabled { opacity: 0.35; cursor: default; }
  .page-btn.page-num.active {
    background: var(--color-primary, #3b82f6); color: #fff;
    border-color: var(--color-primary, #3b82f6);
  }
  .page-ellipsis { font-size: 0.875rem; color: var(--color-text); opacity: 0.4; padding: 0 0.25rem; }

  /* ── Responsive ───────────────────────────────────────────────── */
  @media (max-width: 800px) {
    .admin-page       { padding: 1.25rem 1rem; }
    .user-card        { flex-direction: column; align-items: flex-start; }
    .user-card-stats  { align-self: stretch; justify-content: space-around; }
    .section-head-row { flex-direction: column; align-items: flex-start; }
    .toast            { inset-inline-end: 0.75rem; inset-inline-start: 0.75rem; max-inline-size: 100%; }
    .pagination       { flex-direction: column; align-items: flex-start; }
    .pag-controls     { flex-wrap: wrap; }
  }
</style>
