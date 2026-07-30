<script lang="ts">
  import ParticipantTile from '../../src/lib/components/calls/ParticipantTile.svelte';
  import type { Track } from 'livekit-client';

  export let name: string;
  export let label: string;
  export let isPinned = false;
  export let onTogglePin: () => void = () => {};
  export let track: Track | undefined = undefined;
</script>

<ParticipantTile {name} {label} {isPinned} {track} on:togglePin={onTogglePin} />
