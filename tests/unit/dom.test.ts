import { describe, expect, it, vi } from 'vitest';
import {
  SECTION_IDS,
  findAllTopRepoItems,
  findDesktopTopRepos,
  findMobileTopRepos,
  findRepoHeaderActions,
  readRepoMeta,
  repoRefFromItem,
} from '../../src/dom/anchors';
import { EMPTY_TEXT, NO_MATCH_TEXT, ensurePinnedSection } from '../../src/features/pinned-section';
import { decorateTopRepoItems } from '../../src/features/top-repo-pin';
import { REPO_BUTTON_ATTR, ensureRepoPinButton } from '../../src/features/repo-pin-button';
import { isOwnMutation } from '../../src/lib/observe';
import type { Pin } from '../../src/storage/pins';
import { formatRepo, repoKey } from '../../src/storage/repo-ref';
import { loadFixture } from './helpers';

const pins: Pin[] = [
  { owner: 'acme', name: 'api-server', addedAt: 1 },
  { owner: 'mona', name: 'dotfiles', addedAt: 2, ownerIsUser: true },
];
const noopSection = { unpin: vi.fn() };
const view = { limit: 7 };

describe('anchors', () => {
  it('finds desktop and mobile Top repositories', () => {
    const doc = loadFixture('dashboard.html');
    expect(findDesktopTopRepos(doc)?.getAttribute('aria-labelledby')).toBe(
      'dashboard-top-repositories-heading',
    );
    expect(findMobileTopRepos(doc)?.tagName).toBe('NAV');
    expect(findAllTopRepoItems(doc)).toHaveLength(8);
    expect(findAllTopRepoItems(doc).map((item) => formatRepo(repoRefFromItem(item)!))).toContain(
      'octo-org/website',
    );
  });

  it('falls back to the heading text when ids and ARIA change', () => {
    const doc = loadFixture('dashboard.html');
    const desktop = findDesktopTopRepos(doc)!;
    desktop.removeAttribute('aria-labelledby');
    doc.getElementById('dashboard-top-repositories-heading')!.removeAttribute('id');
    expect(findDesktopTopRepos(doc)).toBe(desktop);

    const mobile = findMobileTopRepos(doc)!;
    mobile.removeAttribute('aria-labelledby');
    expect(findMobileTopRepos(doc)).toBe(mobile);
  });

  it('reads repository metadata', () => {
    const doc = loadFixture('repo.html');
    expect(findRepoHeaderActions(doc)?.children).toHaveLength(4);
    expect(readRepoMeta(doc)).toEqual({ owner: 'mona', name: 'dotfiles', repoId: 424242 });
  });
});

