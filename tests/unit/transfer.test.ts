import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { importText } from '../../src/options';
import { MAX_PINS, addPin, getPins, type Pin } from '../../src/storage/pins';
import { formatRepo } from '../../src/storage/repo-ref';
import { getSettings, setVisibleCount } from '../../src/storage/settings';
import { buildExport, exportFileName, parseImport, planImport } from '../../src/transfer';

const names = (pins: Pin[]) => pins.map(formatRepo);
const pin = (owner: string, name: string, extra: Partial<Pin> = {}): Pin => ({
  owner,
  name,
  addedAt: 1,
  ...extra,
});

beforeEach(() => fakeBrowser.reset());

describe('export', () => {
  it('builds a versioned file that parses back', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    const file = buildExport(
      [pin('mona', 'dotfiles', { repoId: 4 })],
      { visibleCount: 5, collapsed: false },
      now,
    );
    expect(file).toMatchObject({ format: 'pinned-repos-for-github', version: 1 });
    expect(exportFileName(now)).toBe('pinned-repos-for-github-2026-11-08.json');
    const parsed = parseImport(JSON.stringify(file));
    expect(parsed).toEqual({
      pins: [pin('mona', 'dotfiles', { repoId: 4 })],
      settings: { visibleCount: 5, collapsed: false },
      skipped: 0,
    });
  });
});

describe('parseImport', () => {
  it('accepts a plain array of strings and URLs', () => {
    const parsed = parseImport(
      JSON.stringify([
        'mona/dotfiles',
        'https://github.com/acme/api/tree/main',
        'nope',
        'MONA/dotfiles',
      ]),
    );
    expect('pins' in parsed && names(parsed.pins)).toEqual(['mona/dotfiles', 'acme/api']);
    expect('skipped' in parsed && parsed.skipped).toBe(2);
  });

  it('reports invalid files', () => {
    expect(parseImport('{')).toEqual({ error: 'The file is not valid JSON.' });
    expect(parseImport('{"foo": 1}')).toEqual({
      error: 'No list of repositories found in the file.',
    });
  });
});

describe('planImport', () => {
  const current = [pin('mona', 'dotfiles'), pin('acme', 'api', { ownerIsUser: false })];

  it('merges new pins and fills missing metadata', () => {
    const plan = planImport(
      current,
      [
        pin('Mona', 'DotFiles', { repoId: 9, ownerIsUser: true }),
        pin('zeta', 'app', { addedAt: 0 }),
      ],
      'merge',
      42,
    );
    expect(plan).toMatchObject({ added: 1, existing: 1, fits: true });
    expect(plan.pins.find((p) => p.name === 'dotfiles')).toMatchObject({
      repoId: 9,
      ownerIsUser: true,
    });
    expect(plan.pins.find((p) => p.name === 'app')?.addedAt).toBe(42);
  });

  it('replaces everything', () => {
    const plan = planImport(current, [pin('zeta', 'app')], 'replace');
    expect(names(plan.pins)).toEqual(['zeta/app']);
  });

  it('flags imports that exceed the limit', () => {
    const many = Array.from({ length: MAX_PINS }, (_, i) => pin('mona', `r${i}`));
    expect(planImport(current, many, 'merge').fits).toBe(false);
  });
});

describe('importText', () => {
  it('merges into storage', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' });
    const result = await importText(JSON.stringify(['acme/api', 'mona/dotfiles', 'bad']), 'merge');
    expect(result).toEqual({
      ok: true,
      message: 'Added 1 pin. 1 already pinned. 1 skipped (invalid or duplicate).',
    });
    expect(names(await getPins())).toEqual(['acme/api', 'mona/dotfiles']);
  });

  it('replaces pins and settings', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' });
    await setVisibleCount(3);
    const file = buildExport([pin('zeta', 'app'), pin('acme', 'api')], {
      visibleCount: 12,
      collapsed: false,
    });
    const result = await importText(JSON.stringify(file), 'replace');
    expect(result.message).toBe('Replaced your pins with 2 repositories.');
    expect(names(await getPins())).toEqual(['acme/api', 'zeta/app']);
    expect((await getSettings()).visibleCount).toBe(12);
  });

  it('writes nothing on errors', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' });
    expect((await importText('[]', 'replace')).ok).toBe(false);
    expect((await importText('not json', 'merge')).ok).toBe(false);
    expect(names(await getPins())).toEqual(['mona/dotfiles']);
  });
});
