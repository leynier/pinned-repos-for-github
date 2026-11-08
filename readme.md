# 📌 Pinned Repos for GitHub

**Your most important repositories, always one click away on your GitHub home.**

GitHub's home dashboard shows a "Top repositories" list that GitHub picks for you. It shifts around based on recent activity, so the repo you need every day can quietly drop below _Show more_. GitHub doesn't let you pin anything there. This extension does.

Pinned Repos for GitHub adds a **Pinned repositories** section right above _Top repositories_ in the dashboard sidebar. It shows exactly the repositories you choose, sorted alphabetically, every time.

> 🚧 **Status:** in active development. It will be published to the Chrome Web Store soon. Star or watch this repo to get notified.

## Why you'll like it

- **You decide what's on top.** Pin the repos you actually work on, not the ones an algorithm guessed.
- **Feels native.** The section reuses GitHub's own sidebar look, so it fits light and dark themes without looking bolted on.
- **Pin from anywhere.** Use the 📌 button that appears when you hover over a _Top repositories_ item, the **Pin** button on any repository page, or type `owner/repo` in the extension popup.
- **Always easy to scan.** Pins are sorted alphabetically by owner and name, so you always know where to look.
- **Synced across your browsers.** Pins are stored with `chrome.storage.sync`, so they follow you to every Chrome where you're signed in.
- **No token, no server, no tracking.** It doesn't ask for a GitHub token, doesn't call the GitHub API, and sends your data nowhere. It only needs permission to run on `github.com` and to store your pins.
- **Leaves GitHub alone.** _Top repositories_ stays exactly as it is. The extension only adds a section above it.

## How it works

```text
┌──────────────────────────────┐
│ 📌 Pinned repositories       │  ← your picks, A to Z
│   leynier/alera              │
│   …                          │
├──────────────────────────────┤
│ Top repositories             │  ← GitHub's list, untouched
│   …                          │
└──────────────────────────────┘
```

1. Install the extension.
2. Open [github.com](https://github.com) and hover over any repo in _Top repositories_, or open a repository page.
3. Click 📌 **Pin**. The repository appears in _Pinned repositories_ from then on.

## Install

- **Chrome Web Store:** coming soon.
- **From source:**
  1. Install [Node.js](https://nodejs.org) 22+ and [pnpm](https://pnpm.io).
  2. Clone this repository and run `pnpm install && pnpm build`.
  3. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `.output/chrome-mv3` folder.

## Development

```sh
pnpm dev       # Chrome with the extension and hot reload (separate profile)
pnpm test      # unit tests (Vitest)
pnpm e2e       # build and run the Playwright smoke tests against recorded GitHub pages
pnpm zip       # package for the Chrome Web Store
```

GitHub selectors live in `src/dom/anchors.ts`, and the recorded page structure is in `tests/fixtures`.

## Roadmap

- [x] Pinned repositories section on the GitHub home dashboard
- [x] Pin and unpin from _Top repositories_ and from repository pages
- [x] Alphabetical order
- [ ] Import and export your pins as JSON
- [ ] Detect renamed and deleted repositories automatically
- [ ] Chrome Web Store release
- [ ] Firefox and Edge builds

## Contributing

Ideas, bug reports, and pull requests are welcome. If GitHub changes its dashboard and the section stops appearing, please [open an issue](https://github.com/leynier/pinned-repos-for-github/issues).

## Privacy

No tracking, no analytics, no servers. Read the [privacy policy](privacy.md).

---

Not affiliated with or endorsed by GitHub, Inc. GitHub is a trademark of GitHub, Inc.
