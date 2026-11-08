import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadFixture(name: 'dashboard.html' | 'repo.html' | 'nav-drawer.html'): Document {
  // Vitest runs from the project root; `import.meta.url` is not a file URL under happy-dom.
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures', name), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}
