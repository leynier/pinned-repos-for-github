// Every GitHub selector lives here. Inspected on 2026-11-08 against the "Preview" dashboard
// (`/` and `/dashboard`) and the React repository header. Each anchor has a primary selector
// (id, ARIA or data-testid) and a text-based fallback; when both miss, callers do nothing.

import { parseRepoRef, type RepoRef } from '../storage/repo-ref';

/** Marks every node this extension creates, so the observer can ignore its own mutations. */
export const OWN_ATTR = 'data-prg';

export const SECTION_IDS = {
  desktop: 'pinned-repos-ext',
  mobile: 'pinned-repos-ext-mobile',
} as const;

export type SectionKind = keyof typeof SECTION_IDS;

const TOP_REPOS_TEXT = /^\s*top repositories\s*$/i;

function isOwn(element: Element): boolean {
  return element.closest(`[${OWN_ATTR}]`) !== null;
}

function findHeadingByText(root: ParentNode): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('h2, [role="heading"]')].find(
    (heading) => TOP_REPOS_TEXT.test(heading.textContent ?? '') && !isOwn(heading),
  );
}

/** The desktop sidebar (`aside`), visible at 768px and wider. */
export function findSidebar(doc: Document = document): HTMLElement | null {
  return (
    doc.querySelector<HTMLElement>('aside[aria-label="Dashboard menu"]') ??
    doc.querySelector<HTMLElement>('aside.feed-left-sidebar')
  );
}

/** The desktop "Top repositories" block; the pinned section is inserted right before it. */
export function findDesktopTopRepos(doc: Document = document): HTMLElement | null {
  const sidebar = findSidebar(doc);
  if (!sidebar) return null;
  const byAria = sidebar.querySelector<HTMLElement>(
    '[role="navigation"][aria-labelledby="dashboard-top-repositories-heading"]',
  );
  if (byAria) return byAria;
  const heading =
    sidebar.querySelector<HTMLElement>('#dashboard-top-repositories-heading') ??
    findHeadingByText(sidebar);
  if (!heading) return null;
  return (
    heading.closest<HTMLElement>('[role="navigation"]') ??
    heading.closest<HTMLElement>('[aria-labelledby]')
  );
}

/** The copy of "Top repositories" that GitHub shows inside the feed below 768px. */
export function findMobileTopRepos(doc: Document = document): HTMLElement | null {
  const byAria = doc.querySelector<HTMLElement>(
    'nav[aria-labelledby="dashboard-repositories-nav-heading"]',
  );
  if (byAria) return byAria;
  const sidebar = findSidebar(doc);
  for (const nav of doc.querySelectorAll<HTMLElement>('nav')) {
    if (isOwn(nav) || (sidebar && sidebar.contains(nav))) continue;
    const heading = nav.querySelector('h2');
    if (heading && TOP_REPOS_TEXT.test(heading.textContent ?? '')) return nav;
  }
  return null;
}

export function findTopRepos(kind: SectionKind, doc: Document = document): HTMLElement | null {
  return kind === 'desktop' ? findDesktopTopRepos(doc) : findMobileTopRepos(doc);
}

/** Repository rows inside a "Top repositories" block (never our own rows). */
export function findRepoItems(container: ParentNode): HTMLLIElement[] {
  const lists = container.querySelectorAll<HTMLUListElement>('ul.js-dashboard-repos-list');
  const items = lists.length
    ? [...lists].flatMap((list) => [...list.children])
    : [...container.querySelectorAll('ul > li')];
  return items.filter((item): item is HTMLLIElement => item.tagName === 'LI' && !isOwn(item));
}

/** All visible-or-not "Top repositories" rows on the dashboard (desktop and mobile copies). */
export function findAllTopRepoItems(doc: Document = document): HTMLLIElement[] {
  const containers = [findDesktopTopRepos(doc), findMobileTopRepos(doc)].filter(
    (container): container is HTMLElement => container !== null,
  );
  return [...new Set(containers.flatMap(findRepoItems))];
}

export function findRepoLink(item: Element): HTMLAnchorElement | null {
  return (
    item.querySelector<HTMLAnchorElement>('a[data-hovercard-type="repository"][href]') ??
    item.querySelector<HTMLAnchorElement>('a[href]')
  );
}

export function repoRefFromItem(item: Element): RepoRef | null {
  const href = findRepoLink(item)?.getAttribute('href');
  if (!href) return null;
  return parseRepoRef(href.startsWith('/') ? href : new URL(href, 'https://github.com').pathname);
}

/** Users have round avatars (`avatar-user`); organizations have square ones. */
export function ownerIsUserFromItem(item: Element): boolean | undefined {
  const avatar = item.querySelector('img.avatar');
  return avatar ? avatar.classList.contains('avatar-user') : undefined;
}

/** The `ul` with Sponsor, Watch, Fork and Star on any repository page. */
export function findRepoHeaderActions(doc: Document = document): HTMLUListElement | null {
  const byTestId = doc.querySelector<HTMLUListElement>('ul[data-testid="repo-header-actions"]');
  if (byTestId) return byTestId;
  return findStarButton(doc)?.closest<HTMLUListElement>('ul') ?? null;
}

export function findStarButton(root: ParentNode = document): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>('[data-testid="star-button"]') ??
    root.querySelector<HTMLElement>('button[aria-label^="Star "], button[aria-label^="Unstar "]')
  );
}

/** Canonical `owner/name` and numeric id from the repository page metadata. */
export function readRepoMeta(doc: Document = document): (RepoRef & { repoId: number }) | null {
  const nwo = doc.querySelector<HTMLMetaElement>(
    'meta[name="octolytics-dimension-repository_nwo"]',
  )?.content;
  const id = Number(
    doc.querySelector<HTMLMetaElement>('meta[name="octolytics-dimension-repository_id"]')?.content,
  );
  const ref = nwo ? parseRepoRef(nwo) : null;
  if (!ref || !Number.isSafeInteger(id) || id <= 0) return null;
  return { ...ref, repoId: id };
}

/** The health check needs the user's session: a 404 while signed out means nothing. */
export function isSignedIn(doc: Document = document): boolean {
  const login = doc.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content;
  return Boolean(login) || doc.body?.classList.contains('logged-in') === true;
}

/** Owner types visible in Top repositories (round avatar = user), keyed by lowercase owner. */
export function readOwnerTypes(items: readonly Element[]): Map<string, boolean> {
  const owners = new Map<string, boolean>();
  for (const item of items) {
    const ref = repoRefFromItem(item);
    const avatar = item.querySelector('img.avatar');
    if (ref && avatar)
      owners.set(ref.owner.toLowerCase(), avatar.classList.contains('avatar-user'));
  }
  return owners;
}
