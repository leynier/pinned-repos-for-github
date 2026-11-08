import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  CHUNK_BYTES,
  INDEX_KEY,
  LEGACY_KEY,
  MAX_PINS,
  addPin,
  chunkPins,
  fitsQuota,
  getPins,
  isPinned,
  learnOwnerTypes,
  reconcileRepoIdentity,
  renamePin,
  savePins,
  storedBytes,
  removePin,
  sanitizePins,
  sortPins,
  togglePin,
  watchPins,
  type Pin,
} from '../../src/storage/pins';
import { formatRepo } from '../../src/storage/repo-ref';

const names = (pins: Pin[]) => pins.map(formatRepo);

beforeEach(() => {
  fakeBrowser.reset();
});

describe('sortPins', () => {
  const pin = (owner: string, name: string): Pin => ({ owner, name, addedAt: 0 });

  it('orders alphabetically by owner/name, ignoring case and pin order', () => {
    const pins = [pin('zeta', 'a'), pin('Mona', 'b'), pin('acme', 'z'), pin('mona', 'A')];
    expect(names(sortPins(pins))).toEqual(['acme/z', 'mona/A', 'Mona/b', 'zeta/a']);
  });

  it('uses natural numeric order', () => {
    const pins = [pin('mona', 'repo10'), pin('mona', 'repo2'), pin('mona', 'repo1')];
    expect(names(sortPins(pins))).toEqual(['mona/repo1', 'mona/repo2', 'mona/repo10']);
  });

  it('groups by owner before name', () => {
    const pins = [pin('mona-x', 'a'), pin('mona', 'zeta'), pin('mona', 'alpha')];
    expect(names(sortPins(pins))).toEqual(['mona/alpha', 'mona/zeta', 'mona-x/a']);
  });

  it('does not mutate its input', () => {
    const pins = [pin('b', 'b'), pin('a', 'a')];
    sortPins(pins);
    expect(names(pins)).toEqual(['b/b', 'a/a']);
  });
});

describe('sanitizePins', () => {
  it('drops malformed entries and case-insensitive duplicates', () => {
    expect(
      names(
        sanitizePins([
          { owner: 'mona', name: 'dotfiles', addedAt: 1 },
          { owner: 'MONA', name: 'DotFiles', addedAt: 2 },
          { owner: 'settings', name: 'x' },
          { owner: 42, name: 'x' },
          null,
          'mona/other',
        ]),
      ),
    ).toEqual(['mona/dotfiles']);
    expect(sanitizePins('nope')).toEqual([]);
  });
});

describe('pin storage', () => {
  it('starts empty', async () => {
    expect(await getPins()).toEqual([]);
  });

  it('adds, dedupes case-insensitively and returns pins sorted', async () => {
    expect(await addPin({ owner: 'zeta', name: 'app' })).toBe('added');
    expect(await addPin({ owner: 'acme', name: 'api' }, { ownerIsUser: false })).toBe('added');
    expect(await addPin({ owner: 'ACME', name: 'API' })).toBe('exists');
    expect(await addPin({ owner: 'orgs', name: 'x' })).toBe('invalid');
    expect(names(await getPins())).toEqual(['acme/api', 'zeta/app']);
    expect(await isPinned({ owner: 'Zeta', name: 'App' })).toBe(true);
  });

  it('stores compact pins in sync chunks with an index', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' }, { repoId: 5, ownerIsUser: true });
    const raw = await fakeBrowser.storage.sync.get(null);
    expect(raw[INDEX_KEY]).toMatchObject({ v: 2, chunks: 1 });
    expect(raw['pins:0']).toEqual([
      { o: 'mona', n: 'dotfiles', a: expect.any(Number), i: 5, u: 1 },
    ]);
    expect(raw[LEGACY_KEY]).toBeUndefined();
  });

  it('enforces the pin limit', async () => {
    await savePins(
      Array.from({ length: MAX_PINS }, (_, i) => ({ owner: 'mona', name: `r${i}`, addedAt: i })),
    );
    expect(await getPins()).toHaveLength(MAX_PINS);
    expect(await addPin({ owner: 'mona', name: 'one-more' })).toBe('limit');
    expect(await togglePin({ owner: 'mona', name: 'one-more' })).toEqual({
      pinned: false,
      result: 'limit',
    });
  });

  it('removes and toggles', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' });
    expect(await removePin({ owner: 'Mona', name: 'DOTFILES' })).toBe(true);
    expect(await removePin({ owner: 'mona', name: 'dotfiles' })).toBe(false);
    expect(await togglePin({ owner: 'mona', name: 'dotfiles' })).toMatchObject({ pinned: true });
    expect(await togglePin({ owner: 'mona', name: 'dotfiles' })).toEqual({ pinned: false });
  });

  it('follows a rename by repository id', async () => {
    await addPin({ owner: 'mona', name: 'old-name' }, { repoId: 7 });
    expect(await reconcileRepoIdentity({ owner: 'octo-org', name: 'new-name', repoId: 7 })).toBe(
      true,
    );
    expect(names(await getPins())).toEqual(['octo-org/new-name']);
    expect(await reconcileRepoIdentity({ owner: 'octo-org', name: 'new-name', repoId: 7 })).toBe(
      false,
    );
  });

  it('learns the repository id of a pin added by name', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' });
    expect(await reconcileRepoIdentity({ owner: 'MONA', name: 'dotfiles', repoId: 9 })).toBe(true);
    expect((await getPins())[0]).toMatchObject({ owner: 'mona', repoId: 9 });
  });

  it('notifies watchers with sorted pins', async () => {
    const callback = vi.fn();
    const unwatch = watchPins(callback);
    await addPin({ owner: 'zeta', name: 'b' });
    await addPin({ owner: 'acme', name: 'a' });
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(2));
    expect(names(callback.mock.lastCall?.[0])).toEqual(['acme/a', 'zeta/b']);
    unwatch();
  });
});

