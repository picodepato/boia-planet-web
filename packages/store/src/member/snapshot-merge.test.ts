import { expect, it } from 'vitest';
import { emptySnapshot, mergeSnapshots, remoteSnapshot } from './snapshot-merge';

it('remote-only edits survive; a local preference deletion uses the common base', () => {
  const base = emptySnapshot();
  base.player.prefs = { muted: true, theme: 'day' };
  base.player.counters.played = 10;
  const local = structuredClone(base);
  delete local.player.prefs.muted;
  local.player.counters.played = 15;
  const remote = structuredClone(base);
  remote.player.prefs.theme = 'night';
  remote.player.prefs.zoom = 2;
  remote.player.counters.played = 15;
  const result = mergeSnapshots(base, local, remote);
  expect(result.player.prefs).toEqual({ theme: 'night', zoom: 2 });
  expect(result.player.counters.played).toBe(15); // A lost acknowledgement must not count the same play twice.
  expect(
    remoteSnapshot({ format: 1, player: { prefs: { theme: 'night' } } }, base, 'A').player.counters
      .played,
  ).toBe(10);
});

it('mission completion wins over a later incomplete branch in either direction', () => {
  const base = emptySnapshot();
  const completed = {
    id: 'fiestera',
    step: 'delivered',
    data: {},
    worldId: null,
    startedAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T01:00:00Z',
    completedAt: '2026-10-01T01:00:00Z',
  };
  const incomplete = {
    ...completed,
    step: 'aboard',
    updatedAt: '2026-10-01T02:00:00Z',
    completedAt: null,
  };
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.player.missions.fiestera = completed;
  remote.player.missions.fiestera = incomplete;
  expect(mergeSnapshots(base, local, remote).player.missions.fiestera?.step).toBe('delivered');
  expect(mergeSnapshots(base, remote, local).player.missions.fiestera?.step).toBe('delivered');
});
