<!--
  /settings/notifications — Push Notification Settings
  =====================================================
  Lets the user opt-in to / opt-out of browser push notifications
  backed by Firebase Cloud Messaging.

  Flow:
    Enable  → requestPermission() → getMessagingToken() → POST /notifications/register
    Disable → POST /notifications/unregister → deleteMessagingToken() → clear state
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { notificationStore } from '$lib/stores/notification.store';
  import { toastStore } from '$lib/stores/toast.store';
  import {
    isMessagingSupported,
    getMessagingToken,
    deleteMessagingToken,
  } from '$lib/firebase/messaging';
  import {
    registerNotificationToken,
    unregisterNotificationToken,
  } from '$lib/api/notifications.api';
  import Button from '$lib/components/atoms/Button.svelte';

  // ── Derived state ─────────────────────────────────────────────────────────────

  $: state = $notificationStore;
  $: fcmSupported = browser && isMessagingSupported();
  $: canEnable = !state.enabled && state.permission !== 'denied' && fcmSupported;
  $: canDisable = state.enabled;

  // ── Enable flow ───────────────────────────────────────────────────────────────

  async function handleEnable() {
    if (!browser || state.loading) return;

    notificationStore.setLoading(true);

    try {
      // 1. Request (or confirm) browser permission
      const permission = await Notification.requestPermission();
      notificationStore.setPermission(permission as 'granted' | 'denied' | 'default');

      if (permission !== 'granted') {
        notificationStore.setError(
          permission === 'denied'
            ? 'Permission denied. Allow notifications in your browser settings and try again.'
            : 'Notification permission was not granted.'
        );
        return;
      }

      // 2. Obtain FCM token
      const token = await getMessagingToken();
      if (!token) {
        notificationStore.setError('Could not retrieve a push token. Please try again.');
        return;
      }

      // 3. Register with backend — 401 is handled by the API client retry
      await registerNotificationToken(token);

      // 4. Persist success
      notificationStore.setEnabled(token);
      toastStore.success('Notifications enabled.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable notifications.';
      notificationStore.setError(message);
      toastStore.error(message);
    }
  }

  // ── Disable flow ──────────────────────────────────────────────────────────────

  async function handleDisable() {
    if (!browser || state.loading) return;

    notificationStore.setLoading(true);

    // Prefer the token we already have; fall back to fetching a fresh one
    const token = state.token ?? (await getMessagingToken());

    try {
      if (token) {
        // 1. Tell the backend to stop sending to this device
        await unregisterNotificationToken(token);
        // 2. Delete the FCM token from Firebase so it cannot be used again
        await deleteMessagingToken();
      }

      // 3. Clear local state
      notificationStore.setDisabled();
      toastStore.success('Notifications disabled.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable notifications.';
      notificationStore.setError(message);
      toastStore.error(message);
    }
  }

  // ── Sync browser permission on mount ─────────────────────────────────────────

  onMount(() => {
    notificationStore.syncPermission();

    // If stored as enabled but permission was revoked in browser settings,
    // surface that mismatch immediately
    if (state.enabled && Notification.permission === 'denied') {
      notificationStore.setPermission('denied');
      notificationStore.setDisabled();
    }
  });
</script>

<svelte:head>
  <title>Notifications | AG Cloud</title>
</svelte:head>

<div class="notifications-page">
  <header class="page-header">
    <h1 class="page-title">Notifications</h1>
    <p class="page-subtitle">Manage push notifications for calls and messages.</p>
  </header>

  <!-- ── FCM not configured ── -->
  {#if !fcmSupported}
    <div class="info-banner info-banner--warn" role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Push notifications are not configured for this environment. Contact your administrator.
    </div>
  {/if}

  <!-- ── Main settings card ── -->
  <div class="settings-card" class:settings-card--disabled={!fcmSupported}>

    <!-- Row: toggle label + status -->
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="setting-icon">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"
              stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Push Notifications
        </span>
        <p class="setting-description">
          Receive alerts for incoming calls and messages even when the app is in the background.
        </p>
      </div>

      <!-- Status chip -->
      <div class="status-chip-wrap">
        {#if state.permission === 'denied'}
          <span class="status-chip status-chip--denied">
            <span class="status-dot" aria-hidden="true"></span>
            Permission denied
          </span>
        {:else if state.enabled}
          <span class="status-chip status-chip--enabled">
            <span class="status-dot" aria-hidden="true"></span>
            Enabled
          </span>
        {:else}
          <span class="status-chip status-chip--disabled">
            <span class="status-dot" aria-hidden="true"></span>
            Disabled
          </span>
        {/if}
      </div>
    </div>

    <!-- Error message -->
    {#if state.error}
      <div class="error-banner" role="alert">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        {state.error}
      </div>
    {/if}

    <!-- Permission denied help text -->
    {#if state.permission === 'denied'}
      <div class="help-text">
        Notifications are blocked at the browser level. To re-enable:
        click the lock icon in your browser's address bar → Notifications → Allow.
      </div>
    {/if}

    <!-- Action buttons -->
    <div class="setting-actions">
      {#if canEnable}
        <Button
          variant="secondary"
          size="md"
          loading={state.loading}
          disabled={!fcmSupported}
          on:click={handleEnable}
        >
          {#if state.loading}
            Enabling notifications…
          {:else}
            Enable Notifications
          {/if}
        </Button>
      {/if}

      {#if canDisable}
        <Button
          variant="ghost"
          size="md"
          loading={state.loading}
          on:click={handleDisable}
        >
          {#if state.loading}
            Disabling notifications…
          {:else}
            Disable Notifications
          {/if}
        </Button>
      {/if}
    </div>
  </div>

  <!-- ── Browser support note ── -->
  {#if browser && !('Notification' in window)}
    <p class="support-note">
      Your browser does not support the Notifications API.
      Try a modern browser such as Chrome, Firefox, or Edge.
    </p>
  {/if}
</div>

<style lang="postcss">
  .notifications-page {
    max-inline-size: 560px;
    margin-inline: auto;
    padding: var(--space-xl) var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  /* ── Page header ── */

  .page-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .page-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
  }

  /* ── Info / warning banner ── */

  .info-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
  }

  .info-banner--warn {
    background: color-mix(in srgb, var(--color-warning, #d97706) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning, #d97706) 30%, transparent);
    color: var(--color-warning-text, #92400e);
  }

  /* ── Settings card ── */

  .settings-card {
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .settings-card--disabled {
    opacity: 0.65;
    pointer-events: none;
  }

  /* ── Setting row ── */

  .setting-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    flex: 1;
    min-inline-size: 0;
  }

  .setting-title {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .setting-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .setting-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  /* ── Status chip ── */

  .status-chip-wrap {
    flex-shrink: 0;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25em 0.65em;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  .status-chip--enabled {
    background: color-mix(in srgb, var(--color-success, #38a169) 12%, transparent);
    color: var(--color-success-text, #276749);
    border: 1px solid color-mix(in srgb, var(--color-success, #38a169) 25%, transparent);
  }

  .status-chip--disabled {
    background: color-mix(in srgb, var(--color-text-muted) 10%, transparent);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
  }

  .status-chip--denied {
    background: color-mix(in srgb, var(--color-error, #e53e3e) 10%, transparent);
    color: var(--color-error-text, #c53030);
    border: 1px solid color-mix(in srgb, var(--color-error, #e53e3e) 25%, transparent);
  }

  .status-dot {
    display: inline-block;
    inline-size: 6px;
    block-size: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* ── Error banner ── */

  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: var(--space-md);
    background: color-mix(in srgb, var(--color-error, #e53e3e) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-error, #e53e3e) 25%, transparent);
    border-radius: var(--radius-md);
    color: var(--color-error-text, #c53030);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  /* ── Help text ── */

  .help-text {
    padding: var(--space-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    line-height: 1.6;
  }

  /* ── Action buttons ── */

  .setting-actions {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  /* ── Support note ── */

  .support-note {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
