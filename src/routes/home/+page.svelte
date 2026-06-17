<!--
  /home — Contact Dashboard
  Four-column desktop layout:
    [HomeSidebar] [ContactList] [ContactDetail] [RecentCalls]

  Desktop  : all four columns visible simultaneously
  Tablet   : sidebar + contacts + detail (history hidden)
  Mobile   : stacked; back button toggles between list and detail
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import HomeSidebar, {
    type HomeSection,
    type HomeSidebarItem
  } from '$lib/components/home/HomeSidebar.svelte';
  import ContactList from '$lib/components/home/ContactList.svelte';
  import ContactDetail from '$lib/components/home/ContactDetail.svelte';
  import RecentCalls from '$lib/components/home/RecentCalls.svelte';
  import {
    initiateCall,
    getCallIdentifier,
    hasLiveKitCredentials,
    getCallApiErrorMessage
  } from '$lib/api/calls.api';
  import type { UserProfile } from '$lib/stores/user.store';
  import { activeCallStore } from '$lib/stores/active-call.store';

  // Sidebar nav items
  const sidebarItems: HomeSidebarItem[] = [
    { id: 'contact', label: 'Contacts', description: 'View and call your contacts' }
  ];

  let selectedSection: HomeSection = 'contact';
  let mobileNavOpen = false;

  // Contact selection — bound from ContactList
  let selectedContactId: string | null = null;
  let selectedContact: UserProfile | null = null;

  // Call initiation
  async function handleCall(contact: UserProfile, callType: 'audio' | 'video') {
    try {
      const response = await initiateCall({
        receiverIds: [contact.id],
        callType,
        callMode: 'one-to-one'
      });

      const callId = getCallIdentifier(response);
      if (!callId) throw new Error('Call initiated but no call id was returned.');

      activeCallStore.startOutgoing({
        callId,
        peer: {
          id: contact.id,
          name: contact.displayName ?? contact.email,
          avatarUrl: contact.avatarUrl ?? null
        },
        callType,
        callMode: 'one-to-one',
        liveKit: hasLiveKitCredentials(response)
          ? { token: response.token, roomName: response.roomName, url: response.url }
          : null
      });

      // Navigate to the dedicated call page when credentials are available
      if (hasLiveKitCredentials(response)) {
        await goto(`/call/${encodeURIComponent(response.roomName)}`);
      }
    } catch (err) {
      console.error('[ContactDashboard] Call initiation failed:', getCallApiErrorMessage(err));
    }
  }
</script>

<svelte:head>
  <title>Contacts | AG Cloud</title>
  <meta name="description" content="View and call your AG Cloud contacts." />
</svelte:head>

<div class="app-layout">
  <!-- Left sidebar nav -->
  <HomeSidebar
    items={sidebarItems}
    bind:selected={selectedSection}
    bind:mobileOpen={mobileNavOpen}
  />

  <!-- Content shell -->
  <div class="content-shell">
    <!-- Mobile top bar -->
    <header class="topbar" aria-label="Mobile navigation">
      <button
        class="hamburger"
        type="button"
        aria-label="Open navigation"
        aria-expanded={mobileNavOpen}
        aria-controls="app-sidebar"
        on:click={() => (mobileNavOpen = true)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="topbar-brand">
        <span>AG Cloud</span>
      </div>
      <div style="inline-size: 2.25rem;" aria-hidden="true"></div>
    </header>

    <!-- Four-column dashboard -->
    <div class="dashboard" aria-label="Contact dashboard">

      <!-- Column 1: Contact list -->
      <section
        class="col-contacts"
        class:col-hidden-mobile={!!selectedContactId}
        aria-label="Contacts"
      >
        <ContactList
          bind:selectedId={selectedContactId}
          bind:selectedContact={selectedContact}
          onCallContact={handleCall}
        />
      </section>

      <!-- Mobile back button -->
      {#if selectedContactId}
        <button
          class="mobile-back"
          type="button"
          aria-label="Back to contacts"
          on:click={() => { selectedContactId = null; selectedContact = null; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Back
        </button>
      {/if}

      <!-- Column 2: Contact detail -->
      <section
        class="col-detail"
        class:col-visible-mobile={!!selectedContactId}
        aria-label="Contact details"
      >
        <ContactDetail
          contact={selectedContact}
          onCall={handleCall}
        />
      </section>

      <!-- Column 3: Recent call history -->
      <section class="col-history" aria-label="Recent calls">
        <RecentCalls />
      </section>

    </div>
  </div>
</div>

<style lang="postcss">
  /* ── Root layout ─────────────────────────────────────────── */
  .app-layout {
    display: flex;
    block-size: 100dvh;
    overflow: hidden;
  }

  .content-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
  }

  /* ── Mobile top bar ────────────────────────────────────── */
  .topbar {
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border-block-end: 1px solid var(--color-border);
    flex-shrink: 0;
    z-index: 10;
    box-shadow: var(--shadow-xs);
  }

  .hamburger {
    display: grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background-color 140ms ease, border-color 140ms ease;
  }

  .hamburger:hover {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
  }

  .hamburger:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 1px;
  }

  .topbar-brand {
    color: var(--color-primary);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  /* ── Dashboard: 3-column flex row ─────────────────────── */
  .dashboard {
    flex: 1;
    min-block-size: 0;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  /* Column 1: Contact list — fixed width */
  .col-contacts {
    inline-size: 22rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Column 2: Contact detail — flexible */
  .col-detail {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Column 3: Recent calls — fixed width */
  .col-history {
    inline-size: 22rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-inline-start: 1px solid var(--color-border);
  }

  /* Mobile back button — hidden on desktop */
  .mobile-back { display: none; }

  /* ── Tablet ─────────────────────────────────────────────── */
  @media (max-width: 1200px) {
    .col-contacts { inline-size: 18rem; }
    .col-history  { display: none; }
  }

  /* ── Mobile ─────────────────────────────────────────────── */
  @media (max-width: 800px) {
    .topbar { display: flex; }

    .dashboard {
      flex-direction: column;
      overflow-y: auto;
    }

    .col-contacts {
      inline-size: 100%;
      flex-shrink: 0;
      block-size: auto;
      min-block-size: 100%;
    }

    .col-contacts.col-hidden-mobile { display: none; }

    .col-detail {
      flex: none;
      block-size: auto;
      min-block-size: 100%;
      display: none;
    }

    .col-detail.col-visible-mobile { display: flex; }

    .mobile-back {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.625rem 1.25rem;
      border: none;
      border-block-end: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-secondary);
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      z-index: 5;
      transition: background-color 120ms ease;
    }

    .mobile-back:hover { background: var(--color-surface-raised); }

    .mobile-back:focus-visible {
      outline: 2px solid var(--color-secondary);
      outline-offset: 2px;
    }
  }
</style>
