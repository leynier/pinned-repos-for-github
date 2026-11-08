import { getPins, savePins } from './storage/pins';
import { mountPinList } from './ui/pin-list';
import { getSettings, setVisibleCount, settingsItem, watchSettings } from './storage/settings';
import { buildExport, exportFileName, parseImport, planImport, type ImportMode } from './transfer';

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function plural(count: number, word: string, many = `${word}s`): string {
  return `${count} ${count === 1 ? word : many}`;
}

/** Imports a JSON file into storage and returns a message for the user. */
export async function importText(
  text: string,
  mode: ImportMode,
): Promise<{ ok: boolean; message: string }> {
  const parsed = parseImport(text);
  if ('error' in parsed) return { ok: false, message: parsed.error };
  if (parsed.pins.length === 0)
    return { ok: false, message: 'The file has no valid repositories.' };

  const plan = planImport(await getPins(), parsed.pins, mode);
  if (!plan.fits) {
    return {
      ok: false,
      message: `That would be ${plural(plan.pins.length, 'pin')}, more than sync storage allows. Nothing was imported.`,
    };
  }
  await savePins(plan.pins);
  if (mode === 'replace' && parsed.settings) await settingsItem.setValue(parsed.settings);

  const parts =
    mode === 'replace'
      ? [`Replaced your pins with ${plural(plan.added, 'repository', 'repositories')}.`]
      : [`Added ${plural(plan.added, 'pin')}.`];
  if (plan.existing) parts.push(`${plan.existing} already pinned.`);
  if (parsed.skipped) parts.push(`${parsed.skipped} skipped (invalid or duplicate).`);
  return { ok: true, message: parts.join(' ') };
}

export async function mountOptions(doc: Document): Promise<() => void> {
  const visibleCount = byId<HTMLInputElement>(doc, 'visible-count');
  const message = byId(doc, 'transfer-message');
  const show = (text: string, ok = true) => {
    message.textContent = text;
    message.dataset.kind = ok ? 'info' : 'error';
  };

  visibleCount.value = String((await getSettings()).visibleCount);
  visibleCount.addEventListener('change', async () => {
    visibleCount.value = String(await setVisibleCount(visibleCount.value));
  });

  byId(doc, 'export-button').addEventListener('click', async () => {
    const data = buildExport(await getPins(), await getSettings());
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' }),
    );
    const link = doc.createElement('a');
    link.href = url;
    link.download = exportFileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    show(`Exported ${plural(data.pins.length, 'pin')}.`);
  });

  const form = byId<HTMLFormElement>(doc, 'import-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = byId<HTMLInputElement>(doc, 'import-file').files?.[0];
    if (!file) return show('Choose a JSON file first.', false);
    const mode = (new FormData(form).get('mode') === 'replace' ? 'replace' : 'merge') as ImportMode;
    const result = await importText(await file.text(), mode);
    show(result.message, result.ok);
    if (result.ok) form.reset();
  });

  const unwatchPins = await mountPinList(doc);
  const unwatchSettings = watchSettings((settings) => {
    if (doc.activeElement !== visibleCount) visibleCount.value = String(settings.visibleCount);
  });
  return () => {
    unwatchPins();
    unwatchSettings();
  };
}
