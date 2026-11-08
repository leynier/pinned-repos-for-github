import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const desktopSection = (page: Page) => page.locator('#pinned-repos-ext');
const pinnedNames = (page: Page, id = 'pinned-repos-ext') =>
  page.locator(`#${id} li.prg-item a.markdown-title`);

async function pinFromTopRepos(page: Page, repo: string) {
  const row = page
    .locator('aside[aria-label="Dashboard menu"] ul.js-dashboard-repos-list > li')
    .filter({ has: page.locator(`a[href="/${repo}"]`) });
  await row.hover();
  await row.locator('button[data-prg-pin]').click();
}

test('adds the pinned section above Top repositories and pins from the list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://github.com/');

  const section = desktopSection(page);
  await expect(section).toBeVisible();
  await expect(section.locator('h2')).toHaveText('Pinned repositories');
  await expect(section).toContainText('Hover a repository below');
  expect(
    await section.evaluate((el) => el.nextElementSibling?.getAttribute('aria-labelledby')),
  ).toBe('dashboard-top-repositories-heading');

  await pinFromTopRepos(page, 'mona/dotfiles');
  await expect(pinnedNames(page)).toHaveText(['mona/dotfiles']);

  // Pinned later, but sorted first.
  await pinFromTopRepos(page, 'acme/api-server');
  await expect(pinnedNames(page)).toHaveText(['acme/api-server', 'mona/dotfiles']);
  await expect(page.locator('#pinned-repos-ext')).toHaveCount(1);
  // Pinned rows only have the unpin button, never a copy of the 📌 toggle.
  await expect(section.locator('button[data-prg-pin]')).toHaveCount(0);
  await expect(section.locator('li.prg-item button')).toHaveCount(2);

  // Unpin from the section row.
  const row = section.locator('li.prg-item').filter({ hasText: 'acme/api-server' });
  await row.hover();
  await row.getByRole('button', { name: 'Unpin acme/api-server' }).click();
  await expect(pinnedNames(page)).toHaveText(['mona/dotfiles']);

  // GitHub's own list is untouched apart from the toggles.
  await expect(page.locator('aside ul.js-dashboard-repos-list > li')).toHaveCount(4);
});

test('filters pins and keeps the native New button', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://github.com/');
  const section = desktopSection(page);
  await expect(section.getByRole('link', { name: 'New' })).toHaveAttribute('href', '/new');
  // Nothing to filter yet.
  await expect(section.locator('input.prg-filter')).toBeHidden();

  for (const repo of ['octo-org/website', 'mona/dotfiles', 'acme/api-server', 'mona/repo10']) {
    await pinFromTopRepos(page, repo);
  }
  await expect(pinnedNames(page)).toHaveText([
    'acme/api-server',
    'mona/dotfiles',
    'mona/repo10',
    'octo-org/website',
  ]);

  const filter = section.getByPlaceholder('Find a repository…');
  await filter.fill('MONA');
  await expect(pinnedNames(page)).toHaveText(['mona/dotfiles', 'mona/repo10']);
  await filter.fill('zzz');
  await expect(section).toContainText('No pinned repositories match.');
  await filter.press('Escape');
  await expect(pinnedNames(page)).toHaveCount(4);
  // With the default limit of 7, four pins need no "Show more".
  await expect(section.locator('button.prg-more')).toBeHidden();
});

test('survives GitHub re-rendering Top repositories', async ({ page }) => {
  await page.goto('https://github.com/dashboard');
  await expect(desktopSection(page)).toBeVisible();

  await page.evaluate(() => {
    const top = document.querySelector('[aria-labelledby="dashboard-top-repositories-heading"]')!;
    const parent = top.parentElement!;
    const fresh = top.cloneNode(true) as Element;
    fresh.querySelectorAll('[data-prg]').forEach((node) => node.remove());
    parent.replaceChildren();
    setTimeout(() => parent.append(fresh), 200);
  });

  await expect(desktopSection(page)).toBeVisible();
  await expect(page.locator('#pinned-repos-ext')).toHaveCount(1);
  await expect(page.locator('aside button[data-prg-pin]')).toHaveCount(4);
});

test('pins from the repository page and shows it on the dashboard', async ({ page }) => {
  await page.goto('https://github.com/mona/dotfiles');
  const actions = page.locator('ul[data-testid="repo-header-actions"]');
  const pin = actions.locator('li:last-child button[data-prg-repo-pin]');
  await expect(pin).toHaveText('Pin');
  await pin.click();
  await expect(pin).toHaveText('Unpin');
  await expect(pin).toHaveAttribute('aria-pressed', 'true');

  await page.goto('https://github.com/');
  await expect(pinnedNames(page)).toHaveText(['mona/dotfiles']);
});

test('shows the section above the mobile copy below 768px', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 });
  await page.goto('https://github.com/');
  const mobile = page.locator('#pinned-repos-ext-mobile');
  await expect(mobile).toBeVisible();
  await expect(mobile.locator('h2')).toHaveText('Pinned Repositories');
  await expect(desktopSection(page)).toBeHidden();
  expect(
    await mobile.evaluate((el) => el.nextElementSibling?.getAttribute('aria-labelledby')),
  ).toBe('dashboard-repositories-nav-heading');
});

test('syncs pins live across tabs', async ({ context, page }) => {
  await page.goto('https://github.com/');
  const other = await context.newPage();
  await other.goto('https://github.com/');
  await expect(desktopSection(other)).toBeVisible();

  await pinFromTopRepos(page, 'octo-org/website');
  await expect(pinnedNames(other)).toHaveText(['octo-org/website']);
});