describe('chunked storage', () => {
  const many = (count: number, length = 20): Pin[] =>
    Array.from({ length: count }, (_, i) => ({
      owner: `owner-${i}`,
      name: `${'x'.repeat(length)}-${i}`,
      addedAt: 1_700_000_000_000 + i,
      repoId: 100_000_000 + i,
      ownerIsUser: i % 2 === 0,
    }));

  it('keeps every chunk under the per-key quota', () => {
    const chunks = chunkPins(many(400, 60));
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) =>
      expect(storedBytes(`pins:${i}`, chunk)).toBeLessThanOrEqual(CHUNK_BYTES),
    );
    expect(chunks.flat()).toHaveLength(400);
  });

  it('round-trips hundreds of pins and removes stale chunks when the list shrinks', async () => {
    await savePins(many(300));
    expect(await getPins()).toHaveLength(300);
    const before = (await fakeBrowser.storage.sync.get(INDEX_KEY))[INDEX_KEY] as { chunks: number };
    expect(before.chunks).toBeGreaterThan(1);

    await savePins(many(3));
    const raw = await fakeBrowser.storage.sync.get(null);
    expect(raw[INDEX_KEY]).toMatchObject({ chunks: 1 });
    expect(Object.keys(raw).filter((key) => key.startsWith('pins:') && key !== INDEX_KEY)).toEqual([
      'pins:0',
    ]);
    expect(await getPins()).toHaveLength(3);
  });

  it('rejects lists that would not fit the total sync quota', () => {
    expect(fitsQuota(many(MAX_PINS, 20))).toBe(true);
    // Longest legal names: 39-char owners and 100-char repository names.
    const longest = Array.from({ length: MAX_PINS }, (_, i) => ({
      owner: `${'o'.repeat(36)}${String(i).padStart(3, '0')}`,
      name: `${'x'.repeat(97)}${String(i).padStart(3, '0')}`,
      addedAt: 1_700_000_000_000,
      repoId: 1_000_000_000 + i,
    }));
    expect(fitsQuota(longest)).toBe(false);
    expect(fitsQuota(longest.slice(0, 300))).toBe(true);
  });

  it('migrates the v1 single-key list', async () => {
    await fakeBrowser.storage.sync.set({
      [LEGACY_KEY]: [
        { owner: 'zeta', name: 'app', addedAt: 1 },
        { owner: 'acme', name: 'api', addedAt: 2, repoId: 3, ownerIsUser: false },
      ],
    });
    expect(names(await getPins())).toEqual(['acme/api', 'zeta/app']);
    const raw = await fakeBrowser.storage.sync.get(null);
    expect(raw[LEGACY_KEY]).toBeUndefined();
    expect(raw[INDEX_KEY]).toMatchObject({ v: 2, chunks: 1 });
    expect((await getPins())[0]).toMatchObject({ repoId: 3, ownerIsUser: false });
  });
});

describe('renames and owner types', () => {
  it('renames a pin and drops it when the new name is already pinned', async () => {
    await addPin({ owner: 'mona', name: 'old' });
    await addPin({ owner: 'acme', name: 'kept' });
    expect(
      await renamePin({ owner: 'mona', name: 'old' }, { owner: 'octo-org', name: 'new' }),
    ).toBe(true);
    expect(names(await getPins())).toEqual(['acme/kept', 'octo-org/new']);
    expect(
      await renamePin({ owner: 'octo-org', name: 'new' }, { owner: 'acme', name: 'kept' }),
    ).toBe(true);
    expect(names(await getPins())).toEqual(['acme/kept']);
    expect(await renamePin({ owner: 'nobody', name: 'x' }, { owner: 'acme', name: 'y' })).toBe(
      false,
    );
  });

  it('learns missing owner types without overwriting known ones', async () => {
    await addPin({ owner: 'mona', name: 'a' });
    await addPin({ owner: 'acme', name: 'b' }, { ownerIsUser: true });
    expect(
      await learnOwnerTypes(
        new Map([
          ['mona', true],
          ['acme', false],
        ]),
      ),
    ).toBe(true);
    const pins = await getPins();
    expect(pins.find((pin) => pin.owner === 'mona')?.ownerIsUser).toBe(true);
    expect(pins.find((pin) => pin.owner === 'acme')?.ownerIsUser).toBe(true);
    expect(await learnOwnerTypes(new Map([['mona', true]]))).toBe(false);
  });
});
