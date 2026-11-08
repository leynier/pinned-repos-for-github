import { MISSING_TEXT } from '../features/pinned-section';
import { getMissingKeys, watchMissingKeys } from '../storage/health';
import { MAX_PINS, getPins, removePin, watchPins, type Pin } from '../storage/pins';
import { formatRepo, repoKey } from '../storage/repo-ref';

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

export function renderPinList(
  doc: Document,
  pins: readonly Pin[],
  missing: ReadonlySet<string> = new Set(),
): void {
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
      item.append(avatar, link);
      if (missing.has(repoKey(pin))) {
        item.classList.add('missing');
        link.title = MISSING_TEXT;
        const badge = doc.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'Not found';
        badge.title = MISSING_TEXT;
        item.append(badge);
      }
      item.append(remove);
      return item;
    }),
  );
}

/** Renders `#pin-list` and `#count`, and keeps them live. Returns a function that stops watching. */
export async function mountPinList(doc: Document): Promise<() => void> {
  let pins = await getPins();
  let missing = await getMissingKeys();
  renderPinList(doc, pins, missing);
  const unwatchPins = watchPins((next) => renderPinList(doc, (pins = next), missing));
  const unwatchMissing = watchMissingKeys((next) => renderPinList(doc, pins, (missing = next)));
  return () => {
    unwatchPins();
    unwatchMissing();
  };
}
