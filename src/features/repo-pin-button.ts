import { OWN_ATTR, findRepoHeaderActions, findStarButton } from '../dom/anchors';
import { createIcon } from '../lib/icons';
import { formatRepo, repoKey, type RepoRef } from '../storage/repo-ref';

export const REPO_BUTTON_ATTR = 'data-prg-repo-pin';

export interface RepoButtonActions {
  toggle(ref: RepoRef): void;
}

/**
 * Clones a native header button so ours gets Primer's hashed classes and data attributes (and
 * with them the exact size, colors and narrow-width behavior), but none of React's handlers:
 * React delegates events from its root and `cloneNode` does not copy the fiber reference.
 */
function cloneNativeButton(ul: HTMLUListElement): HTMLElement {
  const doc = ul.ownerDocument;
  const source =
    findStarButton(ul) ?? ul.querySelector<HTMLElement>('[data-component="Button"], button, a');
  if (!source) {
    const fallback = doc.createElement('button');
    fallback.className = 'btn btn-sm';
    return fallback;
  }
  const clone = source.cloneNode(true) as HTMLElement;
  if (clone.tagName === 'BUTTON') return clone;
  // Links (Sponsor, Fork) become buttons with the same classes and content.
  const button = doc.createElement('button');
  for (const attribute of [...clone.attributes]) {
    if (attribute.name !== 'href') button.setAttribute(attribute.name, attribute.value);
  }
  button.append(...clone.childNodes);
  return button;
}

function setContent(button: HTMLElement, pinned: boolean): void {
  const doc = button.ownerDocument;
  const label = pinned ? 'Unpin' : 'Pin';
  const icon = createIcon(pinned ? 'pin-slash' : 'pin', doc);
  const leading = button.querySelector('[data-component="leadingVisual"]');
  const text = button.querySelector('[data-component="text"]');
  if (leading && text) {
    leading.replaceChildren(icon);
    text.textContent = label;
    return;
  }
  icon.classList.add('mr-1');
  button.replaceChildren(icon, label);
}

function buildRepoButton(
  ul: HTMLUListElement,
  ref: RepoRef,
  actions: RepoButtonActions,
): HTMLLIElement {
  const item = ul.ownerDocument.createElement('li');
  item.setAttribute(OWN_ATTR, 'repo-pin');
  const button = cloneNativeButton(ul);
  for (const name of [
    'id',
    'data-testid',
    'aria-describedby',
    'aria-labelledby',
    'aria-haspopup',
    'aria-expanded',
    'popovertarget',
    'disabled',
    'aria-disabled',
  ]) {
    button.removeAttribute(name);
  }
  // Drop counters and dropdown carets; keep the leading icon and the label.
  button
    .querySelectorAll(
      '[data-component="trailingVisual"], [data-component="trailingAction"], .Counter',
    )
    .forEach((node) => node.remove());
  button.setAttribute('type', 'button');
  button.setAttribute(REPO_BUTTON_ATTR, repoKey(ref));
  if (button.hasAttribute('data-loading')) button.setAttribute('data-loading', 'false');
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.toggle(ref);
  });
  item.append(button);
  return item;
}

function updateRepoButton(button: HTMLElement, ref: RepoRef, pinned: boolean): void {
  const state = String(pinned);
  if (button.getAttribute('aria-pressed') === state) return;
  button.setAttribute('aria-pressed', state);
  button.setAttribute(
    'aria-label',
    pinned
      ? `Unpin ${formatRepo(ref)} from your dashboard`
      : `Pin ${formatRepo(ref)} to your dashboard`,
  );
  button.title = pinned ? 'Unpin from your dashboard' : 'Pin to your dashboard';
  setContent(button, pinned);
}

/**
 * Appends a Pin/Unpin button as the last item of the repository header actions. Always appended
 * at the end so React's reconciliation of its own items is not disturbed.
 */
export function ensureRepoPinButton(
  ref: RepoRef,
  isPinnedKey: (key: string) => boolean,
  actions: RepoButtonActions,
  doc: Document = document,
): HTMLElement | null {
  const ul = findRepoHeaderActions(doc);
  if (!ul) return null;
  const key = repoKey(ref);
  let button = ul.querySelector<HTMLElement>(`[${REPO_BUTTON_ATTR}]`);
  if (button && button.getAttribute(REPO_BUTTON_ATTR) !== key) {
    button.closest('li')?.remove();
    button = null;
  }
  if (!button) {
    doc.querySelectorAll(`[${REPO_BUTTON_ATTR}]`).forEach((stale) => stale.closest('li')?.remove());
    const item = buildRepoButton(ul, ref, actions);
    ul.append(item);
    button = item.querySelector<HTMLElement>(`[${REPO_BUTTON_ATTR}]`);
  }
  if (button) updateRepoButton(button, ref, isPinnedKey(key));
  return button;
}
