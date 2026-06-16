<!--
  /home -- Contact Dashboard
  Three-column layout:
    [HomeSidebar] [ContactList] [ContactDetail | RecentCalls]

  Desktop  : all three columns visible simultaneously
  Tablet   : HomeSidebar + ContactList (RecentCalls hidden via CSS)
  Mobile   : HomeSidebar slide-over + full-width ContactList or ContactDetail

  Auth guard is in +layout.svelte -- no need to repeat it here.
-->
<script lang="ts">
  import HomeSidebar, {
    type HomeSection,
    type HomeSidebarItem
  } from '$lib/components/home/HomeSidebar.svelte';
  import ContactList from '$lib/components/home/ContactList.svelte';
  import ContactDetail from '$lib/components/home/ContactDetail.svelte';
  import RecentCalls from '$lib/components/home/RecentCalls.svelte';
  import { initiateCall, getCallIdentifier, hasLiveKitCredentials, getCallApiErrorMessage } from '$lib/api/calls.api';
  import type { UserProfile } from '$lib/stores/user.store';
  import { activeCallStore } from '$lib/stores/active-call.store';

  // Sidebar nav
  const sidebarItems: HomeSidebarItem[] = [
    {
      id: 'contact',
      label: 'Contacts',
      description: 'View and call your contacts'
    },
    // {
    //   id: 'calls',
    //   label: 'Calls',
    //   description: 'Recent and missed calls'
    // }
  ];

  let selectedSection: HomeSection = 'contact';
  let mobileNavOpen = false;

  // Contacts drawer (slides in from the left over the detail/history view)
  let contactsDrawerOpen = false;

  function toggleContactsDrawer() {
    contactsDrawerOpen = !contactsDrawerOpen;
  }

  function closeContactsDrawer() {
    contactsDrawerOpen = false;
  }

  // Contact selection — both props are bound directly from ContactList
  // so ContactDetail receives the full UserProfile without any store lookup.
  let selectedContactId: string | null = null;
  let selectedContact: UserProfile | null = null;

  // Close the contacts drawer once a contact is selected so the detail view is visible
  $: if (selectedContactId) contactsDrawerOpen = false;

  // Call initiation
  async function handleCall(contact: UserProfile, callType: 'audio' | 'video') {
    try {
      const response = await initiateCall({
        receiverIds: [contact.id],
        callType,
        callMode: 'one-to-one'
      });

      const callId = getCallIdentifier(response);
      if (!callId) {
        throw new Error('Call initiated but no call id was returned.');
      }

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
    } catch (err) {
      console.error('[ContactDashboard] Call initiation failed:', getCallApiErrorMessage(err));
    }
  }
</script>

<svelte:head>
  <title>Contact | AG Cloud</title>
  <meta name="description" content="View and call your AG Cloud contacts." />
</svelte:head>

<div class="app-layout">
  <!-- Left sidebar nav -->
  <HomeSidebar
    items={sidebarItems}
    bind:selected={selectedSection}
    bind:mobileOpen={mobileNavOpen}
  />

  <!-- Content shell: contact list + detail/history -->
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
        <img src="/logo.png" alt="AG Cloud" class="topbar-logo" />
        <span>AG Cloud</span>
      </div>

      <div style="inline-size: 2.25rem;" aria-hidden="true"></div>
    </header>

    <!-- Dashboard area: contacts drawer + detail/history -->
    <div class="dashboard" aria-label="Contact dashboard">

      <!-- Contacts toggle button -->
      <!-- <button
        class="contacts-toggle"
        type="button"
        aria-label={contactsDrawerOpen ? 'Close contacts' : 'Open contacts'}
        aria-expanded={contactsDrawerOpen}
        aria-controls="contacts-drawer"
        on:click={toggleContactsDrawer}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="9" cy="8" r="3.5" stroke="currentColor" stroke-width="1.75"/>
          <path d="M2 20a6.5 6.5 0 0114 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <path d="M16 9h6M19 6v6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
        <span>Contacts</span>
      </button> -->

      <!-- Drawer backdrop -->
      {#if contactsDrawerOpen}
        <div
          class="drawer-backdrop"
          aria-hidden="true"
          on:click={closeContactsDrawer}
          on:keydown={(e) => e.key === 'Escape' && closeContactsDrawer()}
        ></div>
      {/if}

      <!-- Contacts drawer (slides in from the left) -->
      <section
        id="contacts-drawer"
        class="contacts-drawer"
        class:is-open={contactsDrawerOpen}
        aria-label="Contacts"
        aria-hidden={!contactsDrawerOpen}
      >
        <ContactList
          bind:selectedId={selectedContactId}
          bind:selectedContact={selectedContact}
          onCallContact={handleCall}
        />
      </section>

      <!-- Mobile back button (shown when a contact is selected on mobile) -->
      {#if selectedContactId}
        <button
          class="mobile-back"
          type="button"
          aria-label="Back to contacts"
          on:click={() => (selectedContactId = null)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Back
        </button>
      {/if}

      <!-- Contact detail -->
      <section
        class="col-detail"
        class:col-hidden-mobile={selectedSection === 'calls'}
        aria-label="Contact details"
      >
        <ContactDetail
          contact={selectedContact}
          onCall={handleCall}
        />
      </section>

      <!-- Recent call history -->
      <section
        class="col-history"
        class:col-visible-mobile={selectedSection === 'calls'}
        aria-label="Recent calls"
      >
        <RecentCalls />
      </section>

    </div>
  </div>
</div>

<style lang="postcss">
  .app-layout {
    display: flex;
    block-size: 100dvh;
    overflow: hidden;
    background: var(--home-layout-bg);
  }

  .content-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
  }

  /* Mobile top bar */
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-primary);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .topbar-logo {
    block-size: 1.75rem;
    inline-size: auto;
    object-fit: contain;
  }

  /* Dashboard: 3-column flex row */
  .dashboard {
    flex: 1;
    min-block-size: 0;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  /* Column 1: Contact list */
  .col-contacts {
    inline-size: 22rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Column 2: Contact detail */
  .col-detail {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Column 3: Recent calls */
  .col-history {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Mobile back button: hidden on desktop */
  .mobile-back {
    display: none;
  }

  /* Tablet: slightly narrower contact list */
  @media (max-width: 1100px) {
    .col-contacts {
      inline-size: 18rem;
    }
  }

  /* Mobile */
  @media (max-width: 800px) {
    .topbar {
      display: flex;
    }

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

    .col-contacts.is-hidden {
      display: none;
    }

    .col-detail {
      flex: none;
      block-size: auto;
      min-block-size: 100%;
    }

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

    .mobile-back:hover {
      background: var(--color-surface-raised);
    }

    .mobile-back:focus-visible {
      outline: 2px solid var(--color-secondary);
      outline-offset: 2px;
    }
  }
</style>
