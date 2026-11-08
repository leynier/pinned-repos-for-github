import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  CHECK_INTERVAL,
  MAX_CHECKS_PER_RUN,
  MIN_RUN_GAP,
  checkPin,
  getMissingKeys,
  healthItem,
  runHealthCheck,
  type Fetch,
} from '../../src/storage/health';
import { addPin, getPins, type Pin } from '../../src/storage/pins';
import { formatRepo } from '../../src/storage/repo-ref';

type Reply = { status: number; redirectedTo?: string } | 'offline';

/** Fake same-origin fetch: maps `/owner/name` to a reply. */
function fakeFetch(replies: Record<string, Reply>, fallback: Reply = { status: 200 }) {
  return vi.fn<Fetch>(async (input) => {
    const path = new URL(input).pathname;
    const reply = replies[path] ?? fallback;
    if (reply === 'offline') throw new TypeError('Failed to fetch');
    const url = reply.redirectedTo ? `https://github.com${reply.redirectedTo}` : input;
    const response = new Response(null, { status: reply.status });
    Object.defineProperty(response, 'redirected', { value: Boolean(reply.redirectedTo) });
    Object.defineProperty(response, 'url', { value: url });
    return response;
  });
}

const noSleep = async () => {};
const names = (pins: Pin[]) => pins.map(formatRepo);

beforeEach(() => fakeBrowser.reset());

describe('checkPin', () => {
  const pin = { owner: 'mona', name: 'old' };

  it.each<[Reply, string]>([
    [{ status: 200 }, 'ok'],
    [{ status: 404 }, 'missing'],
    [{ status: 451 }, 'missing'],
    [{ status: 429 }, 'unknown'],
    [{ status: 500 }, 'unknown'],
    ['offline', 'unknown'],
    [{ status: 200, redirectedTo: '/login?return_to=x' }, 'unknown'],
    [{ status: 200, redirectedTo: '/MONA/OLD' }, 'ok'],
  ])('maps %j to %s', async (reply, kind) => {
    expect((await checkPin(pin, fakeFetch({ '/mona/old': reply }))).kind).toBe(kind);
  });

  it('detects a rename or transfer', async () => {
    const result = await checkPin(
      pin,
      fakeFetch({ '/mona/old': { status: 200, redirectedTo: '/octo-org/new' } }),
    );
    expect(result).toEqual({ kind: 'renamed', to: { owner: 'octo-org', name: 'new' } });
  });

  it('sends a same-origin HEAD request to the repository page', async () => {
    const fetchImpl = fakeFetch({});
    await checkPin(pin, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('https://github.com/mona/old', {
      method: 'HEAD',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });
});

describe('runHealthCheck', () => {
  it('renames moved pins and flags missing ones', async () => {
    await addPin({ owner: 'mona', name: 'old' });
    await addPin({ owner: 'mona', name: 'gone' });
    await addPin({ owner: 'mona', name: 'fine' });
    const fetchImpl = fakeFetch({
      '/mona/old': { status: 200, redirectedTo: '/octo-org/new' },
      '/mona/gone': { status: 404 },
    });
    expect(await runHealthCheck({ pins: await getPins(), fetchImpl, sleep: noSleep })).toBe(3);
    expect(names(await getPins())).toEqual(['mona/fine', 'mona/gone', 'octo-org/new']);
    expect([...(await getMissingKeys())]).toEqual(['mona/gone']);
  });

  it('clears the missing flag when the repository is back', async () => {
    await addPin({ owner: 'mona', name: 'gone' });
    await healthItem.setValue({ 'mona/gone': { checkedAt: 0, missing: true } });
    await runHealthCheck({ pins: await getPins(), fetchImpl: fakeFetch({}), sleep: noSleep });
    expect((await getMissingKeys()).size).toBe(0);
  });

  it('checks at most a few pins per run, oldest first, and respects the run gap', async () => {
    const pins: Pin[] = Array.from({ length: MAX_CHECKS_PER_RUN + 5 }, (_, i) => ({
      owner: 'mona',
      name: `r${i}`,
      addedAt: i,
    }));
    let time = 1_000_000_000;
    const now = () => time;
    await healthItem.setValue({ 'mona/r24': { checkedAt: 1, missing: false } });
    const fetchImpl = fakeFetch({});
    expect(await runHealthCheck({ pins, fetchImpl, now, sleep: noSleep })).toBe(MAX_CHECKS_PER_RUN);
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://github.com/mona/r0');

    // Too soon for another run.
    expect(await runHealthCheck({ pins, fetchImpl, now, sleep: noSleep })).toBe(0);

    // Next run picks up the rest; fresh results are not re-checked.
    time += MIN_RUN_GAP;
    expect(await runHealthCheck({ pins, fetchImpl, now, sleep: noSleep })).toBe(5);
    time += MIN_RUN_GAP;
    expect(await runHealthCheck({ pins, fetchImpl, now, sleep: noSleep })).toBe(0);

    // A day later everything is due again.
    time += CHECK_INTERVAL;
    expect(await runHealthCheck({ pins, fetchImpl, now, sleep: noSleep })).toBe(MAX_CHECKS_PER_RUN);
  });

  it('stops at the first inconclusive answer and pauses between requests', async () => {
    await addPin({ owner: 'a', name: 'one' });
    await addPin({ owner: 'b', name: 'two' });
    await addPin({ owner: 'c', name: 'three' });
    const sleep = vi.fn(noSleep);
    const fetchImpl = fakeFetch({ '/b/two': { status: 429 } });
    expect(await runHealthCheck({ pins: await getPins(), fetchImpl, sleep })).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('forgets results for unpinned repositories', async () => {
    await addPin({ owner: 'mona', name: 'kept' });
    await healthItem.setValue({ 'mona/removed': { checkedAt: 0, missing: true } });
    await runHealthCheck({ pins: await getPins(), fetchImpl: fakeFetch({}), sleep: noSleep });
    expect(Object.keys(await healthItem.getValue())).toEqual(['mona/kept']);
  });
});
