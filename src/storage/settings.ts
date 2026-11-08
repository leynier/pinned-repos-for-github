import { storage } from 'wxt/utils/storage';
import { MAX_PINS } from './pins';

export interface Settings {
  /** Pins shown in the sidebar before "Show more". GitHub shows 7 Top repositories. */
  visibleCount: number;
}

export const DEFAULT_SETTINGS: Settings = { visibleCount: 7 };

export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export function clampVisibleCount(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SETTINGS.visibleCount;
  return Math.min(MAX_PINS, Math.max(1, Math.round(number)));
}

export function sanitizeSettings(value: unknown): Settings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return { visibleCount: clampVisibleCount(raw.visibleCount ?? DEFAULT_SETTINGS.visibleCount) };
}

export async function getSettings(): Promise<Settings> {
  return sanitizeSettings(await settingsItem.getValue());
}

export async function setVisibleCount(value: unknown): Promise<number> {
  const visibleCount = clampVisibleCount(value);
  await settingsItem.setValue({ ...(await getSettings()), visibleCount });
  return visibleCount;
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => callback(sanitizeSettings(value)));
}
