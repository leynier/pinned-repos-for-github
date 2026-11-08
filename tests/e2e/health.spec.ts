import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, extensionId, test } from './fixtures';

// Renames are covered by unit tests: Playwright does not route the request that follows a
// fulfilled redirect, so it would reach the real github.com.
test('flags pinned repositories that no longer exist, in the background', async ({
  context,
  page,
}) => {
  test.setTimeout(30_000);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const file = join(tmpdir(), `prg-health-${process.pid}.json`);
  writeFileSync(file, JSON.stringify(['mona/dotfiles', 'acme/deleted-repo']));
  await options.getByLabel('JSON file').setInputFiles(file);
  await options.getByRole('button', { name: 'Import' }).click();
  await expect(options.getByRole('status')).toHaveText('Added 2 pins.');

  // The check starts 5 s after the dashboard loads.
  await page.goto('https://github.com/');
  const names = page.locator('#pinned-repos-ext li.prg-item a.markdown-title');
  await expect(names).toHaveText(['acme/deleted-repo', 'mona/dotfiles']);
  await expect(page.locator('#pinned-repos-ext li.prg-missing')).toHaveText(/acme\/deleted-repo/, {
    timeout: 15_000,
  });

  // The popup and options lists show it too.
  await expect(options.locator('#pin-list li.missing .badge')).toHaveText('Not found');
});
