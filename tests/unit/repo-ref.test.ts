import { describe, expect, it } from 'vitest';
import { formatRepo, parseRepoRef, repoKey } from '../../src/storage/repo-ref';

describe('parseRepoRef', () => {
  it.each([
    ['mona/dotfiles', 'mona/dotfiles'],
    ['  Mona/Dot.Files  ', 'Mona/Dot.Files'],
    ['mona/dotfiles.git', 'mona/dotfiles'],
    ['https://github.com/mona/dotfiles', 'mona/dotfiles'],
    ['https://github.com/mona/dotfiles/tree/main/src?x=1#L2', 'mona/dotfiles'],
    ['github.com/mona/dotfiles/', 'mona/dotfiles'],
    ['http://www.github.com/octo-org/web_site', 'octo-org/web_site'],
    ['/mona/dotfiles/pulls', 'mona/dotfiles'],
    ['git@github.com:mona/dotfiles.git', 'mona/dotfiles'],
  ])('parses %j', (input, expected) => {
    const ref = parseRepoRef(input);
    expect(ref && formatRepo(ref)).toBe(expected);
  });

  it.each([
    '',
    'mona',
    'mona/dotfiles/extra',
    'https://gitlab.com/mona/dotfiles',
    'https://github.com/mona',
    'https://github.com/orgs/acme/dashboard',
    'https://github.com/settings/profile',
    '-mona/dotfiles',
    'mona/..',
    'mo na/dotfiles',
    'mona/dot files',
    'ftp://github.com/mona/dotfiles',
  ])('rejects %j', (input) => {
    expect(parseRepoRef(input)).toBeNull();
  });
});

describe('repoKey', () => {
  it('is case-insensitive', () => {
    expect(repoKey({ owner: 'Mona', name: 'DotFiles' })).toBe(
      repoKey({ owner: 'mona', name: 'dotfiles' }),
    );
  });
});
