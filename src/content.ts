import { isDashboard, hasRepoHeader, utils } from 'github-url-detection';
import { SECTION_IDS, readRepoMeta } from './dom/anchors';
import { ensurePinnedSection, type SectionActions } from './features/pinned-section';
import { decorateTopRepoItems, type ToggleActions } from './features/top-repo-pin';
import { ensureRepoPinButton, type RepoButtonActions } from './features/repo-pin-button';
import { observePage, type ObserverHandle } from './lib/observe';
import {
  getPins,
  reconcileRepoIdentity,
  removePin,
  togglePin,
  watchPins,
  type Pin,
  type PinExtras,
} from './storage/pins';
import { parseRepoRef, repoKey, type RepoRef } from './storage/repo-ref';

/**
 * Wires storage to the page. Everything DOM-related is idempotent and keyed off the current
 * pins, so `sync` can run as often as GitHub mutates the page.
 */
export async function startContent(doc: Document = document): Promise<() => void> {
  let pins: Pin[] = await getPins();
  let pinnedKeys = new Set(pins.map(repoKey));
  let reconciledUrl = '';
  const isPinnedKey = (key: string) => pinnedKeys.has(key);

  const report = (error: unknown) => {
    // Storage failures (quota, invalidated context) are not fatal to the page.
    console.debug('[Pinned Repos for GitHub]', error);
  };

  const sectionActions: SectionActions = {
    unpin: (pin) => void removePin(pin).catch(report),
  };
  const toggleActions: ToggleActions & RepoButtonActions = {
    toggle: (ref: RepoRef, extras: PinExtras = {}) =>
      void togglePin(ref, extras)
        .then(({ result }) => {
          if (result === 'limit') {
            alert('Pinned Repos for GitHub: you can pin up to 100 repositories. Unpin one first.');
          }
        })
        .catch(report),
  };

  const currentRepo = (): RepoRef | null => {
    const info = utils.getRepositoryInfo();
    return info ? parseRepoRef(info.nameWithOwner) : null;
  };

  const sync = () => {
    const url = new URL(doc.location.href);
    if (isDashboard(url)) {
      ensurePinnedSection('desktop', pins, sectionActions, doc);
      ensurePinnedSection('mobile', pins, sectionActions, doc);
      decorateTopRepoItems(isPinnedKey, toggleActions, doc);
    } else {
      for (const id of Object.values(SECTION_IDS)) doc.getElementById(id)?.remove();
    }

    if (hasRepoHeader(url)) {
      const ref = currentRepo();
      if (!ref) return;
      const repoToggle: RepoButtonActions = {
        toggle: (target) => {
          const meta = readRepoMeta(doc);
          const repoId = meta && repoKey(meta) === repoKey(target) ? meta.repoId : undefined;
          toggleActions.toggle(target, repoId === undefined ? {} : { repoId });
        },
      };
      ensureRepoPinButton(ref, isPinnedKey, repoToggle, doc);
      // Follow renames: the page metadata is trusted only when it matches the URL.
      if (reconciledUrl !== url.pathname) {
        reconciledUrl = url.pathname;
        const meta = readRepoMeta(doc);
        if (meta && repoKey(meta) === repoKey(ref)) void reconcileRepoIdentity(meta).catch(report);
      }
    }
  };

  const handle: ObserverHandle = observePage(sync, doc);
  const unwatch = watchPins((next) => {
    pins = next;
    pinnedKeys = new Set(next.map(repoKey));
    handle.schedule();
  });

  return () => {
    unwatch();
    handle.disconnect();
  };
}
