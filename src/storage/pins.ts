import { storage } from 'wxt/utils/storage';
import { isValidRepoRef, repoKey, type RepoRef } from './repo-ref';

export interface Pin extends RepoRef {
  /** Numeric repository id, captured on the repository page. Used to follow renames. */
  repoId?: number;
  /** Whether the owner is a user (round avatar) rather than an organization (square avatar). */
  ownerIsUser?: boolean;
  addedAt: number;
  /** Reserved for v2: the repository could not be reached. */
  missing?: boolean;
}

export type PinExtras = Pick<Pin, 'repoId' | 'ownerIsUser'>;

export type AddPinResult = 'added' | 'exists' | 'limit' | 'invalid';

/**
 * `chrome.storage.sync` allows 8 KB per key. One compact array of pins fits about 100 entries,
 * so the list is capped until chunking lands.
 */
export const MAX_PINS = 100;

export const pinsItem = storage.defineItem<Pin[]>('sync:pins', {
  fallback: [],
  version: 1,
});

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * Alphabetical by owner, then by name (case-insensitive, natural numbers). Comparing the joined
 * `owner/name` string instead would let `mona-x/*` interleave with `mona/*`, because collation
 * orders `-` before `/`.
 */
export function comparePins(a: RepoRef, b: RepoRef): number {
  return (
    collator.compare(a.owner, b.owner) ||
    collator.compare(a.name, b.name) ||
    repoKey(a).localeCompare(repoKey(b))
  );
}

/** Pins are always shown alphabetically by `owner/name`, regardless of storage order. */
export function sortPins<T extends RepoRef>(pins: readonly T[]): T[] {
  return [...pins].sort(comparePins);
}

/** Drops malformed entries and duplicates so a corrupted or hand-edited value never breaks rendering. */
export function sanitizePins(value: unknown): Pin[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pins: Pin[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const { owner, name, repoId, ownerIsUser, addedAt, missing } = raw as Record<string, unknown>;
    if (typeof owner !== 'string' || typeof name !== 'string') continue;
    const pin: Pin = { owner, name, addedAt: typeof addedAt === 'number' ? addedAt : 0 };
    if (!isValidRepoRef(pin)) continue;
    const key = repoKey(pin);
    if (seen.has(key)) continue;
    seen.add(key);
    if (typeof repoId === 'number' && Number.isSafeInteger(repoId)) pin.repoId = repoId;
    if (typeof ownerIsUser === 'boolean') pin.ownerIsUser = ownerIsUser;
    if (missing === true) pin.missing = true;
    pins.push(pin);
  }
  return pins;
}

export async function getPins(): Promise<Pin[]> {
  return sortPins(sanitizePins(await pinsItem.getValue()));
}

export async function addPin(ref: RepoRef, extras: PinExtras = {}): Promise<AddPinResult> {
  if (!isValidRepoRef(ref)) return 'invalid';
  const pins = sanitizePins(await pinsItem.getValue());
  const key = repoKey(ref);
  if (pins.some((pin) => repoKey(pin) === key)) return 'exists';
  if (pins.length >= MAX_PINS) return 'limit';
  const pin: Pin = { owner: ref.owner, name: ref.name, addedAt: Date.now() };
  if (extras.repoId !== undefined) pin.repoId = extras.repoId;
  if (extras.ownerIsUser !== undefined) pin.ownerIsUser = extras.ownerIsUser;
  await pinsItem.setValue([...pins, pin]);
  return 'added';
}

export async function removePin(ref: RepoRef): Promise<boolean> {
  const pins = sanitizePins(await pinsItem.getValue());
  const key = repoKey(ref);
  const next = pins.filter((pin) => repoKey(pin) !== key);
  if (next.length === pins.length) return false;
  await pinsItem.setValue(next);
  return true;
}

export async function isPinned(ref: RepoRef): Promise<boolean> {
  const key = repoKey(ref);
  return sanitizePins(await pinsItem.getValue()).some((pin) => repoKey(pin) === key);
}

/** Pins or unpins and returns the resulting state, or the add failure reason. */
export async function togglePin(
  ref: RepoRef,
  extras: PinExtras = {},
): Promise<{ pinned: boolean; result?: AddPinResult }> {
  if (await removePin(ref)) return { pinned: false };
  const result = await addPin(ref, extras);
  return { pinned: result === 'added' || result === 'exists', result };
}

/**
 * Keeps pins correct across renames and transfers. Called on a repository page whose canonical
 * `owner/name` and numeric id are known: a pin with the same id but an old name is renamed, and a
 * pin with the same name but no id learns its id. Returns true when storage changed.
 */
export async function reconcileRepoIdentity(
  identity: RepoRef & { repoId: number },
): Promise<boolean> {
  if (!isValidRepoRef(identity)) return false;
  const pins = sanitizePins(await pinsItem.getValue());
  const key = repoKey(identity);
  let changed = false;
  const next = pins.map((pin) => {
    if (
      pin.repoId === identity.repoId &&
      (pin.owner !== identity.owner || pin.name !== identity.name)
    ) {
      changed = true;
      return { ...pin, owner: identity.owner, name: identity.name };
    }
    if (pin.repoId === undefined && repoKey(pin) === key) {
      changed = true;
      return { ...pin, repoId: identity.repoId };
    }
    return pin;
  });
  if (!changed) return false;
  await pinsItem.setValue(sanitizePins(next));
  return true;
}

/** Calls back with the sorted pins on every change, from any tab or the popup. */
export function watchPins(callback: (pins: Pin[]) => void): () => void {
  return pinsItem.watch((value) => callback(sortPins(sanitizePins(value))));
}
