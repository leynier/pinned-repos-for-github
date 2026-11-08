import { fitsQuota, sanitizePins, type Pin } from './storage/pins';
import { parseRepoRef, repoKey } from './storage/repo-ref';
import { sanitizeSettings, type Settings } from './storage/settings';

export const EXPORT_FORMAT = 'pinned-repos-for-github';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  settings: Settings;
  pins: Pin[];
}

export function buildExport(
  pins: readonly Pin[],
  settings: Settings,
  now = new Date(),
): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    settings,
    pins: pins.map((pin) => ({ ...pin })),
  };
}

export function exportFileName(now = new Date()): string {
  return `pinned-repos-for-github-${now.toISOString().slice(0, 10)}.json`;
}

export interface ParsedImport {
  pins: Pin[];
  settings?: Settings;
  /** Entries that were not valid repositories or were duplicates. */
  skipped: number;
}

/**
 * Accepts this extension's export file, a `{ pins: [...] }` object, or a plain JSON array whose
 * items are pin objects or strings (`owner/repo` or GitHub URLs).
 */
export function parseImport(text: string): ParsedImport | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'The file is not valid JSON.' };
  }
  const object = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  const entries = Array.isArray(data)
    ? data
    : Array.isArray((object as { pins?: unknown } | null)?.pins)
      ? ((object as { pins: unknown[] }).pins as unknown[])
      : null;
  if (!entries) return { error: 'No list of repositories found in the file.' };

  const normalized = entries.map((entry) => {
    if (typeof entry !== 'string') return entry;
    const ref = parseRepoRef(entry);
    return ref ? { ...ref, addedAt: 0 } : null;
  });
  const pins = sanitizePins(normalized);
  const result: ParsedImport = { pins, skipped: entries.length - pins.length };
  const settings = (object as { settings?: unknown } | null)?.settings;
  if (settings && typeof settings === 'object') result.settings = sanitizeSettings(settings);
  return result;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportPlan {
  pins: Pin[];
  added: number;
  /** Already pinned (merge only). */
  existing: number;
  fits: boolean;
}

/**
 * Merge keeps current pins and adds the new ones, filling in metadata the current pins lack.
 * Replace uses the imported list as is. Pins without a date get `now`.
 */
export function planImport(
  current: readonly Pin[],
  incoming: readonly Pin[],
  mode: ImportMode,
  now = Date.now(),
): ImportPlan {
  const dated = incoming.map((pin) => (pin.addedAt > 0 ? pin : { ...pin, addedAt: now }));
  if (mode === 'replace') {
    return { pins: dated, added: dated.length, existing: 0, fits: fitsQuota(dated) };
  }
  const byKey = new Map(current.map((pin) => [repoKey(pin), { ...pin }]));
  let added = 0;
  let existing = 0;
  for (const pin of dated) {
    const known = byKey.get(repoKey(pin));
    if (known) {
      existing++;
      known.repoId ??= pin.repoId;
      known.ownerIsUser ??= pin.ownerIsUser;
      if (known.repoId === undefined) delete known.repoId;
      if (known.ownerIsUser === undefined) delete known.ownerIsUser;
    } else {
      added++;
      byKey.set(repoKey(pin), pin);
    }
  }
  const pins = [...byKey.values()];
  return { pins, added, existing, fits: fitsQuota(pins) };
}
