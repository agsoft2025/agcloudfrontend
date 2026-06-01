<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/atoms/Button.svelte';
  import Input from '$lib/components/atoms/Input.svelte';
  import {
    acceptCall,
    endCall,
    getCallApiErrorMessage,
    getCallIdentifier,
    rejectCall,
    type AcceptCallResponse
  } from '$lib/api/calls.api';
  import CallStatus, { type CallStatusVariant } from './CallStatus.svelte';

  const dispatch = createEventDispatcher<{
    accepted: AcceptCallResponse & { requestedCallId: string };
  }>();

  let callId = '';
  let error = '';
  let statusMessage = '';
  let statusVariant: CallStatusVariant = 'info';
  let isSubmitting = false;
  let action: 'accept' | 'reject' | 'end' | null = null;

  function setStatus(message: string, variant: CallStatusVariant) {
    statusMessage = message;
    statusVariant = variant;
  }

  async function handleCallAction(nextAction: 'accept' | 'reject' | 'end') {
    const normalizedCallId = callId.trim();
    error = '';
    statusMessage = '';

    if (!normalizedCallId) {
      error = 'Call ID is required.';
      return;
    }

    isSubmitting = true;
    action = nextAction;

    try {
      const response =
        nextAction === 'accept'
          ? await acceptCall(normalizedCallId)
          : nextAction === 'reject'
            ? await rejectCall(normalizedCallId)
            : await endCall(normalizedCallId);
      const updatedCallId = getCallIdentifier(response) ?? normalizedCallId;
      setStatus(
        response.message ??
          `Call ${updatedCallId} ${
            nextAction === 'accept' ? 'accepted' : nextAction === 'reject' ? 'rejected' : 'ended'
          }.`,
        'success'
      );

      if (nextAction === 'accept') {
        dispatch('accepted', { ...response, requestedCallId: normalizedCallId });
      }

      callId = '';
    } catch (apiError) {
      setStatus(
        getCallApiErrorMessage(
          apiError,
          `Unable to ${
            nextAction === 'accept' ? 'accept' : nextAction === 'reject' ? 'reject' : 'end'
          } this call.`
        ),
        'error'
      );
    } finally {
      isSubmitting = false;
      action = null;
    }
  }
</script>

<form class="accept-form" on:submit|preventDefault={() => handleCallAction('accept')} novalidate>
  <div class="form-body">
    <Input
      id="accept-call-id"
      name="callId"
      label="Incoming call ID"
      bind:value={callId}
      {error}
      placeholder="Paste call ID here"
      disabled={isSubmitting}
      required
      on:input={() => {
        error = '';
        statusMessage = '';
      }}
    />
  </div>

  <div class="actions">
    <Button
      type="submit"
      variant="secondary"
      fullWidth
      loading={isSubmitting && action === 'accept'}
      disabled={isSubmitting}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Accept
    </Button>

    <Button
      type="button"
      variant="ghost"
      fullWidth
      loading={isSubmitting && action === 'reject'}
      disabled={isSubmitting}
      on:click={() => handleCallAction('reject')}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
      Decline
    </Button>

    <Button
      type="button"
      variant="danger"
      fullWidth
      loading={isSubmitting && action === 'end'}
      disabled={isSubmitting}
      on:click={() => handleCallAction('end')}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1A19.4 19.4 0 013.1 10.8 19.8 19.8 0 012.1 2.2 2 2 0 014.1 0h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8.1 7.9a16 16 0 006 6l1.2-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0122 14.9z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      End call
    </Button>
  </div>

  <CallStatus message={statusMessage} variant={statusVariant} />
</form>

<style lang="postcss">
  .accept-form {
    display: grid;
    gap: 0.65rem;
  }

  .form-body {
    display: grid;
    gap: var(--space-sm);
  }

  .actions {
    display: grid;
    gap: 0.5rem;
  }
</style>
