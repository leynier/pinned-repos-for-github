import { storage } from 'wxt/utils/storage';
import { parseRepoRef, repoKey, type RepoRef } from './repo-ref';
import { renamePin, type Pin } from './pins';

/**
 * Per-device results of checking that pinned repositories still exist. Kept in `local` storage:
 * the answer depends on this browser's GitHub session, and it changes too often for sync.
 */
export interface HealthEntry {
  checkedAt: number;
  missing: boolean;
}

export type HealthMap = Record<string, HealthEntry>;

export const healthItem = storage.defineItem<HealthMap>('local:pinHealth', { fallback: {} });
export const lastRunItem = storage.defineItem<number>('local:pinHealthLastRun', { fallback: 0 });

export const HOUR = 60 * 60 * 1000;
export const CHECK_INTERVAL = 24 * HOUR;
export const MIN_RUN_GAP = HOUR / 6;
export const MAX_CHECKS_PER_RUN = 20;
export const DELAY_BETWEEN_CHECKS = 1_000;

export type CheckResult =
  { kind: 'ok' } | { kind: 'missing' } | { kind: 'renamed'; to: RepoRef } | { kind: 'unknown' };

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * One same-origin `HEAD` request to the repository page, with the user's session. GitHub answers
 * 200 for an accessible repository, follows a rename or transfer with a redirect, and answers 404
 * when it was deleted or the user lost access (GitHub doesn't distinguish the two).
 */
export async function checkPin(pin: RepoRef, fetchImpl: Fetch): Promise<CheckResult> {
  let response: Response;
  try {
    response = await fetchImpl(`https://github.com/${pin.owner}/${pin.name}`, {
      method: 'HEAD',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { kind: 'unknown' };
  }
  if (response.status === 404 || response.status === 451) return { kind: 'missing' };
  if (!response.ok) return { kind: 'unknown' };
  if (response.redirected) {
    const to = parseRepoRef(new URL(response.url).pathname);
    if (!to) return { kind: 'unknown' }; // Redirected somewhere that isn't a repository (login…).
    if (repoKey(to) !== repoKey(pin)) return { kind: 'renamed', to };
  }
  return { kind: 'ok' };
}

export interface HealthRunOptions {
  pins: readonly Pin[];
  fetchImpl: Fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  shouldStop?: () => boolean;
}

/**
 * Checks the pins whose last check is oldest, at most {@link MAX_CHECKS_PER_RUN} per run, one at a
 * time with a pause in between, and at most one run every {@link MIN_RUN_GAP}. Stops at the first
 * inconclusive answer (rate limit, outage, offline). Returns how many pins were checked.
 */
export async function runHealthCheck({
  pins,
  fetchImpl,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  shouldStop = () => false,
}: HealthRunOptions): Promise<number> {
  if (now() - (await lastRunItem.getValue()) < MIN_RUN_GAP) return 0;
  await lastRunItem.setValue(now());

  const health = await healthItem.getValue();
  const due = pins
    .filter((pin) => now() - (health[repoKey(pin)]?.checkedAt ?? 0) >= CHECK_INTERVAL)
    .sort((a, b) => (health[repoKey(a)]?.checkedAt ?? 0) - (health[repoKey(b)]?.checkedAt ?? 0))
    .slice(0, MAX_CHECKS_PER_RUN);

  let checked = 0;
  for (const pin of due) {
    if (shouldStop()) break;
    if (checked > 0) await sleep(DELAY_BETWEEN_CHECKS);
    const result = await checkPin(pin, fetchImpl);
    if (result.kind === 'unknown') break;
    checked++;
    const current = await healthItem.getValue();
    const next: HealthMap = { ...current };
    if (result.kind === 'renamed') {
      await renamePin(pin, result.to);
      delete next[repoKey(pin)];
      next[repoKey(result.to)] = { checkedAt: now(), missing: false };
    } else {
      next[repoKey(pin)] = { checkedAt: now(), missing: result.kind === 'missing' };
    }
    await healthItem.setValue(next);
  }
  await pruneHealth(pins);
  return checked;
}

/** Drops results for repositories that are no longer pinned. */
export async function pruneHealth(pins: readonly Pin[]): Promise<void> {
  const keys = new Set(pins.map(repoKey));
  const health = await healthItem.getValue();
  const stale = Object.keys(health).filter((key) => !keys.has(key));
  if (stale.length === 0) return;
  const next = { ...health };
  for (const key of stale) delete next[key];
  await healthItem.setValue(next);
}

export function missingKeys(health: HealthMap): Set<string> {
  return new Set(
    Object.entries(health)
      .filter(([, entry]) => entry.missing)
      .map(([key]) => key),
  );
}

export async function getMissingKeys(): Promise<Set<string>> {
  return missingKeys(await healthItem.getValue());
}

export function watchMissingKeys(callback: (keys: Set<string>) => void): () => void {
  return healthItem.watch((value) => callback(missingKeys(value ?? {})));
}