describe('pinned section', () => {
  it('is inserted right above Top repositories, once, on desktop and mobile', () => {
    const doc = loadFixture('dashboard.html');
    for (let i = 0; i < 3; i++) {
      ensurePinnedSection('desktop', pins, view, noopSection, doc);
      ensurePinnedSection('mobile', pins, view, noopSection, doc);
    }
    const desktop = doc.querySelectorAll(`#${SECTION_IDS.desktop}`);
    const mobile = doc.querySelectorAll(`#${SECTION_IDS.mobile}`);
    expect(desktop).toHaveLength(1);
    expect(mobile).toHaveLength(1);
    expect(desktop[0]!.nextElementSibling).toBe(findDesktopTopRepos(doc));
    expect(mobile[0]!.nextElementSibling).toBe(findMobileTopRepos(doc));
    expect(desktop[0]!.querySelector('h2')?.textContent).toBe('Pinned repositories');
    expect(mobile[0]!.querySelector('h2')?.textContent).toBe('Pinned Repositories');
  });

  it('renders pins in the given order with native links and avatars', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', pins, view, noopSection, doc)!;
    const items = [...section.querySelectorAll('li')];
    expect(items.map((item) => item.textContent?.replace(/\s+/g, ''))).toEqual([
      'acme/api-server',
      'mona/dotfiles',
    ]);
    const links = items[1]!.querySelectorAll('a');
    expect([...links].map((link) => link.getAttribute('href'))).toEqual([
      '/mona/dotfiles',
      '/mona/dotfiles',
    ]);
    expect(links[0]!.getAttribute('data-hovercard-url')).toBe('/mona/dotfiles/hovercard');
    const avatar = items[1]!.querySelector('img')!;
    expect(avatar.getAttribute('src')).toBe('https://github.com/mona.png?size=32');
    expect(avatar.classList.contains('circle')).toBe(true);
    expect(items[0]!.querySelector('img')!.classList.contains('circle')).toBe(false);
  });

  it('strips GitHub behaviors, ids and analytics from the clone, keeping New and search', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', pins, view, noopSection, doc)!;
    const all = [section, ...section.querySelectorAll('*')];
    expect(all.some((el) => [...el.classList].some((c) => c.startsWith('js-')))).toBe(false);
    expect(all.some((el) => [...el.attributes].some((a) => a.name.startsWith('data-hydro')))).toBe(
      false,
    );
    expect(
      all.some((el) => [...el.attributes].some((a) => a.name.startsWith('data-filterable'))),
    ).toBe(false);
    expect(section.querySelector('form')).toBeNull();
    expect(section.querySelector('a[href="/new"]')?.textContent?.trim()).toBe('New');
    const ids = all.map((el) => el.id).filter(Boolean);
    expect(ids).toEqual([
      SECTION_IDS.desktop,
      `${SECTION_IDS.desktop}-heading`,
      `${SECTION_IDS.desktop}-filter`,
    ]);
  });

  it('shows an empty state and re-renders when pins change', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', [], view, noopSection, doc)!;
    expect(section.textContent).toContain(EMPTY_TEXT);
    ensurePinnedSection('desktop', pins, view, noopSection, doc);
    expect(section.textContent).not.toContain(EMPTY_TEXT);
    expect(section.querySelectorAll('li')).toHaveLength(2);
  });

  it('does not copy the 📌 toggle from an already decorated template row', () => {
    const doc = loadFixture('dashboard.html');
    decorateTopRepoItems(() => false, { toggle: vi.fn() }, doc);
    const section = ensurePinnedSection('desktop', pins, view, noopSection, doc)!;
    expect(section.querySelectorAll('button[data-prg-pin]')).toHaveLength(0);
    for (const item of section.querySelectorAll('li.prg-item')) {
      expect(item.querySelectorAll('button')).toHaveLength(1);
    }
  });

  it('unpins from the row button', () => {
    const doc = loadFixture('dashboard.html');
    const unpin = vi.fn();
    const section = ensurePinnedSection('desktop', pins, view, { unpin }, doc)!;
    section.querySelector<HTMLButtonElement>('button[aria-label="Unpin mona/dotfiles"]')!.click();
    expect(unpin).toHaveBeenCalledWith(pins[1]);
  });

  it('re-inserts the section when GitHub replaces Top repositories', () => {
    const doc = loadFixture('dashboard.html');
    ensurePinnedSection('desktop', pins, view, noopSection, doc);
    const old = findDesktopTopRepos(doc)!;
    const fresh = old.cloneNode(true) as HTMLElement;
    doc.getElementById(SECTION_IDS.desktop)!.remove();
    old.replaceWith(fresh);
    ensurePinnedSection('desktop', pins, view, noopSection, doc);
    expect(doc.getElementById(SECTION_IDS.desktop)?.nextElementSibling).toBe(fresh);
  });

  it('fails silently without an anchor', () => {
    const doc = loadFixture('dashboard.html');
    doc.querySelector('aside')!.remove();
    doc.querySelector('nav')!.remove();
    const before = doc.body.innerHTML;
    expect(ensurePinnedSection('desktop', pins, view, noopSection, doc)).toBeNull();
    expect(ensurePinnedSection('mobile', pins, view, noopSection, doc)).toBeNull();
    expect(decorateTopRepoItems(() => false, { toggle: vi.fn() }, doc)).toBe(0);
    expect(doc.body.innerHTML).toBe(before);
  });
});

