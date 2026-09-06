<!--
  /home -- Contact Dashboard
  Sidebar and mobile topbar are provided by home/+layout.svelte.
  This page fills the <slot /> with three content columns:
    [ContactList] [ContactDetail] [RecentCalls]
-->
<script lang="ts">
  import { goto } from '$app/navigation';
  import ContactList from '$lib/components/home/ContactList.svelte';
  import ContactDetail from '$lib/components/home/ContactDetail.svelte';
  import RecentCalls from '$lib/components/home/RecentCalls.svelte';
  import {
    initiateCall,
    getCallIdentifier,
    hasLiveKitCredentials,
    getCallApiErrorMessage
  } from '$lib/api/calls.api';
  import { ApiError } from '$lib/api/client';
  import type { UserProfile } from '$lib/stores/user.store';
  import { activeCallStore } from '$lib/stores/active-call.store';
  import { contactsDrawerOpen } from '$lib/stores/contacts-drawer.store';
  import { toastStore } from '$lib/stores/toast.store';

  let selectedContactId: string | null = null;
  let selectedContact: UserProfile | null = null;

  /** Mobile-only tab: 'contacts' | 'calls' */
  let activeTab: 'contacts' | 'calls' = 'contacts';

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

      if (hasLiveKitCredentials(response)) {
        await goto(`/call/${encodeURIComponent(response.roomName)}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        const body = err.body as { code?: string; message?: string } | undefined;
        if (body?.code === 'FREE_CALL_EXHAUSTED') {
          toastStore.error(
            body.message ?? 'Your free call limit is over. Please subscribe to continue.',
            6000
          );
          return;
        }
      }
      console.error('[ContactDashboard] Call initiation failed:', getCallApiErrorMessage(err));
    }
  }
</script>

<svelte:head>
  <title>Contacts | AG Cloud</title>
  <meta name="description" content="View and call your AG Cloud contacts." />
</svelte:head>

<div class="dashboard" aria-label="Contact dashboard">

  <!-- Column 1: Contact list (drawer) -->
  <section
    class="col-contacts"
    class:col-hidden-mobile={!!selectedContactId || activeTab === 'calls'}
    class:drawer-closed={!$contactsDrawerOpen}
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
      on:click={() => { selectedContactId = null; selectedContact = null; activeTab = 'contacts'; }}
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
    <ContactDetail contact={selectedContact} onCall={handleCall} />
  </section>

  <!-- Column 3: Recent call history -->
  <section
    class="col-history"
    class:col-visible-mobile={activeTab === 'calls' && !selectedContactId}
    aria-label="Recent calls"
  >
    <RecentCalls />
  </section>

  <!-- Mobile bottom tab bar (hidden on desktop) -->
  {#if !selectedContactId}
    <nav class="mobile-tabs" aria-label="Main navigation">
      <button
        class="tab-btn"
        class:tab-active={activeTab === 'contacts'}
        type="button"
        aria-label="Contacts"
        on:click={() => { activeTab = 'contacts'; }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>Contacts</span>
      </button>

      <button
        class="tab-btn"
        class:tab-active={activeTab === 'calls'}
        type="button"
        aria-label="Recent Calls"
        on:click={() => { activeTab = 'calls'; }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.35 6.35l.98-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Recent Calls</span>
      </button>
    </nav>
  {/if}

</div>

<style lang="postcss">
  /* Dashboard fills the flex content-shell provided by the layout */
  .dashboard {
    flex: 1;
    min-block-size: 0;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .col-contacts {
    inline-size: 22rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Drawer slide animation */
    transition: inline-size 300ms ease, opacity 220ms ease, min-inline-size 300ms ease;
  }

  /* Drawer closed: collapses width to 0 with fade */
  .col-contacts.drawer-closed {
    inline-size: 0;
    min-inline-size: 0;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .col-detail {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .col-history {
    inline-size: 22rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-inline-start: 1px solid var(--color-border);
  }

  .mobile-back  { display: none; }
  .mobile-tabs  { display: none; }

  @media (max-width: 1200px) {
    .col-contacts { inline-size: 18rem; }
    .col-contacts.drawer-closed { inline-size: 0; min-inline-size: 0; }
    .col-history  { display: none; }
  }

  @media (max-width: 800px) {
    .dashboard {
      flex-direction: column;
      overflow-y: auto;
      padding-block-end: 3.5rem;
    }

    .col-contacts {
      inline-size: 100%;
      flex-shrink: 0;
      block-size: auto;
      min-block-size: calc(100% - 3.5rem);
    }

    .col-contacts.col-hidden-mobile { display: none; }

    .col-detail {
      flex: none;
      block-size: auto;
      min-block-size: calc(100% - 3.5rem);
      display: none;
    }

    .col-detail.col-visible-mobile { display: flex; }

    /* Recent calls on mobile */
    .col-history {
      display: none;
      inline-size: 100%;
      flex-shrink: 0;
      block-size: auto;
      min-block-size: calc(100% - 3.5rem);
      border-inline-start: none;
    }

    .col-history.col-visible-mobile { display: flex; }

    /* Back button */
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

    /* Bottom tab bar */
    .mobile-tabs {
      display: flex;
      position: fixed;
      inset-block-end: 0;
      inset-inline-start: 0;
      inset-inline-end: 0;
      block-size: 3.5rem;
      background: var(--color-surface);
      border-block-start: 1px solid var(--color-border);
      z-index: 50;
    }

    .tab-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      border: none;
      background: transparent;
      color: var(--color-text-secondary, #888);
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 500;
      cursor: pointer;
      transition: color 120ms ease;
    }

    .tab-btn.tab-active {
      color: var(--color-secondary);
    }

    .tab-btn:focus-visible {
      outline: 2px solid var(--color-secondary);
      outline-offset: -2px;
    }
  }
</style>
