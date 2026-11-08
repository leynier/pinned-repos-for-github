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
  scrub(item);
  item.className = 'prg-item';
  item.setAttribute(OWN_ATTR, 'item');
  item.dataset.prgRepo = repoKey(pin);
  fillLinks(item, pin, doc);
  const row = item.firstElementChild ?? item;
  row.append(buildUnpinButton(pin, actions, doc));
  return item;
}

function buildEmptyItem(doc: Document): HTMLLIElement {
  const item = doc.createElement('li');
  item.className = 'prg-empty color-fg-muted f6 mt-2';
  item.setAttribute(OWN_ATTR, 'empty');
  item.textContent = EMPTY_TEXT;
  return item;
}

/**
 * Clones GitHub's "Top repositories" block so the section inherits the native look (spacing,
 * typography, light/dark colors), then strips everything interactive that belongs to GitHub.
 */
export function buildSection(kind: SectionKind, topRepos: HTMLElement): HTMLElement {
  const doc = topRepos.ownerDocument;
  const section = topRepos.cloneNode(true) as HTMLElement;
  const headingId = `${SECTION_IDS[kind]}-heading`;

  // Search box, "Show more" form and the "New" button belong to GitHub's list only.
  section
    .querySelectorAll('[role="search"], form, input, a[href="/new"]')
    .forEach((node) => node.remove());

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
  return section;
}

/** Everything that affects how the rows look; when it is unchanged the rows are left alone. */
function renderSignature(pins: readonly Pin[]): string {
  return pins.map((pin) => `${pin.owner}/${pin.name}:${pin.ownerIsUser ? 'u' : 'o'}`).join(',');
}

export function renderSectionItems(
  section: HTMLElement,
  pins: readonly Pin[],
  actions: SectionActions,
  template: HTMLLIElement | undefined,
): void {
  const list = section.querySelector('ul.prg-list');
  if (!list) return;
  const doc = section.ownerDocument;
  const items = pins.length
    ? pins.map((pin) => buildPinItem(pin, actions, template, doc))
    : [buildEmptyItem(doc)];
  list.replaceChildren(...items);
  section.dataset.prgRendered = renderSignature(pins);
}

/**
 * Inserts (or refreshes) the pinned section right above "Top repositories". Idempotent: when the
 * section is already in place and up to date, nothing in the DOM changes.
 */
export function ensurePinnedSection(
  kind: SectionKind,
  pins: readonly Pin[],
  actions: SectionActions,
  doc: Document = document,
): HTMLElement | null {
  const topRepos = findTopRepos(kind, doc);
  const existing = doc.getElementById(SECTION_IDS[kind]);
  if (!topRepos) {
    existing?.remove();
    return null;
  }

  const template = findRepoItems(topRepos)[0];
  let section = existing;
  if (!section || section.nextElementSibling !== topRepos) {
    section?.remove();
    section = buildSection(kind, topRepos);
    topRepos.before(section);
    section.dataset.prgRendered = '\u0000'; // Force the first render.
  }
  if (section.dataset.prgRendered !== renderSignature(pins)) {
    renderSectionItems(section, pins, actions, template);
  }
  return section;
}
