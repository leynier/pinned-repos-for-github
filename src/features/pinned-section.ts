import {
  OWN_ATTR,
  SECTION_IDS,
  findRepoItems,
  findTopRepos,
  type SectionKind,
} from '../dom/anchors';
import { createIcon } from '../lib/icons';
import { formatRepo, repoKey } from '../storage/repo-ref';
import type { Pin } from '../storage/pins';

export const EMPTY_TEXT = 'Hover a repository below and click 📌 to pin it.';
export const NO_MATCH_TEXT = 'No pinned repositories match.';

export interface SectionActions {
  unpin(pin: Pin): void;
}

const HIDE_CLASSES = ['hide-sm', 'hide-md', 'hide-lg', 'hide-xl'];

/** Removes ids, behaviors (`js-*`), analytics and filter wiring copied from GitHub's markup. */
function scrub(root: Element): void {
  for (const element of [root, ...root.querySelectorAll('*')]) {
    element.removeAttribute('id');
    element.removeAttribute('aria-keyshortcuts');
    for (const attribute of [...element.attributes]) {
      if (/^data-(hydro|filterable|url|query-name|ga-)/.test(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
    for (const className of [...element.classList]) {
      if (className.startsWith('js-')) element.classList.remove(className);
    }
  }
}

function headingText(original: string): string {
  const text = original.trim();
  return /top/i.test(text) ? text.replace(/top/i, 'Pinned') : 'Pinned repositories';
}

function avatarUrl(owner: string): string {
  return `https://github.com/${encodeURIComponent(owner)}.png?size=32`;
}

function buildUnpinButton(pin: Pin, actions: SectionActions, doc: Document): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'prg-row-button prg-unpin';
  button.setAttribute(OWN_ATTR, 'unpin');
  button.setAttribute('aria-label', `Unpin ${formatRepo(pin)}`);
  button.title = 'Unpin';
  button.append(createIcon('x', doc));
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.unpin(pin);
  });
  return button;
}

function fillLinks(item: HTMLLIElement, pin: Pin, doc: Document): void {
  const path = `/${pin.owner}/${pin.name}`;
  for (const link of item.querySelectorAll('a')) {
    link.setAttribute('href', path);
    link.setAttribute('data-hovercard-type', 'repository');
    link.setAttribute('data-hovercard-url', `${path}/hovercard`);
  }
  const avatar = item.querySelector('img');
  if (avatar) {
    avatar.src = avatarUrl(pin.owner);
    avatar.alt = pin.name;
    avatar.setAttribute('aria-label', 'Repository');
    avatar.className = 'avatar avatar-small';
    if (pin.ownerIsUser) avatar.classList.add('avatar-user', 'circle');
  }
  const nameLink = [...item.querySelectorAll('a')].find((link) => !link.querySelector('img'));
  if (nameLink) {
    const slash = doc.createElement('span');
    slash.className = 'color-fg-muted';
    slash.textContent = '/';
    nameLink.replaceChildren(pin.owner, slash, pin.name);
  }
}

/** Markup observed in "Top repositories" rows, used when no row is available to clone. */
function buildItemFromScratch(doc: Document): HTMLLIElement {
  const item = doc.createElement('li');
  item.innerHTML =
    '<div class="width-full d-flex mt-2">' +
    '<a class="mr-2 d-flex flex-items-center"><img class="avatar avatar-small" width="16" height="16"></a>' +
    '<div class="wb-break-word"><a class="color-fg-default lh-0 mb-2 markdown-title"></a></div>' +
    '</div>';
  return item;
}

export function buildPinItem(
  pin: Pin,
  actions: SectionActions,
  template: HTMLLIElement | undefined,
  doc: Document = document,
): HTMLLIElement {
  const item = template ? (template.cloneNode(true) as HTMLLIElement) : buildItemFromScratch(doc);
  // The template row may already carry our 📌 toggle; clones never get its listener.
  item.querySelectorAll(`[${OWN_ATTR}]`).forEach((node) => node.remove());
  scrub(item);
  item.className = 'prg-item';
  item.setAttribute(OWN_ATTR, 'item');
  item.dataset.prgRepo = repoKey(pin);
  fillLinks(item, pin, doc);
  const row = item.firstElementChild ?? item;
  row.append(buildUnpinButton(pin, actions, doc));
  return item;
}

