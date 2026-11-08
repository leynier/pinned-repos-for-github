# Security Policy

## Supported versions

Only the latest version published on the Chrome Web Store, and the `main` branch, receive security fixes.

## Reporting a vulnerability

Please don't open a public issue for security problems. Report them privately through [GitHub's private vulnerability reporting](https://github.com/leynier/pinned-repos-for-github/security/advisories/new) (the **Security** tab → **Report a vulnerability**).

Include what you found, the steps or a proof of concept to reproduce it, the affected version, and the impact you expect. You'll get an acknowledgment within 7 days. Once the issue is confirmed, a fix is released as soon as practical, and you're credited in the advisory unless you prefer otherwise.

## Scope

In scope:

- The extension's code in this repository: the content script, the popup, and how they handle data from GitHub pages and from storage.
- Anything that would let a web page, a repository name, or stored data run script, leak data, or act on the user's behalf through the extension.
- Permissions or network access beyond what [privacy.md](privacy.md) describes.

Out of scope:

- Vulnerabilities in GitHub itself. Report those to [GitHub's bug bounty program](https://bounty.github.com).
- Vulnerabilities in Chrome or in third-party extensions.
- Issues that require a compromised browser profile or physical access to the device.

## Design notes for reviewers

The extension asks only for `storage` and `https://github.com/*`, runs no remote code, only talks to `github.com` (avatars are plain `<img>` loads, and the daily availability check sends same-origin `HEAD` requests to pinned repository pages), and builds its UI with DOM APIs and `textContent` rather than injecting HTML from data.
