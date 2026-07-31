<script lang="ts">
  import CallSession, {
    type ActiveCallSession,
  } from '../../src/lib/components/calls/CallSession.svelte';

  export let session: ActiveCallSession;
  export let isEndingCall = false;
  export let onEndCall: () => void = () => {};
</script>

<CallSession {session} {isEndingCall} on:endCall={onEndCall} />