function buildMessageItem(text: string, kind: string, doc: Document): HTMLLIElement {
  const item = doc.createElement('li');
  item.className = 'prg-empty color-fg-muted f6 mt-2';
  item.setAttribute(OWN_ATTR, kind);
  item.textContent = text;
  return item;
}

export interface SectionView {
  /** Pins shown before "Show more" (all of them while filtering). */
  limit: number;
}

interface SectionState {
  pins: readonly Pin[];
  view: SectionView;
  actions: SectionActions;
  template: HTMLLIElement | undefined;
}

const sectionState = new WeakMap<HTMLElement, SectionState>();

function filterInput(section: HTMLElement): HTMLInputElement | null {
  return section.querySelector<HTMLInputElement>('input.prg-filter');
}

function moreButton(section: HTMLElement): HTMLButtonElement | null {
  return section.querySelector<HTMLButtonElement>('button.prg-more');
}

/** Reuses GitHub's search box markup, rewired to filter the pins instead of GitHub's list. */
function setUpFilter(section: HTMLElement, kind: SectionKind, list: HTMLElement): void {
  const doc = section.ownerDocument;
  let search = section.querySelector<HTMLElement>('[role="search"]');
  let input = search?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])');
  if (!search || !input) {
    search?.remove();
    search = doc.createElement('div');
    search.className = 'mt-2 tmp-mb-3';
    search.setAttribute('role', 'search');
    input = doc.createElement('input');
    input.type = 'text';
    input.className = 'form-control input-contrast input-block tmp-mb-3';
    search.append(input);
    list.before(search);
  }
  search.querySelectorAll('input').forEach((other) => other !== input && other.remove());
  search.classList.add('prg-search');
  search.setAttribute('aria-label', 'Pinned repositories');
  input.id = `${SECTION_IDS[kind]}-filter`;
  input.classList.add('prg-filter');
  input.value = '';
  input.placeholder = 'Find a repository…';
  input.setAttribute('aria-label', 'Find a pinned repository…');
  input.autocomplete = 'off';
  input.addEventListener('input', () => renderSection(section));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      section
        .querySelector<HTMLAnchorElement>('li.prg-item a.markdown-title, li.prg-item a')
        ?.click();
    } else if (event.key === 'Escape' && input.value) {
      input.value = '';
      renderSection(section);
    }
  });
}

/** Reuses GitHub's "Show more" button look; it expands to every pin, then collapses again. */
function setUpMoreButton(
  section: HTMLElement,
  list: HTMLElement,
  source: HTMLElement | null,
): void {
  const doc = section.ownerDocument;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = source?.className ?? 'width-full text-left btn-link f6 Link--muted tmp-mt-3';
  button.classList.add('prg-more');
  button.addEventListener('click', () => {
    section.dataset.prgExpanded = String(section.dataset.prgExpanded !== 'true');
    renderSection(section);
  });
  const wrapper = doc.createElement('div');
  wrapper.className = 'prg-more-wrapper';
  wrapper.append(button);
  list.after(wrapper);
}

/**
 * Clones GitHub's "Top repositories" block so the section inherits the native look (spacing,
 * typography, light/dark colors, the "New" button and the search box), then rewires or strips
 * everything interactive that belongs to GitHub's list.
 */
