<!--
  Admin > User List
  =================
  Lists all registered users via GET /users (getContacts).
  CRUD operations call /users endpoints via apiPost / apiPut / apiDelete.
  Filtering and pagination are applied client-side.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Avatar from '$lib/components/atoms/Avatar.svelte';
  import Spinner from '$lib/components/atoms/Spinner.svelte';
  import { getContacts } from '$lib/api/contacts.api';
  import { apiPost, apiPut, apiDelete } from '$lib/api/client';
  import type { UserProfile } from '$lib/stores/user.store';

  // ── Constants ─────────────────────────────────────────────────
  const PAGE_SIZE = 20;

  // ── List state ────────────────────────────────────────────────
  let allUsers: UserProfile[] = [];
  let isLoading = true;
  let loadError: string | null = null;

  // ── Filters ───────────────────────────────────────────────────
  let searchQuery = '';
  let filterRole: '' | 'admin' | 'user' = '';
  let filterStatus: '' | 'active' | 'suspended' = '';

  // ── Pagination ────────────────────────────────────────────────
  let currentPage = 1;

  // ── Modal ─────────────────────────────────────────────────────
  type ModalMode = 'view' | 'create' | 'edit' | 'delete';
  let modal: { mode: ModalMode; user?: UserProfile } | null = null;

  // Form fields (shared between create / edit)
  let formEmail      = '';
  let formName       = '';
  let formRole: 'admin' | 'user' = 'user';
  let formStatus: 'active' | 'suspended' = 'active';
  let formPassword   = '';
  let formError: string | null = null;
  let formSubmitting = false;

  // ── Derived ───────────────────────────────────────────────────
  $: filteredUsers = applyFilters(allUsers, searchQuery, filterRole, filterStatus);
  $: filteredUsers, (currentPage = 1);
  $: totalPages  = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  $: pagedUsers  = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  $: rangeStart  = filteredUsers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  $: rangeEnd    = Math.min(currentPage * PAGE_SIZE, filteredUsers.length);
  $: hasFilter   = searchQuery !== '' || filterRole !== '' || filterStatus !== '';

  function applyFilters(
    users: UserProfile[],
    search: string,
    role: string,
    status: string,
  ): UserProfile[] {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const name  = (u.displayName ?? '').toLowerCase();
        const email = (u.email ?? '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      if (role   && u.role   !== role)   return false;
      if (status && u.status !== status) return false;
      return true;
    });
  }

  function clearFilter() {
    searchQuery  = '';
    filterRole   = '';
    filterStatus = '';
  }

  // ── Fetch ─────────────────────────────────────────────────────
  async function load() {
    isLoading = true;
    loadError = null;
    try {
      allUsers = await getContacts();
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Could not load users.';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => void load());

  // ── Helpers ───────────────────────────────────────────────────
  function displayName(u: UserProfile): string {
    return u.displayName?.trim() || u.email.split('@')[0];
  }

  function initials(u: UserProfile): string {
    const n = displayName(u);
    return n.slice(0, 2).toUpperCase();
  }

  function formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Modal helpers ─────────────────────────────────────────────
  function openCreate() {
    formEmail = ''; formName = ''; formRole = 'user';
    formStatus = 'active'; formPassword = ''; formError = null; formSubmitting = false;
    modal = { mode: 'create' };
  }

  function openView(u: UserProfile) {
    modal = { mode: 'view', user: u };
  }

  function openEdit(u: UserProfile) {
    formName     = u.displayName ?? '';
    formRole     = (u.role === 'admin' ? 'admin' : 'user');
    formStatus   = (u.status === 'suspended' ? 'suspended' : 'active');
    formError    = null;
    formSubmitting = false;
    modal = { mode: 'edit', user: u };
  }

  function openDelete(u: UserProfile) {
    formError = null; formSubmitting = false;
    modal = { mode: 'delete', user: u };
  }

  function closeModal() {
    if (formSubmitting) return;
    modal = null;
  }

  function handleBackdropKey(e: KeyboardEvent) {
    if (e.key === 'Escape') closeModal();
  }

  function handleModalClick(e: MouseEvent) {
    e.stopPropagation();
  }

  // ── CRUD operations ───────────────────────────────────────────
  async function submitCreate() {
    if (!formEmail.trim()) { formError = 'Email is required.'; return; }
    if (!formPassword.trim()) { formError = 'Password is required.'; return; }
    formSubmitting = true; formError = null;
    try {
      const created = await apiPost<UserProfile>('/users', {
        email: formEmail.trim(),
        displayName: formName.trim() || undefined,
        password: formPassword,
        role: formRole,
      });
      allUsers = [created, ...allUsers];
      modal = null;
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Failed to create user.';
    } finally {
      formSubmitting = false;
    }
  }

  async function submitEdit() {
    if (!modal?.user) return;
    formSubmitting = true; formError = null;
    try {
      const updated = await apiPut<UserProfile>(`/users/${modal.user.id}`, {
        displayName: formName.trim() || undefined,
        role: formRole,
        status: formStatus,
      });
      allUsers = allUsers.map((u) => (u.id === updated.id ? { ...u, ...updated } : u));
      modal = null;
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Failed to update user.';
    } finally {
      formSubmitting = false;
    }
  }

  async function submitDelete() {
    if (!modal?.user) return;
    formSubmitting = true; formError = null;
    const targetId = modal.user.id;
    try {
      await apiDelete(`/users/${targetId}`);
      allUsers = allUsers.filter((u) => u.id !== targetId);
      modal = null;
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Failed to delete user.';
    } finally {
      formSubmitting = false;
    }
  }
</script>

<!-- ── Backdrop key handler ──────────────────────────────────── -->
<svelte:window on:keydown={handleBackdropKey} />

<div class="admin-page">

  <!-- ── Page header ──────────────────────────────────────────── -->
  <header class="admin-page-header">
    <div class="header-row">
      <div>
        <h1 class="admin-page-title">User List</h1>
        <p class="admin-page-description">Manage registered users.</p>
      </div>
      <div class="header-actions">
        <button
          class="refresh-btn"
          type="button"
          on:click={() => void load()}
          disabled={isLoading}
          aria-label="Refresh user list"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            class:spinning={isLoading}>
            <path d="M23 4v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Refresh
        </button>
        <button class="add-btn" type="button" on:click={openCreate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          Add User
        </button>
      </div>
    </div>
  </header>

  <!-- ── Filter bar ───────────────────────────────────────────── -->
  <div class="filter-bar" role="search" aria-label="Filter users">
    <div class="search-field">
      <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input
        class="search-input"
        type="text"
        placeholder="Search by name or email…"
        bind:value={searchQuery}
        aria-label="Search by name or email"
      />
      {#if searchQuery}
        <button class="search-clear" type="button" on:click={() => (searchQuery = '')} aria-label="Clear search">
          <svg width="11" height="11" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          </svg>
        </button>
      {/if}
    </div>

    <!-- <span class="filter-divider" aria-hidden="true"></span> -->

    <label class="filter-label">
      <span class="filter-label-text">Role</span>
      <select class="filter-select" bind:value={filterRole} aria-label="Filter by role">
        <option value="">All</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
      </select>
    </label>

    <label class="filter-label">
      <span class="filter-label-text">Status</span>
      <select class="filter-select" bind:value={filterStatus} aria-label="Filter by status">
        <option value="">All</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
    </label>

    {#if hasFilter}
      <button class="clear-btn" type="button" on:click={clearFilter} aria-label="Clear filters">
        <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
        Clear
      </button>
      {#if !isLoading}
        <span class="filter-result-count" aria-live="polite">
          {filteredUsers.length} of {allUsers.length}
        </span>
      {/if}
    {/if}
  </div>

  <!-- ── Loading ──────────────────────────────────────────────── -->
  {#if isLoading}
    <div class="state-box">
      <Spinner size="md" />
      <span>Loading users…</span>
    </div>

  <!-- ── Error ────────────────────────────────────────────────── -->
  {:else if loadError}
    <div class="state-box state-box--error" role="alert">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
      <p>{loadError}</p>
      <button class="action-btn action-btn--outline" type="button" on:click={() => void load()}>Retry</button>
    </div>

  <!-- ── Empty (no users at all) ──────────────────────────────── -->
  {:else if allUsers.length === 0}
    <div class="state-box" role="status">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <p>No users found.</p>
      <button class="action-btn action-btn--primary" type="button" on:click={openCreate}>Add first user</button>
    </div>

  <!-- ── No results after filtering ──────────────────────────── -->
  {:else if filteredUsers.length === 0}
    <div class="state-box" role="status">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/>
        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      </svg>
      <p>No users match the selected filters.</p>
      <button class="action-btn action-btn--outline" type="button" on:click={clearFilter}>Clear filters</button>
    </div>

  <!-- ── Table ────────────────────────────────────────────────── -->
  {:else}
    <div class="table-wrap">
      <table class="user-table" aria-label="User list">
        <thead>
          <tr>
            <th scope="col">User</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col" class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each pagedUsers as user (user.id)}
            <tr>
              <!-- User cell: avatar + name + email -->
              <td>
                <div class="cell-user">
                  <Avatar src={user.avatarUrl ?? undefined} name={initials(user)} size="sm" />
                  <div class="user-info">
                    <span class="user-name">{displayName(user)}</span>
                    <span class="user-email">{user.email}</span>
                  </div>
                </div>
              </td>
              <!-- Role -->
              <td>
                <span class="role-badge role-badge--{user.role ?? 'user'}">
                  {user.role ?? 'user'}
                </span>
              </td>
              <!-- Status -->
              <td>
                <span class="status-dot status-dot--{user.status ?? 'active'}">
                  <span class="dot" aria-hidden="true"></span>
                  {user.status ?? 'active'}
                </span>
              </td>
              <!-- Actions -->
              <td class="col-actions">
                <div class="row-actions">
                  <button
                    class="icon-btn"
                    type="button"
                    title="View"
                    aria-label="View {displayName(user)}"
                    on:click={() => openView(user)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </button>
                  <button
                    class="icon-btn"
                    type="button"
                    title="Edit"
                    aria-label="Edit {displayName(user)}"
                    on:click={() => openEdit(user)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <button
                    class="icon-btn icon-btn--danger"
                    type="button"
                    title="Delete"
                    aria-label="Delete {displayName(user)}"
                    on:click={() => openDelete(user)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M10 11v6M14 11v6"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- ── Pagination ────────────────────────────────────────── -->
    <div class="pagination" aria-label="Pagination">
      <span class="pagination-info">
        {rangeStart}–{rangeEnd} of {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
      </span>
      <div class="pagination-controls">
        <button
          class="page-btn" type="button" aria-label="Previous page"
          disabled={currentPage === 1}
          on:click={() => (currentPage -= 1)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="page-indicator" aria-current="page">Page {currentPage} of {totalPages}</span>
        <button
          class="page-btn" type="button" aria-label="Next page"
          disabled={currentPage === totalPages}
          on:click={() => (currentPage += 1)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  {/if}

</div>

<!-- ── Modal ────────────────────────────────────────────────────── -->
{#if modal}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    class="modal-backdrop"
    role="presentation"
    on:click={closeModal}
    on:keydown={handleBackdropKey}
  >
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      on:click={handleModalClick}
      on:keydown|stopPropagation
    >

      <!-- ── Modal header ──────────────────────────────────── -->
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">
          {#if modal.mode === 'create'} Add User
          {:else if modal.mode === 'edit'} Edit User
          {:else if modal.mode === 'view'} User Details
          {:else} Delete User
          {/if}
        </h2>
        <button class="modal-close" type="button" on:click={closeModal} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- ── View ─────────────────────────────────────────── -->
      {#if modal.mode === 'view' && modal.user}
        {@const u = modal.user}
        <div class="modal-body">
          <div class="view-hero">
            <Avatar src={u.avatarUrl ?? undefined} name={initials(u)} size="lg" />
            <div>
              <p class="view-name">{displayName(u)}</p>
              <p class="view-email">{u.email}</p>
            </div>
          </div>
          <dl class="view-grid">
            <dt>ID</dt>        <dd class="mono">{u.id}</dd>
            <dt>Role</dt>      <dd><span class="role-badge role-badge--{u.role ?? 'user'}">{u.role ?? 'user'}</span></dd>
            <dt>Status</dt>    <dd><span class="status-dot status-dot--{u.status ?? 'active'}"><span class="dot"></span>{u.status ?? 'active'}</span></dd>
          </dl>
        </div>
        <div class="modal-footer">
          <button class="action-btn action-btn--primary" type="button" on:click={() => { if (modal?.user) openEdit(modal.user); }}>Edit</button>
          <button class="action-btn action-btn--outline" type="button" on:click={closeModal}>Close</button>
        </div>

      <!-- ── Create ────────────────────────────────────────── -->
      {:else if modal.mode === 'create'}
        <form class="modal-body" on:submit|preventDefault={submitCreate} novalidate>
          <div class="form-row">
            <label class="form-label" for="f-email">Email <span class="required">*</span></label>
            <input
              id="f-email" class="form-input" type="email"
              bind:value={formEmail} required autocomplete="off"
              placeholder="user@example.com"
            />
          </div>
          <div class="form-row">
            <label class="form-label" for="f-name">Display Name</label>
            <input
              id="f-name" class="form-input" type="text"
              bind:value={formName} autocomplete="off"
              placeholder="Full name"
            />
          </div>
          <div class="form-row">
            <label class="form-label" for="f-password">Password <span class="required">*</span></label>
            <input
              id="f-password" class="form-input" type="password"
              bind:value={formPassword} required autocomplete="new-password"
              placeholder="••••••••"
            />
          </div>
          <div class="form-row">
            <label class="form-label" for="f-role">Role</label>
            <select id="f-role" class="form-select" bind:value={formRole}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {#if formError}
            <p class="form-error" role="alert">{formError}</p>
          {/if}
        </form>
        <div class="modal-footer">
          <button
            class="action-btn action-btn--primary"
            type="button"
            on:click={submitCreate}
            disabled={formSubmitting}
          >
            {#if formSubmitting}<Spinner size="sm" />{/if}
            Create User
          </button>
          <button class="action-btn action-btn--outline" type="button" on:click={closeModal} disabled={formSubmitting}>Cancel</button>
        </div>

      <!-- ── Edit ──────────────────────────────────────────── -->
      {:else if modal.mode === 'edit' && modal.user}
        <form class="modal-body" on:submit|preventDefault={submitEdit} novalidate>
          <div class="view-hero view-hero--sm">
            <Avatar src={modal.user.avatarUrl ?? undefined} name={initials(modal.user)} size="sm" />
            <div>
              <p class="view-name">{displayName(modal.user)}</p>
              <p class="view-email">{modal.user.email}</p>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label" for="e-name">Display Name</label>
            <input
              id="e-name" class="form-input" type="text"
              bind:value={formName} autocomplete="off"
              placeholder="Full name"
            />
          </div>
          <div class="form-row">
            <label class="form-label" for="e-role">Role</label>
            <select id="e-role" class="form-select" bind:value={formRole}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label" for="e-status">Status</label>
            <select id="e-status" class="form-select" bind:value={formStatus}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          {#if formError}
            <p class="form-error" role="alert">{formError}</p>
          {/if}
        </form>
        <div class="modal-footer">
          <button
            class="action-btn action-btn--primary"
            type="button"
            on:click={submitEdit}
            disabled={formSubmitting}
          >
            {#if formSubmitting}<Spinner size="sm" />{/if}
            Save Changes
          </button>
          <button class="action-btn action-btn--outline" type="button" on:click={closeModal} disabled={formSubmitting}>Cancel</button>
        </div>

      <!-- ── Delete ────────────────────────────────────────── -->
      {:else if modal.mode === 'delete' && modal.user}
        <div class="modal-body">
          <div class="delete-confirm">
            <div class="delete-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="delete-message">
              Permanently delete <strong>{displayName(modal.user)}</strong>?
              This action cannot be undone.
            </p>
          </div>
          {#if formError}
            <p class="form-error" role="alert">{formError}</p>
          {/if}
        </div>
        <div class="modal-footer">
          <button
            class="action-btn action-btn--danger"
            type="button"
            on:click={submitDelete}
            disabled={formSubmitting}
          >
            {#if formSubmitting}<Spinner size="sm" />{/if}
            Delete User
          </button>
          <button class="action-btn action-btn--outline" type="button" on:click={closeModal} disabled={formSubmitting}>Cancel</button>
        </div>
      {/if}

    </div>
  </div>
{/if}

<style lang="postcss">
  .admin-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-block-size: 0;
    padding: 2rem 2.5rem;
    overflow-y: auto;
    gap: 1.25rem;
  }

  /* ── Header ──────────────────────────────────────────────────── */
  .admin-page-header { flex-shrink: 0; }

  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-block-end: 1.25rem;
    border-block-end: 1px solid var(--color-border);
  }

  .admin-page-title {
    margin: 0 0 0.25rem;
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .admin-page-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, var(--color-text));
    opacity: 0.65;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    transition: background-color 140ms ease, border-color 140ms ease;
  }

  .refresh-btn:hover:not(:disabled) { background: var(--color-surface-raised); border-color: var(--color-border-strong); }
  .refresh-btn:disabled { opacity: 0.5; cursor: wait; }

  .add-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md, 8px);
    background: var(--color-primary, #3b82f6);
    color: #fff;
    cursor: pointer;
    transition: opacity 140ms ease;
  }

  .add-btn:hover { opacity: 0.88; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinning { animation: spin 900ms linear infinite; }

  /* ── Filter bar ──────────────────────────────────────────────── */
  .filter-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    background: color-mix(in srgb, var(--color-surface) 70%, var(--color-border) 30%);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    flex-shrink: 0;
  }

  .search-field {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex: 1;
    min-inline-size: 180px;
    max-inline-size: 300px;
    padding: 0.3rem 0.5rem;
    background: #fff;
    border: 1px solid #ccc;
    height: 50px;
  }

  .search-field:focus-within .search-icon { opacity: 0.65; }

  .search-icon { opacity: 0.4; flex-shrink: 0; }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-text);
    outline: none;
    min-inline-size: 0;
  }

  .search-input::placeholder { color: var(--color-text); opacity: 0.4; }

  .search-clear {
    display: grid;
    place-items: center;
    inline-size: 1.2rem;
    block-size: 1.2rem;
    border: none;
    background: color-mix(in srgb, var(--color-text) 10%, transparent);
    border-radius: 50%;
    color: var(--color-text);
    cursor: pointer;
    opacity: 0.6;
    flex-shrink: 0;
    transition: opacity 120ms ease;
  }

  .search-clear:hover { opacity: 1; }

  .filter-divider {
    display: block;
    inline-size: 1px;
    block-size: 1.25rem;
    background: var(--color-border);
    opacity: 0.6;
    flex-shrink: 0;
  }

  .filter-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .filter-label-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text);
    opacity: 0.65;
    white-space: nowrap;
  }

  .filter-select {
    padding: 0.3rem 1.75rem 0.3rem 0.55rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    transition: border-color 140ms ease;
  }

  .filter-select:hover { border-color: var(--color-border-strong); }
  .filter-select:focus { outline: 2px solid var(--color-secondary); outline-offset: 1px; border-color: transparent; }

  .clear-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    opacity: 0.75;
    transition: opacity 140ms ease, border-color 140ms ease;
  }

  .clear-btn:hover { opacity: 1; border-color: var(--color-border-strong); }

  .filter-result-count {
    font-size: 0.75rem;
    color: var(--color-text);
    opacity: 0.5;
    margin-inline-start: auto;
  }

  /* ── States ──────────────────────────────────────────────────── */
  .state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex: 1;
    min-block-size: 14rem;
    color: var(--color-text);
    opacity: 0.5;
    font-size: 0.9375rem;
  }

  .state-box p { margin: 0; }

  .state-box--error {
    opacity: 1;
    color: var(--color-danger, #e53e3e);
    border: 1.5px dashed currentColor;
    border-radius: var(--radius-lg, 12px);
  }

  /* ── Table ───────────────────────────────────────────────────── */
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 12px);
    flex-shrink: 0;
  }

  .user-table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    min-inline-size: 520px;
  }

  .user-table thead {
    background: color-mix(in srgb, var(--color-surface) 60%, var(--color-border) 40%);
  }

  .user-table th {
    padding: 0.6rem 0.9rem;
    text-align: start;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text);
    opacity: 0.6;
    border-block-end: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .user-table tbody tr {
    border-block-end: 1px solid var(--color-border);
    transition: background-color 120ms ease;
  }

  .user-table tbody tr:last-child { border-block-end: none; }
  .user-table tbody tr:hover { background: color-mix(in srgb, var(--color-primary) 4%, transparent); }

  .user-table td {
    padding: 0.7rem 0.9rem;
    color: var(--color-text);
    vertical-align: middle;
  }

  .cell-user { display: flex; align-items: center; gap: 0.6rem; }

  .user-info { display: flex; flex-direction: column; gap: 0.1rem; }

  .user-name {
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-inline-size: 200px;
  }

  .user-email {
    font-size: 0.75rem;
    color: var(--color-text);
    opacity: 0.55;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-inline-size: 200px;
  }

  /* ── Role badge ──────────────────────────────────────────────── */
  .role-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .role-badge--admin { background: color-mix(in srgb, #7c3aed 12%, transparent); color: #5b21b6; }
  .role-badge--user  { background: color-mix(in srgb, var(--color-text) 8%, transparent); color: var(--color-text); opacity: 0.8; }

  /* ── Status dot ──────────────────────────────────────────────── */
  .status-dot {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8125rem;
    text-transform: capitalize;
  }

  .dot {
    display: inline-block;
    inline-size: 7px;
    block-size: 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .status-dot--active    .dot { background: #38a169; }
  .status-dot--suspended .dot { background: #dd6b20; }
  .status-dot--deleted   .dot { background: #e53e3e; }

  /* ── Row actions ─────────────────────────────────────────────── */
  .col-actions { inline-size: 1px; white-space: nowrap; }

  .row-actions { display: flex; align-items: center; gap: 0.25rem; }

  .icon-btn {
    display: grid;
    place-items: center;
    inline-size: 1.875rem;
    block-size: 1.875rem;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 120ms ease, border-color 120ms ease, background-color 120ms ease;
  }

  .icon-btn:hover { opacity: 1; border-color: var(--color-border-strong); background: var(--color-surface-raised); }
  .icon-btn--danger:hover { border-color: #e53e3e; color: #e53e3e; background: color-mix(in srgb, #e53e3e 6%, transparent); }

  /* ── Action buttons ──────────────────────────────────────────── */
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: 7px;
    cursor: pointer;
    border: 1.5px solid transparent;
    transition: opacity 140ms ease, background-color 140ms ease;
  }

  .action-btn:disabled { opacity: 0.5; cursor: wait; }

  .action-btn--primary {
    background: var(--color-primary, #3b82f6);
    color: #fff;
    border-color: transparent;
  }

  .action-btn--primary:hover:not(:disabled) { opacity: 0.88; }

  .action-btn--outline {
    background: transparent;
    color: var(--color-text);
    border-color: var(--color-border);
  }

  .action-btn--outline:hover:not(:disabled) { border-color: var(--color-border-strong); background: var(--color-surface-raised); }

  .action-btn--danger {
    background: #e53e3e;
    color: #fff;
    border-color: transparent;
  }

  .action-btn--danger:hover:not(:disabled) { opacity: 0.88; }

  /* ── Pagination ──────────────────────────────────────────────── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .pagination-info { font-size: 0.75rem; color: var(--color-text); opacity: 0.5; font-variant-numeric: tabular-nums; }

  .pagination-controls { display: flex; align-items: center; gap: 0.5rem; }

  .page-btn {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    transition: background-color 140ms ease, border-color 140ms ease;
    flex-shrink: 0;
  }

  .page-btn:hover:not(:disabled) { background: var(--color-surface-raised); border-color: var(--color-border-strong); }
  .page-btn:disabled { opacity: 0.35; cursor: default; }

  .page-indicator {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    min-inline-size: 7rem;
    text-align: center;
  }

  /* ── Modal ───────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 14px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    inline-size: 100%;
    max-inline-size: 460px;
    display: flex;
    flex-direction: column;
    max-block-size: 90vh;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.1rem 1.4rem;
    border-block-end: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .modal-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .modal-close {
    display: grid;
    place-items: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    opacity: 0.5;
    border-radius: 5px;
    transition: opacity 120ms ease;
  }

  .modal-close:hover { opacity: 1; }

  .modal-body {
    padding: 1.25rem 1.4rem;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-footer {
    padding: 1rem 1.4rem;
    border-block-start: 1px solid var(--color-border);
    display: flex;
    gap: 0.5rem;
    flex-direction: row-reverse;
    flex-shrink: 0;
  }

  /* ── View mode ───────────────────────────────────────────────── */
  .view-hero {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding-block-end: 0.75rem;
    border-block-end: 1px solid var(--color-border);
  }

  .view-hero--sm { padding-block-end: 0.65rem; }

  .view-name { margin: 0 0 0.15rem; font-weight: 700; font-size: 0.9375rem; color: var(--color-text); }
  .view-email { margin: 0; font-size: 0.8125rem; color: var(--color-text); opacity: 0.55; }

  .view-grid {
    display: grid;
    grid-template-columns: 6rem 1fr;
    gap: 0.55rem 1rem;
    margin: 0;
  }

  .view-grid dt { font-size: 0.75rem; font-weight: 600; color: var(--color-text); opacity: 0.5; align-self: center; }
  .view-grid dd { margin: 0; font-size: 0.8125rem; color: var(--color-text); align-self: center; }
  .mono { font-family: monospace; font-size: 0.75rem; word-break: break-all; opacity: 0.7; }

  /* ── Form elements ───────────────────────────────────────────── */
  .form-row { display: flex; flex-direction: column; gap: 0.35rem; }

  .form-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text);
    opacity: 0.8;
  }

  .required { color: #e53e3e; margin-inline-start: 0.1rem; }

  .form-input,
  .form-select {
    padding: 0.45rem 0.7rem;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1.5px solid var(--color-border);
    border-radius: 7px;
    transition: border-color 140ms ease;
    inline-size: 100%;
  }

  .form-select {
    appearance: none;
    padding-inline-end: 2rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.65rem center;
  }

  .form-input:focus,
  .form-select:focus { outline: 2px solid var(--color-secondary); outline-offset: 1px; border-color: transparent; }

  .form-error {
    margin: 0;
    font-size: 0.8125rem;
    color: #e53e3e;
    padding: 0.5rem 0.75rem;
    background: color-mix(in srgb, #e53e3e 8%, transparent);
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, #e53e3e 20%, transparent);
  }

  /* ── Delete confirm ──────────────────────────────────────────── */
  .delete-confirm {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
    padding-block: 0.5rem;
  }

  .delete-icon {
    display: grid;
    place-items: center;
    inline-size: 3.5rem;
    block-size: 3.5rem;
    border-radius: 50%;
    background: color-mix(in srgb, #e53e3e 10%, transparent);
    color: #e53e3e;
  }

  .delete-message { margin: 0; font-size: 0.9375rem; color: var(--color-text); line-height: 1.5; }
  .delete-message strong { font-weight: 700; }

  @media (max-width: 800px) {
    .admin-page { padding: 1.25rem 1rem; }
    .pagination { flex-direction: column; align-items: flex-start; }
    .modal { max-block-size: 95vh; }
  }
</style>
