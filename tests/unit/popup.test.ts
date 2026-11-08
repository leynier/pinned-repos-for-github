import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { mountPopup } from '../../src/popup';
import { addPin, getPins } from '../../src/storage/pins';
import { formatRepo } from '../../src/storage/repo-ref';
import { getSettings } from '../../src/storage/settings';

function popupDocument(): Document {
  const html = readFileSync(resolve(process.cwd(), 'entrypoints/popup/index.html'), 'utf8');
  // Only the markup matters here; drop the stylesheet and module script references.
  const body = /<body>([\s\S]*)<\/body>/.exec(html)![1]!.replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = body;
  return document;
}

async function submit(doc: Document, value: string) {
  doc.querySelector<HTMLInputElement>('#repo-input')!.value = value;
  doc.querySelector<HTMLFormElement>('#add-form')!.requestSubmit();
}

const rows = (doc: Document) =>
  [...doc.querySelectorAll('#pin-list li a')].map((a) => a.textContent);

beforeEach(() => fakeBrowser.reset());

describe('popup', () => {
  it('lists pins alphabetically and adds from owner/repo or a URL', async () => {
    await addPin({ owner: 'zeta', name: 'app' });
    const doc = popupDocument();
    const unwatch = await mountPopup(doc);
    expect(rows(doc)).toEqual(['zeta/app']);

    await submit(doc, 'https://github.com/acme/api-server/tree/main');
    await vi.waitFor(() => expect(rows(doc)).toEqual(['acme/api-server', 'zeta/app']));
    expect(doc.querySelector('#count')!.textContent).toBe('2 / 100');
    expect(doc.querySelector('#message')!.textContent).toBe('Pinned acme/api-server.');
    unwatch();
  });

  it('explains invalid and duplicate input', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' });
    const doc = popupDocument();
    const unwatch = await mountPopup(doc);
    await submit(doc, 'not a repo');
    await vi.waitFor(() =>
      expect(doc.querySelector('#message')!.textContent).toMatch(/owner\/repo/),
    );
    await submit(doc, 'Mona/DotFiles');
    await vi.waitFor(() =>
      expect(doc.querySelector('#message')!.textContent).toBe('That repository is already pinned.'),
    );
    unwatch();
  });

  it('unpins from the list', async () => {
    await addPin({ owner: 'mona', name: 'dotfiles' });
    const doc = popupDocument();
    const unwatch = await mountPopup(doc);
    doc.querySelector<HTMLButtonElement>('button[aria-label="Unpin mona/dotfiles"]')!.click();
    await vi.waitFor(async () => expect((await getPins()).map(formatRepo)).toEqual([]));
    await vi.waitFor(() => expect(doc.querySelector('#pin-list')!.textContent).toMatch(/No pins/));
    unwatch();
  });

  it('edits how many pins the sidebar shows', async () => {
    const doc = popupDocument();
    const unwatch = await mountPopup(doc);
    const input = doc.querySelector<HTMLInputElement>('#visible-count')!;
    expect(input.value).toBe('7');
    input.value = '250';
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(async () => expect((await getSettings()).visibleCount).toBe(100));
    await vi.waitFor(() => expect(input.value).toBe('100'));
    unwatch();
  });
});
