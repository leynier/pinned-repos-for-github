# Privacy Policy

_Last updated: November 8, 2026_

Pinned Repos for GitHub does not collect, transmit, sell, or share any personal or usage data.

## What the extension stores

The extension stores only the list of repositories you pin (owner, name and, when available, the repository's numeric id and whether its owner is a user or an organization). It uses `chrome.storage.sync`, so the list stays in your browser and, if you have Chrome sync turned on, syncs through your Google account like any other extension setting. The developer never receives it.

## What the extension accesses

- **`github.com` pages:** the extension runs on `https://github.com/*` to add the _Pinned repositories_ section to your home dashboard and the **Pin** buttons to repository pages. It reads the page only to find where to place them and which repository you're viewing.
- **Avatars:** pinned repositories show their owner's avatar, loaded from `https://github.com/{owner}.png`, the same public image GitHub itself shows.

The extension makes no other network requests, has no analytics or tracking, uses no remote code, and doesn't use a GitHub token or the GitHub API.

## Removing your data

Unpin repositories from the extension popup, or uninstall the extension to remove everything it stored.

## Contact

Questions or concerns: [open an issue](https://github.com/leynier/pinned-repos-for-github/issues).
