<!--
  /contacts — Contacts List Page
  Searchable list of all users/contacts with presence indicators.
  Each row links to /contacts/[id] for the detail view.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Avatar from "$lib/components/atoms/Avatar.svelte";
  import Skeleton from "$lib/components/atoms/Skeleton.svelte";
  import { presenceStore, type PresenceStatus } from "$lib/stores/presence.store";
  import { getContacts } from "$lib/api/contacts.api";
  import type { UserProfile } from "$lib/stores/user.store";

  // ── State ──────────────────────────────────────────────────────
  let contacts: UserProfile[] = [];
  let isLoading = true;
  let error: string | null = null;
  let searchQuery = "";
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // ── Data loading ───────────────────────────────────────────────
  async function load(search?: string) {
    isLoading = true;
    error = null;
    try {
      contacts = await getContacts(search);
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not load contacts.";
    } finally {
      isLoading = false;
    }
  }

  // Debounced search
  function onSearchInput() {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      void load(searchQuery);
    }, 300);
  }

  onMount(() => {
    void load();
    presenceStore.startPolling();
    return () => {
      presenceStore.stopPolling();
      if (searchDebounce) clearTimeout(searchDebounce);
    };
  });

  // ── Presence helpers ───────────────────────────────────────────
  function getPresenceStatus(userId: string): PresenceStatus {
    return $presenceStore.presences.get(userId)?.status ?? "offline";
  }

  function presenceLabel(status: PresenceStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }


</script>

<main class="contacts-page">
  <header class="contacts-header">
    <h1>Contacts</h1>
    <div class="contacts-search">
      <input
        type="text"
        placeholder="Search contacts..."
        bind:value={searchQuery}
        on:input={onSearchInput}
        aria-label="Search contacts"
        class="search-input"
      />
    </div>
  </header>

  {#if error}
    <div class="contacts-error" role="alert">{error}</div>
  {/if}

  {#if isLoading}
    <Skeleton variant="contacts" rows={6} />
  {:else if contacts.length === 0}
    <p class="contacts-empty">
      {searchQuery ? "No contacts match your search." : "No contacts found."}
    </p>
  {:else}
    <ul class="contacts-list" aria-label="Contacts">
      {#each contacts as contact (contact.id)}
        {@const status = getPresenceStatus(contact.id)}
        <li class="contact-row">
          <a class="contact-row__link" href="/contacts/{contact.id}" aria-label="{contact.displayName ?? contact.email}">
            <Avatar
              src={contact.avatarUrl ?? undefined}
              name={contact.displayName ?? contact.email}
              size="md"
              online={status === "online"}
            />
            <div class="contact-row__info">
              <span class="contact-row__name">{contact.displayName ?? contact.email}</span>
              {#if contact.displayName}
                <span class="contact-row__email">{contact.email}</span>
              {/if}
            </div>
            <span class="contact-row__presence contact-row__presence--{status}" aria-label={presenceLabel(status)}>
              {presenceLabel(status)}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .contacts-page {
    max-width: 680px;
    margin: 0 auto;
    padding: var(--pico-spacing, 1.5rem);
  }

  .contacts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .contacts-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .contacts-search {
    flex: 1;
    min-width: 200px;
    max-width: 320px;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--pico-form-element-border-color, #d1d5db);
    border-radius: var(--pico-border-radius, 0.375rem);
    background: var(--pico-form-element-background-color, #fff);
    color: inherit;
    font-size: 0.9375rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--pico-primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .contacts-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .contact-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
    border-radius: var(--pico-border-radius, 0.375rem);
    cursor: pointer;
    transition: background-color 0.15s ease;
    outline: none;
  }

  .contact-row:hover,
  .contact-row:focus-visible {
    background-color: var(--pico-secondary-background, rgba(0, 0, 0, 0.05));
  }

  :global([data-theme="dark"]) .contact-row:hover,
  :global([data-theme="dark"]) .contact-row:focus-visible {
    background-color: rgba(255, 255, 255, 0.06);
  }

  .contact-row__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .contact-row__name {
    font-weight: 500;
    font-size: 0.9375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-row__email {
    font-size: 0.8125rem;
    color: var(--pico-muted-color, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-row__presence {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    white-space: nowrap;
  }

  .contact-row__presence--online {
    background-color: #dcfce7;
    color: #16a34a;
  }

  .contact-row__presence--away {
    background-color: #fef9c3;
    color: #ca8a04;
  }

  .contact-row__presence--offline {
    background-color: var(--pico-secondary-background, #f3f4f6);
    color: var(--pico-muted-color, #6b7280);
  }

  :global([data-theme="dark"]) .contact-row__presence--online {
    background-color: rgba(22, 163, 74, 0.2);
    color: #4ade80;
  }

  :global([data-theme="dark"]) .contact-row__presence--away {
    background-color: rgba(202, 138, 4, 0.2);
    color: #fbbf24;
  }

  :global([data-theme="dark"]) .contact-row__presence--offline {
    background-color: rgba(255, 255, 255, 0.08);
    color: #9ca3af;
  }

  .contacts-empty {
    text-align: center;
    color: var(--pico-muted-color, #888);
    padding: 3rem 1rem;
  }

  .contacts-error {
    padding: 0.75rem 1rem;
    background-color: var(--pico-del-color, #fee2e2);
    color: #b91c1c;
    border-radius: var(--pico-border-radius, 0.375rem);
    margin-bottom: 1rem;
  }
</style>
