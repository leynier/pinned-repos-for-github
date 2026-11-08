import {
  OWN_ATTR,
  findAllTopRepoItems,
  ownerIsUserFromItem,
  repoRefFromItem,
} from '../dom/anchors';
import { createIcon } from '../lib/icons';
import { formatRepo, repoKey, type RepoRef } from '../storage/repo-ref';
import type { PinExtras } from '../storage/pins';

export const TOGGLE_ATTR = 'data-prg-pin';

export interface ToggleActions {
  toggle(ref: RepoRef, extras: PinExtras): void;
}

function updateToggle(button: HTMLButtonElement, ref: RepoRef, pinned: boolean): void {
  const state = String(pinned);
  if (button.getAttribute('aria-pressed') === state) return;
  button.setAttribute('aria-pressed', state);
  button.setAttribute('aria-label', `${pinned ? 'Unpin' : 'Pin'} ${formatRepo(ref)}`);
  button.title = pinned ? 'Unpin from the top' : 'Pin to the top';
  button.replaceChildren(createIcon(pinned ? 'pin-slash' : 'pin', button.ownerDocument));
}

function buildToggle(item: HTMLLIElement, ref: RepoRef, actions: ToggleActions): HTMLButtonElement {
  const button = item.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'prg-row-button prg-pin-toggle';
  button.setAttribute(OWN_ATTR, 'toggle');
  button.setAttribute(TOGGLE_ATTR, repoKey(ref));
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.toggle(ref, { ownerIsUser: ownerIsUserFromItem(item) });
  });
  return button;
}

/**
 * Adds a pin toggle to every "Top repositories" row (desktop and mobile). Rows added later by
 * "Show more" or the filter get one on the next call; existing toggles only update their state.
 */
export function decorateTopRepoItems(
  isPinnedKey: (key: string) => boolean,
  actions: ToggleActions,
  doc: Document = document,
): number {
  let added = 0;
  for (const item of findAllTopRepoItems(doc)) {
    const ref = repoRefFromItem(item);
    if (!ref) continue;
    let button = item.querySelector<HTMLButtonElement>(`button[${TOGGLE_ATTR}]`);
    if (!button || button.getAttribute(TOGGLE_ATTR) !== repoKey(ref)) {
      button?.remove();
      button = buildToggle(item, ref, actions);
      (item.firstElementChild ?? item).append(button);
      added++;
    }
    updateToggle(button, ref, isPinnedKey(repoKey(ref)));
  }
  return added;
}
