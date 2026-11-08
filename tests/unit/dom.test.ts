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
import { EMPTY_TEXT, ensurePinnedSection } from '../../src/features/pinned-section';
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
      ensurePinnedSection('desktop', pins, noopSection, doc);
      ensurePinnedSection('mobile', pins, noopSection, doc);
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
    const section = ensurePinnedSection('desktop', pins, noopSection, doc)!;
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

  it('strips GitHub behaviors, ids and analytics from the clone', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', pins, noopSection, doc)!;
    const all = [section, ...section.querySelectorAll('*')];
    expect(all.some((el) => [...el.classList].some((c) => c.startsWith('js-')))).toBe(false);
    expect(all.some((el) => [...el.attributes].some((a) => a.name.startsWith('data-hydro')))).toBe(
      false,
    );
    expect(section.querySelector('input, form, a[href="/new"], [role="search"]')).toBeNull();
    const ids = all.map((el) => el.id).filter(Boolean);
    expect(ids).toEqual([SECTION_IDS.desktop, `${SECTION_IDS.desktop}-heading`]);
  });

  it('shows an empty state and re-renders when pins change', () => {
    const doc = loadFixture('dashboard.html');
    const section = ensurePinnedSection('desktop', [], noopSection, doc)!;
    expect(section.textContent).toContain(EMPTY_TEXT);
    ensurePinnedSection('desktop', pins, noopSection, doc);
    expect(section.textContent).not.toContain(EMPTY_TEXT);
    expect(section.querySelectorAll('li')).toHaveLength(2);
  });

  it('unpins from the row button', () => {
    const doc = loadFixture('dashboard.html');
    const unpin = vi.fn();
    const section = ensurePinnedSection('desktop', pins, { unpin }, doc)!;
    section.querySelector<HTMLButtonElement>('button[aria-label="Unpin mona/dotfiles"]')!.click();
    expect(unpin).toHaveBeenCalledWith(pins[1]);
  });

  it('re-inserts the section when GitHub replaces Top repositories', () => {
    const doc = loadFixture('dashboard.html');
    ensurePinnedSection('desktop', pins, noopSection, doc);
    const old = findDesktopTopRepos(doc)!;
    const fresh = old.cloneNode(true) as HTMLElement;
    doc.getElementById(SECTION_IDS.desktop)!.remove();
    old.replaceWith(fresh);
    ensurePinnedSection('desktop', pins, noopSection, doc);
    expect(doc.getElementById(SECTION_IDS.desktop)?.nextElementSibling).toBe(fresh);
  });

  it('fails silently without an anchor', () => {
    const doc = loadFixture('dashboard.html');
    doc.querySelector('aside')!.remove();
    doc.querySelector('nav')!.remove();
    const before = doc.body.innerHTML;
    expect(ensurePinnedSection('desktop', pins, noopSection, doc)).toBeNull();
    expect(ensurePinnedSection('mobile', pins, noopSection, doc)).toBeNull();
    expect(decorateTopRepoItems(() => false, { toggle: vi.fn() }, doc)).toBe(0);
    expect(doc.body.innerHTML).toBe(before);
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
