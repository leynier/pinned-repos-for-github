import { browser } from 'wxt/browser';
import { isValidRepoRef, repoKey, type RepoRef } from './repo-ref';

export interface Pin extends RepoRef {
  /** Numeric repository id, captured on the repository page. Used to follow renames. */
  repoId?: number;
  /** Whether the owner is a user (round avatar) rather than an organization (square avatar). */
  ownerIsUser?: boolean;
  addedAt: number;
}

export type PinExtras = Pick<Pin, 'repoId' | 'ownerIsUser'>;

export type AddPinResult = 'added' | 'exists' | 'limit' | 'invalid';

/**
 * Storage layout (`chrome.storage.sync`, 8 KB per key, ~100 KB in total):
 *
 * - `pins:index` → `{ v: 2, chunks, rev }`, rewritten on every change so watchers always fire.
 * - `pins:0` … `pins:N` → arrays of compact pins, each chunk kept under {@link CHUNK_BYTES}.
 * - `pins` → the v1 single-key array; migrated to chunks on first read, then removed.
 *
 * All chunks and the index are written in one `set` call, so other tabs never see a half-written
 * list; stale chunks are removed afterwards.
 */
export const INDEX_KEY = 'pins:index';
export const LEGACY_KEY = 'pins';
const CHUNK_PREFIX = 'pins:';
export const CHUNK_BYTES = 7_000;
/** Leaves room for settings and future keys inside the 102,400-byte sync quota. */
export const TOTAL_BYTES = 90_000;
export const MAX_PINS = 500;
export const LIMIT_MESSAGE = `You can pin up to ${MAX_PINS} repositories (fewer with very long names). Unpin one first.`;

interface StoredPin {
  o: string;
  n: string;
  a: number;
  i?: number;
  u?: 0 | 1;
}

interface PinsIndex {
  v: 2;
  chunks: number;
  rev: string;
}

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

/**
 * Accepts full pins (v1 storage, imports) or compact stored pins, and drops malformed entries
 * and case-insensitive duplicates so a corrupted or hand-edited value never breaks rendering.
 */
export function sanitizePins(value: unknown): Pin[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pins: Pin[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const owner = entry.owner ?? entry.o;
    const name = entry.name ?? entry.n;
    const addedAt = entry.addedAt ?? entry.a;
    const repoId = entry.repoId ?? entry.i;
    const ownerIsUser = entry.ownerIsUser ?? (entry.u === undefined ? undefined : entry.u === 1);
    if (typeof owner !== 'string' || typeof name !== 'string') continue;
    const pin: Pin = { owner, name, addedAt: typeof addedAt === 'number' ? addedAt : 0 };
    if (!isValidRepoRef(pin)) continue;
    const key = repoKey(pin);
    if (seen.has(key)) continue;
    seen.add(key);
    if (typeof repoId === 'number' && Number.isSafeInteger(repoId) && repoId > 0) {
      pin.repoId = repoId;
    }
    if (typeof ownerIsUser === 'boolean') pin.ownerIsUser = ownerIsUser;
    pins.push(pin);
  }
  return pins;
}

function toStored(pin: Pin): StoredPin {
  const stored: StoredPin = { o: pin.owner, n: pin.name, a: pin.addedAt };
  if (pin.repoId !== undefined) stored.i = pin.repoId;
  if (pin.ownerIsUser !== undefined) stored.u = pin.ownerIsUser ? 1 : 0;
  return stored;
}

/** Bytes counted by `chrome.storage.sync`: key length plus the JSON of the value (UTF-8). */
export function storedBytes(key: string, value: unknown): number {
  return new TextEncoder().encode(key + JSON.stringify(value)).length;
}

