import { readFileSync, writeFileSync } from 'node:fs';
import { expect, extensionId, test } from './fixtures';

test('imports and exports pins from the options page', async ({ context, page }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole('heading', { name: 'Pinned Repos for GitHub' })).toBeVisible();

  const file = test.info().outputPath('import.json');
  writeFileSync(file, JSON.stringify(['zeta/app', 'https://github.com/acme/api', 'not a repo']));
  await options.getByLabel('JSON file').setInputFiles(file);
  await options.getByRole('button', { name: 'Import' }).click();
  await expect(options.getByRole('status')).toHaveText(
    'Added 2 pins. 1 skipped (invalid or duplicate).',
  );
  await expect(options.locator('#pin-list li a')).toHaveText(['acme/api', 'zeta/app']);

  // The dashboard picks up imported pins.
  await page.goto('https://github.com/');
  await expect(page.locator('#pinned-repos-ext li.prg-item a.markdown-title')).toHaveText([
    'acme/api',
    'zeta/app',
  ]);

  const [download] = await Promise.all([
    options.waitForEvent('download'),
    options.getByRole('button', { name: 'Export pins' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^pinned-repos-for-github-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(exported.pins.map((p: { owner: string; name: string }) => `${p.owner}/${p.name}`)).toEqual(
    ['acme/api', 'zeta/app'],
  );
});
