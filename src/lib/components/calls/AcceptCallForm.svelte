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
      loading={isSubmitting && action === 'accept'}
      disabled={isSubmitting}
    >
      Accept
    </Button>

    <Button
      type="button"
      variant="ghost"
      loading={isSubmitting && action === 'reject'}
      disabled={isSubmitting}
      on:click={() => handleCallAction('reject')}
    >
      Decline
    </Button>

    <Button
      type="button"
      variant="danger"
      loading={isSubmitting && action === 'end'}
      disabled={isSubmitting}
      on:click={() => handleCallAction('end')}
    >
      End call
    </Button>
  </div>

  <CallStatus message={statusMessage} variant={statusVariant} />
</form>

<style lang="postcss">
  .accept-form {
    display: grid;
    gap: var(--space-md);
  }

  .form-body {
    display: grid;
    gap: var(--space-sm);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--space-sm);
  }

  @media (max-width: 560px) {
    .actions {
      grid-template-columns: 1fr;
    }
  }
</style>