/** Splits pins into chunks that each stay under `maxBytes` once stored. */
export function chunkPins(pins: readonly Pin[], maxBytes = CHUNK_BYTES): StoredPin[][] {
  const chunks: StoredPin[][] = [];
  let current: StoredPin[] = [];
  for (const pin of pins) {
    const stored = toStored(pin);
    const key = `${CHUNK_PREFIX}${chunks.length}`;
    if (current.length > 0 && storedBytes(key, [...current, stored]) > maxBytes) {
      chunks.push(current);
      current = [];
    }
    current.push(stored);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function totalBytes(chunks: StoredPin[][]): number {
  return chunks.reduce(
    (sum, chunk, index) => sum + storedBytes(`${CHUNK_PREFIX}${index}`, chunk),
    0,
  );
}

/** Whether a list of pins fits the pin count and sync quota budget. */
export function fitsQuota(pins: readonly Pin[]): boolean {
  return pins.length <= MAX_PINS && totalBytes(chunkPins(pins)) <= TOTAL_BYTES;
}

function chunkKeys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${CHUNK_PREFIX}${index}`);
}

function isIndex(value: unknown): value is PinsIndex {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as PinsIndex).v === 2 &&
    Number.isInteger((value as PinsIndex).chunks)
  );
}

async function readStored(): Promise<Pin[]> {
  const sync = browser.storage.sync;
  const { [INDEX_KEY]: index, [LEGACY_KEY]: legacy } = await sync.get([INDEX_KEY, LEGACY_KEY]);
  if (!isIndex(index)) {
    if (legacy === undefined) return [];
    const migrated = sanitizePins(legacy);
    await writeStored(migrated);
    return migrated;
  }
  const keys = chunkKeys(index.chunks);
  const values = await sync.get(keys);
  return sanitizePins(keys.flatMap((key) => (Array.isArray(values[key]) ? values[key] : [])));
}

async function writeStored(pins: readonly Pin[]): Promise<void> {
  const sync = browser.storage.sync;
  const { [INDEX_KEY]: previous, [LEGACY_KEY]: legacy } = await sync.get([INDEX_KEY, LEGACY_KEY]);
  const chunks = chunkPins(pins);
  const index: PinsIndex = {
    v: 2,
    chunks: chunks.length,
    rev: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const items: Record<string, unknown> = { [INDEX_KEY]: index };
  chunks.forEach((chunk, i) => (items[`${CHUNK_PREFIX}${i}`] = chunk));
  await sync.set(items);

  const previousCount = isIndex(previous) ? previous.chunks : 0;
  const stale = chunkKeys(previousCount).slice(chunks.length);
  if (legacy !== undefined) stale.push(LEGACY_KEY);
  // Removing costs a write operation (the sync quota allows 120 per minute), so only when needed.
  if (stale.length > 0) await sync.remove(stale);
}

/** Reads, transforms and writes the pins. Returns false (and writes nothing) when `update` does. */
async function updatePins(update: (pins: Pin[]) => Pin[] | false): Promise<boolean> {
  const next = update(await readStored());
  if (next === false) return false;
  await writeStored(sanitizePins(next));
  return true;
}

export async function getPins(): Promise<Pin[]> {
  return sortPins(await readStored());
}

/** Replaces every pin (used by import). The caller checks {@link fitsQuota} first. */
export async function savePins(pins: readonly Pin[]): Promise<void> {
  await writeStored(sanitizePins(pins));
}

export async function addPin(ref: RepoRef, extras: PinExtras = {}): Promise<AddPinResult> {
  if (!isValidRepoRef(ref)) return 'invalid';
  let result: AddPinResult = 'added';
  await updatePins((pins) => {
    const key = repoKey(ref);
    if (pins.some((pin) => repoKey(pin) === key)) return ((result = 'exists'), false);
    const pin: Pin = { owner: ref.owner, name: ref.name, addedAt: Date.now() };
    if (extras.repoId !== undefined) pin.repoId = extras.repoId;
    if (extras.ownerIsUser !== undefined) pin.ownerIsUser = extras.ownerIsUser;
    const next = [...pins, pin];
    if (!fitsQuota(next)) return ((result = 'limit'), false);
    return next;
  });
  return result;
}

export async function removePin(ref: RepoRef): Promise<boolean> {
  const key = repoKey(ref);
  return updatePins((pins) => {
    const next = pins.filter((pin) => repoKey(pin) !== key);
    return next.length === pins.length ? false : next;
  });
}

export async function isPinned(ref: RepoRef): Promise<boolean> {
  const key = repoKey(ref);
  return (await readStored()).some((pin) => repoKey(pin) === key);
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
 * Moves a pin to a new `owner/name` (a rename or transfer GitHub redirected to). When the new name
 * is already pinned, the old pin is simply dropped. Returns true when storage changed.
 */
export async function renamePin(from: RepoRef, to: RepoRef): Promise<boolean> {
  if (!isValidRepoRef(to)) return false;
  const fromKey = repoKey(from);
  return updatePins((pins) => {
    const index = pins.findIndex((pin) => repoKey(pin) === fromKey);
    const current = pins[index];
    if (!current) return false;
    if (current.owner === to.owner && current.name === to.name) return false;
    const next = [...pins];
    next[index] = { ...current, owner: to.owner, name: to.name };
    return next; // `sanitizePins` drops the duplicate if `to` was already pinned.
  });
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
  const key = repoKey(identity);
  return updatePins((pins) => {
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
    return changed ? next : false;
  });
}

/**
 * Fills in `ownerIsUser` for pins that lack it (added from the popup or an import), using what the
 * dashboard shows. `owners` maps a lowercase owner to whether it is a user.
 */
export async function learnOwnerTypes(owners: ReadonlyMap<string, boolean>): Promise<boolean> {
  if (owners.size === 0) return false;
  return updatePins((pins) => {
    let changed = false;
    const next = pins.map((pin) => {
      const isUser = owners.get(pin.owner.toLowerCase());
      if (pin.ownerIsUser !== undefined || isUser === undefined) return pin;
      changed = true;
      return { ...pin, ownerIsUser: isUser };
    });
    return changed ? next : false;
  });
}

/** Calls back with the sorted pins on every change, from any tab, the popup or the options page. */
export function watchPins(callback: (pins: Pin[]) => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area !== 'sync' || !(INDEX_KEY in changes)) return;
    void readStored().then((pins) => callback(sortPins(pins)));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
