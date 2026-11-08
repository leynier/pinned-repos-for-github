import { isDashboard, hasRepoHeader, utils } from 'github-url-detection';
import {
  SECTION_IDS,
  findAllTopRepoItems,
  isSignedIn,
  readOwnerTypes,
  readRepoMeta,
} from './dom/anchors';
import { ensurePinnedSection, type SectionActions } from './features/pinned-section';
import { decorateTopRepoItems, type ToggleActions } from './features/top-repo-pin';
import { ensureRepoPinButton, type RepoButtonActions } from './features/repo-pin-button';
import { observePage, type ObserverHandle } from './lib/observe';
import { getMissingKeys, runHealthCheck, watchMissingKeys } from './storage/health';
import {
  getPins,
  learnOwnerTypes,
  reconcileRepoIdentity,
  removePin,
  togglePin,
  watchPins,
  type Pin,
  type PinExtras,
  LIMIT_MESSAGE,
} from './storage/pins';
import { parseRepoRef, repoKey, type RepoRef } from './storage/repo-ref';
import { getSettings, setCollapsed, watchSettings } from './storage/settings';

/**
 * Wires storage to the page. Everything DOM-related is idempotent and keyed off the current
 * pins, so `sync` can run as often as GitHub mutates the page.
 */
export async function startContent(doc: Document = document): Promise<() => void> {
  let pins: Pin[] = await getPins();
  let settings = await getSettings();
  let missing = await getMissingKeys();
  const makeView = () => ({ limit: settings.visibleCount, collapsed: settings.collapsed, missing });
  let view = makeView();
  let healthStarted = false;
  let ownerTypesLearned = false;
  let stopped = false;
  let pinnedKeys = new Set(pins.map(repoKey));
  let reconciledUrl = '';
  const isPinnedKey = (key: string) => pinnedKeys.has(key);

  const report = (error: unknown) => {
    // Storage failures (quota, invalidated context) are not fatal to the page.
    console.debug('[Pinned Repos for GitHub]', error);
  };

  const sectionActions: SectionActions = {
    unpin: (pin) => void removePin(pin).catch(report),
    setCollapsed: (collapsed) => void setCollapsed(collapsed).catch(report),
  };
  const toggleActions: ToggleActions & RepoButtonActions = {
    toggle: (ref: RepoRef, extras: PinExtras = {}) =>
      void togglePin(ref, extras)
        .then(({ result }) => {
          if (result === 'limit') {
            alert(`Pinned Repos for GitHub: ${LIMIT_MESSAGE}`);
          }
        })
        .catch(report),
  };

  const currentRepo = (): RepoRef | null => {
    const info = utils.getRepositoryInfo();
    return info ? parseRepoRef(info.nameWithOwner) : null;
  };

  /** Round avatars for pins added from the popup or an import, using what Top repositories shows. */
  const learnOwnerTypesOnce = () => {
    if (ownerTypesLearned || !pins.some((pin) => pin.ownerIsUser === undefined)) return;
    const owners = readOwnerTypes(findAllTopRepoItems(doc));
    if (owners.size === 0) return;
    ownerTypesLearned = true;
    void learnOwnerTypes(owners).catch(report);
  };

  /** Checks for renamed or deleted pins in the background, a few at a time, once per page load. */
  const startHealthCheckOnce = () => {
    if (healthStarted || pins.length === 0 || !isSignedIn(doc)) return;
    healthStarted = true;
    setTimeout(() => {
      if (stopped) return;
      void runHealthCheck({
        pins,
        fetchImpl: (input, init) => fetch(input, init),
        shouldStop: () => stopped,
      }).catch(report);
    }, 5_000);
  };

  const sync = () => {
    const url = new URL(doc.location.href);
    if (isDashboard(url)) {
      ensurePinnedSection('desktop', pins, view, sectionActions, doc);
      ensurePinnedSection('mobile', pins, view, sectionActions, doc);
      decorateTopRepoItems(isPinnedKey, toggleActions, doc);
      learnOwnerTypesOnce();
      startHealthCheckOnce();
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

  const unwatchSettings = watchSettings((next) => {
    settings = next;
    view = makeView();
    handle.schedule();
  });
  const unwatchMissing = watchMissingKeys((keys) => {
    missing = keys;
    view = makeView();
    handle.schedule();
  });

  return () => {
    stopped = true;
    unwatch();
    unwatchSettings();
    unwatchMissing();
    handle.disconnect();
  };
}
