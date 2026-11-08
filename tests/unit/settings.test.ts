import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  clampVisibleCount,
  getSettings,
  sanitizeSettings,
  setVisibleCount,
} from '../../src/storage/settings';

beforeEach(() => fakeBrowser.reset());

describe('settings', () => {
  it('defaults to 7 visible pins, like Top repositories', async () => {
    expect(await getSettings()).toEqual({ visibleCount: 7 });
  });

  it('clamps the visible count to 1..500', () => {
    expect(clampVisibleCount(0)).toBe(1);
    expect(clampVisibleCount('12')).toBe(12);
    expect(clampVisibleCount(4.6)).toBe(5);
    expect(clampVisibleCount(1000)).toBe(500);
    expect(clampVisibleCount('abc')).toBe(7);
    expect(sanitizeSettings(null)).toEqual({ visibleCount: 7 });
  });

  it('stores the visible count in sync storage', async () => {
    expect(await setVisibleCount(3)).toBe(3);
    expect(await getSettings()).toEqual({ visibleCount: 3 });
    expect((await fakeBrowser.storage.sync.get('settings')).settings).toEqual({ visibleCount: 3 });
  });
});
