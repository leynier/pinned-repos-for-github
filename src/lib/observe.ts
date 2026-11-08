import { OWN_ATTR } from '../dom/anchors';

function isOwnNode(node: Node): boolean {
  return node instanceof Element && node.closest(`[${OWN_ATTR}]`) !== null;
}

/**
 * True when a mutation happened inside our nodes or only inserted our nodes. Removals outside our
 * nodes always count, because that is how a React re-render drops the button we added.
 */
export function isOwnMutation(record: MutationRecord): boolean {
  if (isOwnNode(record.target)) return true;
  return (
    record.removedNodes.length === 0 &&
    record.addedNodes.length > 0 &&
    [...record.addedNodes].every(isOwnNode)
  );
}

export interface ObserverHandle {
  /** Run `sync` on the next animation frame (coalesces bursts of calls). */
  schedule(): void;
  disconnect(): void;
}

/**
 * Runs `sync` whenever GitHub changes the page: lazy fragments (Top repositories loads after
 * `document_idle`), "Show more", the repository filter, Turbo or React soft navigations and React
 * re-renders that drop our nodes. Mutations we cause ourselves are ignored to avoid loops.
 */
export function observePage(sync: () => void, doc: Document = document): ObserverHandle {
  const win = doc.defaultView ?? window;
  let frame = 0;
  const run = () => {
    frame = 0;
    try {
      sync();
    } catch {
      // Fail silently: a GitHub DOM change must never break the page.
    }
  };
  const schedule = () => {
    if (frame === 0) frame = win.requestAnimationFrame(run);
  };

  const observer = new MutationObserver((records) => {
    if (!records.every(isOwnMutation)) schedule();
  });
  observer.observe(doc.body, { childList: true, subtree: true });

  const events = ['turbo:load', 'turbo:render', 'pageshow', 'popstate'] as const;
  for (const name of events) win.addEventListener(name, schedule);
  const navigation = (win as Window & { navigation?: EventTarget }).navigation;
  navigation?.addEventListener('navigatesuccess', schedule);

  schedule();
  return {
    schedule,
    disconnect() {
      observer.disconnect();
      for (const name of events) win.removeEventListener(name, schedule);
      navigation?.removeEventListener('navigatesuccess', schedule);
      if (frame !== 0) win.cancelAnimationFrame(frame);
    },
  };
}
