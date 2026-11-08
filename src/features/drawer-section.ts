import { DRAWER_ID, OWN_ATTR, findDrawerTopRepos } from '../dom/anchors';
import { formatRepo, repoKey } from '../storage/repo-ref';
import type { Pin } from '../storage/pins';
import { MISSING_TEXT, type SectionView } from './pinned-section';

const DIVIDER_ID = `${DRAWER_ID}-divider`;
const HEADING_ID = `${DRAWER_ID}-heading`;
const ITEM_SELECTOR = '[data-testid="dynamic-side-panel-items-item"]';
const SHOW_MORE_SELECTOR = '[data-testid="dynamic-side-panel-items-show-more"]';
const LABEL_SELECTOR = '[data-component="ActionList.Item.Label"]';

/** Latest arguments, so "Show more" re-renders with current pins rather than stale ones. */
let latest: { pins: readonly Pin[]; view: SectionView; doc: Document } | null = null;

/** React ids, test ids and label references must not be duplicated in our clone. */
function scrub(root: Element): void {
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const name of ['id', 'aria-labelledby', 'data-testid', 'data-discover', 'popover']) {
      element.removeAttribute(name);
    }
  }
}

function fromHtml(doc: Document, html: string): HTMLLIElement {
  const item = doc.createElement('li');
  item.innerHTML = html; // Static markup only; repository data is set with textContent below.
  return item;
}

function buildItem(
  pin: Pin,
  index: number,
  missing: boolean,
  template: Element | null,
  doc: Document,
): HTMLLIElement {
  const item = template
    ? (template.cloneNode(true) as HTMLLIElement)
    : fromHtml(doc, `<a><span data-component="ActionList.Item.Label"></span></a>`);
  scrub(item);
  item.setAttribute(OWN_ATTR, 'drawer-item');
  item.dataset.prgRepo = repoKey(pin);
  const labelId = `${DRAWER_ID}-item-${index}--label`;
  const link = item.querySelector('a');
  link?.setAttribute('href', `/${pin.owner}/${pin.name}`);
  link?.setAttribute('aria-labelledby', labelId);
  const label = item.querySelector(LABEL_SELECTOR);
  if (label) {
    label.id = labelId;
    label.textContent = formatRepo(pin);
  }
  const avatar = item.querySelector('img');
  if (avatar) {
    avatar.src = `https://github.com/${encodeURIComponent(pin.owner)}.png?size=32`;
    avatar.alt = '';
  }
  if (missing) {
    item.classList.add('prg-missing');
    link?.setAttribute('title', MISSING_TEXT);
  }
  return item;
}

function buildGroup(top: HTMLElement): HTMLElement {
  const group = top.cloneNode(true) as HTMLElement;
  const heading = group.querySelector('[data-component="NavList.GroupHeading"]');
  // The search button and its tooltip open GitHub's repository search; not ours.
  heading?.querySelectorAll('button, [data-component="Tooltip"]').forEach((node) => node.remove());
  scrub(group);
  group.id = DRAWER_ID;
  group.setAttribute(OWN_ATTR, 'drawer');
  if (heading) {
    heading.id = HEADING_ID;
    (heading.querySelector('div') ?? heading).textContent = 'Pinned repositories';
  }
  group.querySelector('ul')?.setAttribute('aria-labelledby', HEADING_ID);
  return group;
}

function buildDivider(top: HTMLElement, doc: Document): HTMLElement {
  const source = [...(top.parentElement?.children ?? [])].find(
    (child) => child.getAttribute('data-component') === 'ActionList.Divider',
  );
  const divider = source ? (source.cloneNode(true) as HTMLElement) : doc.createElement('li');
  scrub(divider);
  divider.id = DIVIDER_ID;
  divider.setAttribute(OWN_ATTR, 'drawer-divider');
  divider.setAttribute('aria-hidden', 'true');
  return divider;
}

function buildShowMore(
  group: HTMLElement,
  top: HTMLElement,
  expanded: boolean,
  doc: Document,
): HTMLLIElement {
  const source = top.querySelector(SHOW_MORE_SELECTOR)?.closest('li');
  const item = source
    ? (source.cloneNode(true) as HTMLLIElement)
    : fromHtml(doc, '<button type="button"></button>');
  scrub(item);
  item.setAttribute(OWN_ATTR, 'drawer-more');
  const button = item.querySelector('button');
  if (button) {
    const label = button.querySelector('.f6') ?? button.querySelector(LABEL_SELECTOR) ?? button;
    label.textContent = expanded ? 'Show less' : 'Show more';
    button.setAttribute('aria-expanded', String(expanded));
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      group.dataset.prgExpanded = String(!expanded);
      if (latest) ensureDrawerSection(latest.pins, latest.view, latest.doc);
    });
  }
  return item;
}

/**
 * Adds a "Pinned repositories" group (and a divider) right above "Top repositories" in the global
 * navigation drawer, cloned from GitHub's own group. Idempotent; nothing is added without pins.
 * Navigation only: pinning and unpinning happen on the dashboard, repository pages or the popup.
 */
export function ensureDrawerSection(
  pins: readonly Pin[],
  view: SectionView,
  doc: Document = document,
): HTMLElement | null {
  latest = { pins, view, doc };
  const top = findDrawerTopRepos(doc);
  let group = doc.getElementById(DRAWER_ID);
  let divider = doc.getElementById(DIVIDER_ID);
  if (!top || pins.length === 0) {
    group?.remove();
    divider?.remove();
    return null;
  }

  const inPlace =
    group && divider && group.nextElementSibling === divider && divider.nextElementSibling === top;
  if (!group || !inPlace) {
    group?.remove();
    divider?.remove();
    group = buildGroup(top);
    divider = buildDivider(top, doc);
    top.before(group, divider);
  }

  const limit = Math.max(1, view.limit);
  const expanded = group.dataset.prgExpanded === 'true';
  const missing = (pin: Pin) => view.missing?.has(repoKey(pin)) ?? false;
  const signature = [
    pins.map((pin) => `${formatRepo(pin)}:${missing(pin) ? 'm' : ''}`).join(','),
    limit,
    expanded,
  ].join('|');
  if (group.dataset.prgRendered === signature) return group;

  const list = group.querySelector('ul');
  if (list) {
    const template = top.querySelector(ITEM_SELECTOR)?.closest('li') ?? null;
    const visible = expanded ? pins : pins.slice(0, limit);
    const items: HTMLElement[] = visible.map((pin, index) =>
      buildItem(pin, index, missing(pin), template, doc),
    );
    if (pins.length > limit) items.push(buildShowMore(group, top, expanded, doc));
    list.replaceChildren(...items);
  }
  group.dataset.prgRendered = signature;
  return group;
}