describe('pinned section filter and Show more', () => {
  const many: Pin[] = Array.from({ length: 10 }, (_, i) => ({
    owner: 'mona',
    name: `repo${i + 1}`,
    addedAt: i,
  }));
  const shown = (section: HTMLElement) =>
    [...section.querySelectorAll('li.prg-item a.markdown-title')].map((a) =>
      a.textContent?.replace(/\s+/g, ''),
    );
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('shows the first N pins and expands with Show more', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', many, view, noopSection, doc)!;
    expect(shown(section)).toHaveLength(7);
    const more = section.querySelector<HTMLButtonElement>('button.prg-more')!;
    expect(more.hidden).toBe(false);
    expect(more.textContent).toBe('Show more');
    more.click();
    expect(shown(section)).toHaveLength(10);
    expect(more.textContent).toBe('Show less');
    more.click();
    expect(shown(section)).toHaveLength(7);
  });

  it('hides Show more when every pin fits, and follows the configured limit', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', many, { limit: 20 }, noopSection, doc)!;
    expect(shown(section)).toHaveLength(10);
    expect(section.querySelector<HTMLButtonElement>('button.prg-more')!.hidden).toBe(true);
    ensurePinnedSection('desktop', many, { limit: 3 }, noopSection, doc);
    expect(shown(section)).toEqual(['mona/repo1', 'mona/repo2', 'mona/repo3']);
  });

  it('filters across all pins, not only the visible ones', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', many, view, noopSection, doc)!;
    const input = section.querySelector<HTMLInputElement>('input.prg-filter')!;
    expect(input.placeholder).toBe('Find a repository…');
    type(input, 'REPO1');
    expect(shown(section)).toEqual(['mona/repo1', 'mona/repo10']);
    expect(section.querySelector<HTMLButtonElement>('button.prg-more')!.hidden).toBe(true);
    type(input, 'nothing');
    expect(section.textContent).toContain(NO_MATCH_TEXT);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(input.value).toBe('');
    expect(shown(section)).toHaveLength(7);
  });

  it('keeps the filter text when pins change', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', many, view, noopSection, doc)!;
    type(section.querySelector<HTMLInputElement>('input.prg-filter')!, 'repo2');
    ensurePinnedSection(
      'desktop',
      [...many, { owner: 'mona', name: 'repo20', addedAt: 99 }],
      view,
      noopSection,
      doc,
    );
    expect(shown(section)).toEqual(['mona/repo2', 'mona/repo20']);
  });

  it('does not wire the filter to GitHub list behaviors', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', many, view, noopSection, doc)!;
    const input = section.querySelector<HTMLInputElement>('input.prg-filter')!;
    expect(input.className).not.toMatch(/js-/);
    type(input, 'repo3');
    // GitHub's own list is unaffected by our filter.
    expect(findDesktopTopRepos(doc)!.querySelectorAll('ul > li')).toHaveLength(4);
  });
});

describe('Top repositories pin toggle', () => {
  it('adds one toggle per row and reflects the pinned state', () => {
    const doc = loadFixture('dashboard.html');
    const pinned = new Set([repoKey({ owner: 'mona', name: 'dotfiles' })]);
    const toggle = vi.fn();
    expect(decorateTopRepoItems((key) => pinned.has(key), { toggle }, doc)).toBe(8);
    expect(decorateTopRepoItems((key) => pinned.has(key), { toggle }, doc)).toBe(0);

    const buttons = [...doc.querySelectorAll<HTMLButtonElement>('button[data-prg-pin]')];
    expect(buttons).toHaveLength(8);
    const mona = buttons.find((b) => b.getAttribute('data-prg-pin') === 'mona/dotfiles')!;
    expect(mona.getAttribute('aria-pressed')).toBe('true');
    expect(mona.getAttribute('aria-label')).toBe('Unpin mona/dotfiles');
    // No text is added to the row, so GitHub's substring filter is unaffected.
    expect(mona.textContent).toBe('');

    mona.click();
    expect(toggle).toHaveBeenCalledWith({ owner: 'mona', name: 'dotfiles' }, { ownerIsUser: true });
  });

  it('decorates rows added later by "Show more"', () => {
    const doc = loadFixture('dashboard.html');
    decorateTopRepoItems(() => false, { toggle: vi.fn() }, doc);
    const list = findDesktopTopRepos(doc)!.querySelector('ul')!;
    const row = list.firstElementChild!.cloneNode(true) as HTMLElement;
    row.querySelector('button[data-prg-pin]')!.remove();
    row.querySelectorAll('a').forEach((a) => a.setAttribute('href', '/acme/new-repo'));
    list.append(row);
    expect(decorateTopRepoItems(() => false, { toggle: vi.fn() }, doc)).toBe(1);
  });
});

