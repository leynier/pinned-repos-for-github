import { browser } from 'wxt/browser';
import {
  LIMIT_MESSAGE,
  MAX_PINS,
  addPin,
  getPins,
  removePin,
  watchPins,
  type AddPinResult,
  type Pin,
} from './storage/pins';
import { formatRepo, parseRepoRef } from './storage/repo-ref';
import { getSettings, setVisibleCount, watchSettings } from './storage/settings';

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

export function renderPinList(doc: Document, pins: readonly Pin[]): void {
  const list = byId<HTMLUListElement>(doc, 'pin-list');
  const count = byId(doc, 'count');
  count.textContent = `${pins.length} / ${MAX_PINS}`;
  if (pins.length === 0) {
    const empty = doc.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No pins yet. Add one above, or use the 📌 button on GitHub.';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(
    ...pins.map((pin) => {
      const item = doc.createElement('li');
      const avatar = doc.createElement('img');
      avatar.src = `https://github.com/${encodeURIComponent(pin.owner)}.png?size=32`;
      avatar.alt = '';
      if (pin.ownerIsUser) avatar.className = 'user';
      const link = doc.createElement('a');
      link.href = `https://github.com/${pin.owner}/${pin.name}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = formatRepo(pin);
      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Unpin';
      remove.setAttribute('aria-label', `Unpin ${formatRepo(pin)}`);
      remove.addEventListener('click', () => void removePin(pin));
      item.append(avatar, link, remove);
      return item;
    }),
  );
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

  renderPinList(doc, await getPins());
  input.focus();
  const unwatchPins = watchPins((pins) => renderPinList(doc, pins));
  const unwatchSettings = watchSettings((settings) => {
    if (doc.activeElement !== visibleCount) visibleCount.value = String(settings.visibleCount);
  });
  return () => {
    unwatchPins();
    unwatchSettings();
  };
}
