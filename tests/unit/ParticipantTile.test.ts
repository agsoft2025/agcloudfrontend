import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Track } from 'livekit-client';
import ParticipantTile from '../../src/lib/components/calls/ParticipantTile.svelte';
import ParticipantTileHarness from './ParticipantTileHarness.svelte';

afterEach(() => cleanup());

// ── Avatar fallback (no track) ───────────────────────────────────────────────

describe('ParticipantTile — avatar fallback (no track)', () => {
  it('renders initials from a two-word name', () => {
    const { getByText } = render(ParticipantTile, { name: 'Alice Wonderland', label: 'Alice' });
    expect(getByText('AW')).toBeTruthy();
  });

  it('renders a single initial for a one-word name', () => {
    const { getByText } = render(ParticipantTile, { name: 'Cher', label: 'Cher' });
    expect(getByText('C')).toBeTruthy();
  });

  it('is deterministic: the same name always gets the same avatar hue', () => {
    const { container: c1 } = render(ParticipantTile, { name: 'Bob Builder', label: 'Bob' });
    const style1 = c1.querySelector('.avatar-circle')?.getAttribute('style');
    cleanup();
    const { container: c2 } = render(ParticipantTile, { name: 'Bob Builder', label: 'Bob' });
    const style2 = c2.querySelector('.avatar-circle')?.getAttribute('style');
    expect(style1).toBe(style2);
  });

  it('applies the cam-off class when there is no video to show', () => {
    const { container } = render(ParticipantTile, { name: 'Alice', label: 'Alice' });
    expect(container.querySelector('.tile.cam-off')).toBeTruthy();
  });
});

// ── Name / aria-label ─────────────────────────────────────────────────────────

describe('ParticipantTile — name & aria-label', () => {
  it('shows the plain name by default', () => {
    const { getByText } = render(ParticipantTile, { name: 'Alice', label: 'Alice' });
    expect(getByText('Alice')).toBeTruthy();
  });

  it('appends "(you)" for the local participant', () => {
    const { getByText } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isLocal: true });
    expect(getByText('Alice (you)')).toBeTruthy();
  });

  it('aria-label includes " — speaking" when active', () => {
    const { getByRole } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isActive: true });
    expect(getByRole('article', { name: 'Alice — speaking' })).toBeTruthy();
  });

  it('aria-label includes " — pinned" when pinned', () => {
    const { getByRole } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isPinned: true });
    expect(getByRole('article', { name: 'Alice — pinned' })).toBeTruthy();
  });

  it('aria-label includes both suffixes when active and pinned', () => {
    const { getByRole } = render(ParticipantTile, {
      name: 'Alice',
      label: 'Alice',
      isActive: true,
      isPinned: true,
    });
    expect(getByRole('article', { name: 'Alice — speaking — pinned' })).toBeTruthy();
  });

  it('shows a speaking ring overlay when active', () => {
    const { container } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isActive: true });
    expect(container.querySelector('.speaking-ring')).toBeTruthy();
  });

  it('does not show a speaking ring when inactive', () => {
    const { container } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isActive: false });
    expect(container.querySelector('.speaking-ring')).toBeNull();
  });
});

// ── Pin button ────────────────────────────────────────────────────────────────