describe('repository Pin button', () => {
  const ref = { owner: 'mona', name: 'dotfiles' };

  it('is appended last, once, cloned from Star without its counter', () => {
    const doc = loadFixture('repo.html');
    const toggle = vi.fn();
    for (let i = 0; i < 3; i++) ensureRepoPinButton(ref, () => false, { toggle }, doc);
    const ul = findRepoHeaderActions(doc)!;
    expect(ul.querySelectorAll(`[${REPO_BUTTON_ATTR}]`)).toHaveLength(1);
    const button = ul.lastElementChild!.querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute(REPO_BUTTON_ATTR)).toBe('mona/dotfiles');
    expect(button.textContent).toBe('Pin');
    expect(button.getAttribute('data-testid')).toBeNull();
    expect(button.getAttribute('data-size')).toBe('small');
    expect(button.classList.contains('prc-Button-ButtonBase-9n-Xk')).toBe(true);
    button.click();
    expect(toggle).toHaveBeenCalledWith(ref);
  });

  it('reflects the pinned state', () => {
    const doc = loadFixture('repo.html');
    let pinned = false;
    const button = ensureRepoPinButton(ref, () => pinned, { toggle: vi.fn() }, doc)!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    pinned = true;
    ensureRepoPinButton(ref, () => pinned, { toggle: vi.fn() }, doc);
    expect(button.textContent).toBe('Unpin');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('replaces a stale button after a soft navigation to another repository', () => {
    const doc = loadFixture('repo.html');
    ensureRepoPinButton(ref, () => false, { toggle: vi.fn() }, doc);
    ensureRepoPinButton(
      { owner: 'acme', name: 'api-server' },
      () => false,
      { toggle: vi.fn() },
      doc,
    );
    const buttons = doc.querySelectorAll(`[${REPO_BUTTON_ATTR}]`);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.getAttribute(REPO_BUTTON_ATTR)).toBe('acme/api-server');
  });

  it('fails silently without the header actions', () => {
    const doc = loadFixture('repo.html');
    findRepoHeaderActions(doc)!.remove();
    expect(ensureRepoPinButton(ref, () => false, { toggle: vi.fn() }, doc)).toBeNull();
  });
});

describe('isOwnMutation', () => {
  const record = (init: Partial<MutationRecord>) => init as MutationRecord;
  const own = () => {
    const el = document.createElement('div');
    el.setAttribute('data-prg', 'x');
    return el;
  };
  const list = (...nodes: Node[]) => nodes as unknown as NodeList;

  it('ignores mutations inside or insertions of our nodes', () => {
    expect(isOwnMutation(record({ target: own(), addedNodes: list(), removedNodes: list() }))).toBe(
      true,
    );
    expect(
      isOwnMutation(
        record({ target: document.body, addedNodes: list(own()), removedNodes: list() }),
      ),
    ).toBe(true);
  });

  it('reacts to GitHub changes and to removals of our nodes', () => {
    const plain = document.createElement('li');
    expect(
      isOwnMutation(
        record({ target: document.body, addedNodes: list(plain), removedNodes: list() }),
      ),
    ).toBe(false);
    expect(
      isOwnMutation(
        record({ target: document.body, addedNodes: list(), removedNodes: list(own()) }),
      ),
    ).toBe(false);
  });
});