export function buildSection(kind: SectionKind, topRepos: HTMLElement): HTMLElement {
  const doc = topRepos.ownerDocument;
  const section = topRepos.cloneNode(true) as HTMLElement;
  const headingId = `${SECTION_IDS[kind]}-heading`;

  const moreSource = section.querySelector<HTMLElement>('form button');
  // The "Show more" form pages through GitHub's list; ours is rebuilt below.
  section.querySelectorAll('form').forEach((node) => node.remove());

  const [heading, ...innerHeadings] = section.querySelectorAll('h2');
  // The mobile copy nests a hidden desktop header; keep only the outermost heading.
  innerHeadings.forEach((inner) => inner.parentElement?.remove());

  scrub(section);
  section.id = SECTION_IDS[kind];
  section.setAttribute(OWN_ATTR, `section-${kind}`);
  section.classList.add('prg-section');
  section.setAttribute('aria-labelledby', headingId);
  if (!section.hasAttribute('role') && section.tagName !== 'NAV') {
    section.setAttribute('role', 'navigation');
  }

  if (heading) {
    heading.id = headingId;
    heading.textContent = headingText(heading.textContent ?? '');
    // GitHub hides its desktop header between 768px and 1011px; ours stays visible.
    heading.parentElement?.classList.remove(...HIDE_CLASSES);
  }

  let list = section.querySelector('ul');
  if (!list) {
    list = doc.createElement('ul');
    list.className = 'list-style-none';
    section.append(list);
  }
  list.classList.add('prg-list');
  list.replaceChildren();

  setUpFilter(section, kind, list);
  setUpMoreButton(section, list, moreSource);
  return section;
}

/** Everything that affects the rendered rows; when it is unchanged the rows are left alone. */
function renderSignature(section: HTMLElement, state: SectionState): string {
  const pins = state.pins
    .map((pin) => `${pin.owner}/${pin.name}:${pin.ownerIsUser ? 'u' : 'o'}`)
    .join(',');
  const query = filterInput(section)?.value ?? '';
  return `${pins}|${state.view.limit}|${section.dataset.prgExpanded === 'true'}|${query}`;
}

export function matchesQuery(pin: Pin, query: string): boolean {
  return formatRepo(pin).toLowerCase().includes(query.trim().toLowerCase());
}

/** Renders the rows for the current pins, filter text and expanded state. */
export function renderSection(section: HTMLElement): void {
  const state = sectionState.get(section);
  const list = section.querySelector('ul.prg-list');
  if (!state || !list) return;
  const doc = section.ownerDocument;
  const { pins, view, actions, template } = state;
  const limit = Math.max(1, view.limit);
  const input = filterInput(section);
  const query = input?.value.trim() ?? '';
  const expanded = section.dataset.prgExpanded === 'true';

  const matches = query ? pins.filter((pin) => matchesQuery(pin, query)) : pins;
  const visible = query || expanded ? matches : matches.slice(0, limit);
  let items: HTMLLIElement[];
  if (pins.length === 0) items = [buildMessageItem(EMPTY_TEXT, 'empty', doc)];
  else if (matches.length === 0) items = [buildMessageItem(NO_MATCH_TEXT, 'no-match', doc)];
  else items = visible.map((pin) => buildPinItem(pin, actions, template, doc));
  list.replaceChildren(...items);

  const search = section.querySelector<HTMLElement>('.prg-search');
  if (search) search.hidden = pins.length === 0;
  const more = moreButton(section);
  if (more) {
    more.hidden = Boolean(query) || pins.length <= limit;
    more.textContent = expanded ? 'Show less' : 'Show more';
    more.setAttribute('aria-expanded', String(expanded));
  }
  section.dataset.prgRendered = renderSignature(section, state);
}

/**
 * Inserts (or refreshes) the pinned section right above "Top repositories". Idempotent: when the
 * section is already in place and up to date, nothing in the DOM changes.
 */
export function ensurePinnedSection(
  kind: SectionKind,
  pins: readonly Pin[],
  view: SectionView,
  actions: SectionActions,
  doc: Document = document,
): HTMLElement | null {
  const topRepos = findTopRepos(kind, doc);
  const existing = doc.getElementById(SECTION_IDS[kind]);
  if (!topRepos) {
    existing?.remove();
    return null;
  }

  let section = existing;
  if (!section || section.nextElementSibling !== topRepos) {
    section?.remove();
    section = buildSection(kind, topRepos);
    topRepos.before(section);
  }
  const state: SectionState = { pins, view, actions, template: findRepoItems(topRepos)[0] };
  sectionState.set(section, state);
  if (section.dataset.prgRendered !== renderSignature(section, state)) renderSection(section);
  return section;
}
