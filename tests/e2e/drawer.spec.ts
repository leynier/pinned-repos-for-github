import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const drawerHtml = readFileSync(resolve(import.meta.dirname, '../fixtures/nav-drawer.html'), 'utf8')
  .split('<body class="logged-in">')[1]!
  .split('</body>')[0]!;

/** GitHub renders the ☰ drawer into a portal when it opens and removes it when it closes. */
const openDrawer = (page: Page) =>
  page.evaluate((html) => document.body.insertAdjacentHTML('beforeend', html), drawerHtml);
const closeDrawer = (page: Page) =>
  page.evaluate(() => document.getElementById('__primerPortalRoot__')?.remove());

test('lists pinned repositories in the navigation drawer', async ({ page }) => {
  await page.goto('https://github.com/mona/dotfiles');
  await page.locator('button[data-prg-repo-pin]').click();
  await expect(page.locator('button[data-prg-repo-pin]')).toHaveText('Unpin');

  await openDrawer(page);
  const group = page.locator('#pinned-repos-ext-drawer');
  await expect(group.getByRole('heading', { name: 'Pinned repositories' })).toBeVisible();
  await expect(group.getByRole('link', { name: 'mona/dotfiles' })).toHaveAttribute(
    'href',
    '/mona/dotfiles',
  );
  await expect(group.locator('xpath=following-sibling::*[2]')).toContainText('Top repositories');

  // Closing and reopening the drawer brings the group back exactly once.
  await closeDrawer(page);
  await expect(group).toHaveCount(0);
  await openDrawer(page);
  await expect(page.locator('#pinned-repos-ext-drawer')).toHaveCount(1);

  // Unpinning removes the group.
  await page.locator('button[data-prg-repo-pin]').click();
  await expect(page.locator('#pinned-repos-ext-drawer')).toHaveCount(0);
});
