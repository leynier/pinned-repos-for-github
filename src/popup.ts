import { browser } from 'wxt/browser';
import { LIMIT_MESSAGE, addPin, type AddPinResult } from './storage/pins';
import { formatRepo, parseRepoRef } from './storage/repo-ref';
import { getSettings, setVisibleCount, watchSettings } from './storage/settings';
import { mountPinList } from './ui/pin-list';

const MESSAGES: Record<Exclude<AddPinResult, 'added'>, string> = {
  exists: 'That repository is already pinned.',
  limit: LIMIT_MESSAGE,
  invalid: 'Enter a repository as owner/repo or paste its GitHub URL.',
};

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function showMessage(doc: Document, text: string, kind: 'error' | 'info' = 'info'): void {
  const message = byId(doc, 'message');
  message.textContent = text;
  message.dataset.kind = kind;
}

export async function mountPopup(doc: Document): Promise<() => void> {
  const form = byId<HTMLFormElement>(doc, 'add-form');
  const input = byId<HTMLInputElement>(doc, 'repo-input');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const ref = parseRepoRef(input.value);
    const result: AddPinResult = ref ? await addPin(ref) : 'invalid';
    if (result === 'added' && ref) {
      input.value = '';
      showMessage(doc, `Pinned ${formatRepo(ref)}.`);
    } else if (result !== 'added') {
      showMessage(doc, MESSAGES[result], 'error');
    }
    input.focus();
  });

  doc
    .getElementById('open-options')
    ?.addEventListener('click', () => void browser.runtime.openOptionsPage());

  const visibleCount = byId<HTMLInputElement>(doc, 'visible-count');
  visibleCount.value = String((await getSettings()).visibleCount);
  visibleCount.addEventListener('change', async () => {
    visibleCount.value = String(await setVisibleCount(visibleCount.value));
  });

  const unwatchPins = await mountPinList(doc);
  input.focus();
  const unwatchSettings = watchSettings((settings) => {
    if (doc.activeElement !== visibleCount) visibleCount.value = String(settings.visibleCount);
  });
  return () => {
    unwatchPins();
    unwatchSettings();
  };
}
