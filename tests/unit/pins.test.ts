import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  MAX_PINS,
  addPin,
  getPins,
  isPinned,
  pinsItem,
  reconcileRepoIdentity,
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

  it('stores pins in the sync area', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' });
    const raw = await fakeBrowser.storage.sync.get('pins');
    expect((raw.pins as Pin[])[0]).toMatchObject({ owner: 'mona', name: 'dotfiles' });
  });

  it('enforces the pin limit', async () => {
    await pinsItem.setValue(
      Array.from({ length: MAX_PINS }, (_, i) => ({ owner: 'mona', name: `r${i}`, addedAt: i })),
    );
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