describe('ParticipantTile — pin button', () => {
  it('shows "Pin {name}" when not pinned', () => {
    const { getByRole } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isPinned: false });
    const btn = getByRole('button', { name: 'Pin Alice' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows "Unpin {name}" when pinned', () => {
    const { getByRole } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isPinned: true });
    const btn = getByRole('button', { name: 'Unpin Alice' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('dispatches togglePin on click', async () => {
    const onTogglePin = vi.fn();
    const { getByRole } = render(ParticipantTileHarness, { name: 'Alice', label: 'Alice', onTogglePin });
    await fireEvent.click(getByRole('button', { name: 'Pin Alice' }));
    expect(onTogglePin).toHaveBeenCalledOnce();
  });

  it('does not bubble the click to the tile (stopPropagation)', async () => {
    const { getByRole, container } = render(ParticipantTile, { name: 'Alice', label: 'Alice' });
    const tileClick = vi.fn();
    container.querySelector('.tile')!.addEventListener('click', tileClick);
    await fireEvent.click(getByRole('button', { name: 'Pin Alice' }));
    expect(tileClick).not.toHaveBeenCalled();
  });
});

// ── Status badges & icons ────────────────────────────────────────────────────

describe('ParticipantTile — status badges', () => {
  it('shows a hand-raised badge', () => {
    const { getByTitle } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isHandRaised: true });
    expect(getByTitle('Hand raised')).toBeTruthy();
  });

  it('does not show a hand-raised badge by default', () => {
    const { queryByTitle } = render(ParticipantTile, { name: 'Alice', label: 'Alice' });
    expect(queryByTitle('Hand raised')).toBeNull();
  });

  it('shows a poor-network badge in the top-left when networkQuality is "poor"', () => {
    const { getByTitle } = render(ParticipantTile, { name: 'Alice', label: 'Alice', networkQuality: 'poor' });
    expect(getByTitle('Poor connection')).toBeTruthy();
  });

  it('shows a network status icon in the footer for non-poor quality', () => {
    const { getByLabelText } = render(ParticipantTile, {
      name: 'Alice',
      label: 'Alice',
      networkQuality: 'excellent',
    });
    expect(getByLabelText('Excellent connection')).toBeTruthy();
  });

  it('shows a camera-off status icon', () => {
    const { getByLabelText } = render(ParticipantTile, {
      name: 'Alice',
      label: 'Alice',
      isCameraOff: true,
    });
    expect(getByLabelText('Alice camera off')).toBeTruthy();
  });

  it('shows a muted status icon', () => {
    const { getByLabelText } = render(ParticipantTile, { name: 'Alice', label: 'Alice', isMuted: true });
    expect(getByLabelText('Alice microphone muted')).toBeTruthy();
  });

  it('shows no status icons when nothing applies', () => {
    const { queryByLabelText } = render(ParticipantTile, { name: 'Alice', label: 'Alice' });
    expect(queryByLabelText('Alice camera off')).toBeNull();
    expect(queryByLabelText('Alice microphone muted')).toBeNull();
  });
});

// ── With a video track ───────────────────────────────────────────────────────

describe('ParticipantTile — with a video track', () => {
  function fakeVideoTrack() {
    // Deliberately omit `mediaStreamTrack` — LiveKitTrack only reads it when
    // the key is present ('mediaStreamTrack' in nextTrack), and jsdom has no
    // global MediaStreamTrack constructor to check `instanceof` against.
    return {
      kind: Track.Kind.Video,
      attach: vi.fn(),
      detach: vi.fn(),
    } as unknown as Track;
  }

  it('renders a video element instead of the avatar fallback', () => {
    const { container } = render(ParticipantTile, {
      name: 'Alice',
      label: 'Alice',
      track: fakeVideoTrack(),
    });
    expect(container.querySelector('video')).toBeTruthy();
    expect(container.querySelector('.avatar-circle')).toBeNull();
  });

  it('does not apply the cam-off class once video is showing', () => {
    const { container } = render(ParticipantTile, {
      name: 'Alice',
      label: 'Alice',
      track: fakeVideoTrack(),
    });
    expect(container.querySelector('.tile.cam-off')).toBeNull();
  });

  it('falls back to the avatar when isCameraOff is true even with a track', () => {
    const { container } = render(ParticipantTile, {
      name: 'Alice',
      label: 'Alice',
      track: fakeVideoTrack(),
      isCameraOff: true,
    });
    expect(container.querySelector('.avatar-circle')).toBeTruthy();
    expect(container.querySelector('video')).toBeNull();
  });
});
