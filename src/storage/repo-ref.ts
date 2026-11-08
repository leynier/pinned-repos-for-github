export interface RepoRef {
  owner: string;
  name: string;
}

// GitHub logins: alphanumerics and hyphens, up to 39 chars, no leading hyphen. Kept loose on
// purpose because some legacy accounts have consecutive or trailing hyphens.
const OWNER_PATTERN = /^[a-z\d][a-z\d-]{0,38}$/i;
// Repository names: letters, digits, `.`, `-`, `_`, up to 100 chars.
const NAME_PATTERN = /^[\w.-]{1,100}$/;

// First path segments on github.com that are never repository owners.
const RESERVED_OWNERS = new Set([
  'about',
  'account',
  'apps',
  'codespaces',
  'collections',
  'dashboard',
  'enterprise',
  'events',
  'explore',
  'features',
  'issues',
  'login',
  'logout',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'organizations',
  'pricing',
  'pulls',
  'search',
  'settings',
  'signup',
  'site',
  'sponsors',
  'stars',
  'topics',
  'trending',
  'users',
]);

export function isValidRepoRef(ref: RepoRef): boolean {
  return (
    OWNER_PATTERN.test(ref.owner) &&
    !RESERVED_OWNERS.has(ref.owner.toLowerCase()) &&
    NAME_PATTERN.test(ref.name) &&
    ref.name !== '.' &&
    ref.name !== '..'
  );
}

function fromSegments(owner: string | undefined, name: string | undefined): RepoRef | null {
  if (!owner || !name) return null;
  const ref = { owner, name: name.replace(/\.git$/i, '') };
  return isValidRepoRef(ref) ? ref : null;
}

/**
 * Parses `owner/name`, a github.com URL (any sub-path), a root-relative path
 * (`/owner/name/...`) or an SSH clone URL into a repository reference.
 */
export function parseRepoRef(input: string): RepoRef | null {
  const text = input.trim();
  if (!text) return null;

  const ssh = /^git@github\.com:([^/]+)\/([^/\s]+)$/i.exec(text);
  if (ssh) return fromSegments(ssh[1], ssh[2]);

  let path: string;
  if (/^(https?:\/\/)?(www\.)?github\.com(\/|$)/i.test(text)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      return null;
    }
    path = url.pathname;
  } else if (/^[a-z][a-z\d+.-]*:/i.test(text)) {
    return null; // Some other scheme or host.
  } else {
    path = text.split(/[?#]/)[0] ?? '';
  }

  const segments = path.split('/').filter(Boolean);
  if (!text.startsWith('/') && !/github\.com/i.test(text) && segments.length !== 2) {
    return null; // Bare input must be exactly `owner/name`.
  }
  return fromSegments(segments[0], segments[1]);
}

/** Case-insensitive identity key, because GitHub treats owner and name case-insensitively. */
export function repoKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.name}`.toLowerCase();
}

export function formatRepo(ref: RepoRef): string {
  return `${ref.owner}/${ref.name}`;
}
