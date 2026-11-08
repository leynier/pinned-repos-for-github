# Privacy Policy

_Last updated: November 8, 2026_

Pinned Repos for GitHub does not collect, transmit, sell, or share any personal or usage data.

## What the extension stores

The extension stores the list of repositories you pin (owner, name, the date you pinned it and, when available, the repository's numeric id and whether its owner is a user or an organization) and your settings (how many pins the sidebar shows). It uses `chrome.storage.sync`, so they stay in your browser and, if you have Chrome sync turned on, sync through your Google account like any other extension setting. The results of the availability check below are kept only in this browser (`chrome.storage.local`). The developer never receives any of it.

## What the extension accesses

- **`github.com` pages:** the extension runs on `https://github.com/*` to add the _Pinned repositories_ section to your home dashboard and the **Pin** buttons to repository pages. It reads the page only to find where to place them and which repository you're viewing.
- **Avatars:** pinned repositories show their owner's avatar, loaded from `https://github.com/{owner}.png`, the same public image GitHub itself shows.
- **Availability check:** while you're on the GitHub dashboard, the extension checks whether your pinned repositories still exist by requesting each repository's page on `github.com` (a `HEAD` request, with your GitHub session, the same as opening the page). Each pin is checked at most once a day, a few at a time. This lets it follow renamed or transferred repositories and mark ones that were deleted or that you can no longer access.
- **Import and export:** files you import are read locally in the options page; exports are saved to your device. Nothing is uploaded.

The extension makes no other network requests, only talks to `github.com`, has no analytics or tracking, uses no remote code, and doesn't use a GitHub token or the GitHub API.

## Removing your data

Unpin repositories from the extension popup, or uninstall the extension to remove everything it stored.

## Contact

Questions or concerns: [open an issue](https://github.com/leynier/pinned-repos-for-github/issues).
