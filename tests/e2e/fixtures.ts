import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, test as base, type BrowserContext } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const extensionPath = resolve(root, '.output/chrome-mv3');
const fixture = (name: string) => readFileSync(resolve(root, 'tests/fixtures', name), 'utf8');

/**
 * Loads the built extension in Chromium and serves the recorded GitHub fixtures for github.com,
 * so the content script runs exactly as on the real site, offline and without a GitHub session.
 */
export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await context.route('https://github.com/**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === '/' || pathname === '/dashboard') {
        return route.fulfill({ contentType: 'text/html', body: fixture('dashboard.html') });
      }
      if (pathname === '/mona/dotfiles') {
        return route.fulfill({ contentType: 'text/html', body: fixture('repo.html') });
      }
      return route.fulfill({ status: 404, body: '' });
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },
});

export const expect = test.expect;
