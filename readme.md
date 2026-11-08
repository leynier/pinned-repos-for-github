# 📌 Pinned Repos for GitHub

**Your most important repositories, always one click away on your GitHub home.**

GitHub's home dashboard shows a "Top repositories" list that GitHub picks for you. It shifts around based on recent activity, so the repo you need every day can quietly drop below _Show more_. GitHub doesn't let you pin anything there. This extension does.

Pinned Repos for GitHub adds a **Pinned repositories** section right above _Top repositories_ in the dashboard sidebar. It shows exactly the repositories you choose, sorted alphabetically, every time.

> 🚧 **Status:** in active development. It will be published to the Chrome Web Store soon. Star or watch this repo to get notified.

## Why you'll like it

- **You decide what's on top.** Pin the repos you actually work on, not the ones an algorithm guessed.
- **Feels native.** The section reuses GitHub's own sidebar look, so it fits light and dark themes without looking bolted on.
- **Everywhere you navigate.** Your pins also appear in the ☰ navigation menu on every GitHub page, right above _Top repositories_.
- **Pin from anywhere.** Use the 📌 button that appears when you hover over a _Top repositories_ item, the **Pin** button on any repository page, or type `owner/repo` in the extension popup.
- **Always easy to scan.** Pins are sorted alphabetically by owner and name, so you always know where to look.
- **Scales with you.** Pin up to 500 repositories. The sidebar shows the first 7 (change it in the popup) with _Show more_ for the rest, _Find a repository…_ searches all of them, and the heading collapses the section when you want it out of the way.
- **Stays correct.** Renamed or transferred repositories are followed automatically, and ones that were deleted or that you lost access to are marked, not silently dropped.
- **Yours to keep.** Export your pins and settings as JSON, and import them in any browser, merging or replacing.
- **Synced across your browsers.** Pins are stored with `chrome.storage.sync`, so they follow you to every Chrome (or Edge, or Firefox) where you're signed in.
- **Chrome, Edge and Firefox.** One codebase, built for each browser.
- **No token, no server, no tracking.** It doesn't ask for a GitHub token, doesn't call the GitHub API, and sends your data nowhere. It only talks to `github.com` and only needs permission to run there and to store your pins.
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
  - **Edge:** run `pnpm build:edge` and load `.output/edge-mv3` from `edge://extensions` the same way.
  - **Firefox:** run `pnpm build:firefox`, open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and pick `.output/firefox-mv2/manifest.json`.

## Development

```sh
pnpm dev            # Chrome with the extension and hot reload (separate profile)
pnpm dev:firefox    # the same in Firefox
pnpm test           # unit tests (Vitest)
pnpm e2e            # build and run the Playwright tests against recorded GitHub pages
pnpm lint:firefox   # build for Firefox and lint it with web-ext
pnpm zip            # Chrome Web Store package (zip:firefox and zip:edge for the others)
```

GitHub selectors live in `src/dom/anchors.ts`, and the recorded page structure is in `tests/fixtures`. CI runs every check on pull requests; pushing a `v*` tag that matches `package.json` publishes a GitHub release and submits to each store whose secrets are configured (see `.github/workflows/release.yml`).

## Roadmap

- [x] Pinned repositories section on the GitHub home dashboard
- [x] Pin and unpin from _Top repositories_ and from repository pages
- [x] Alphabetical order
- [x] Import and export your pins as JSON
- [x] Detect renamed and deleted repositories automatically
- [x] Firefox and Edge builds
- [ ] Chrome Web Store release
- [ ] Firefox Add-ons and Edge Add-ons releases

## Contributing

Ideas, bug reports, and pull requests are welcome. If GitHub changes its dashboard and the section stops appearing, please [open an issue](https://github.com/leynier/pinned-repos-for-github/issues).

## Privacy and security

No tracking, no analytics, no servers. Read the [privacy policy](privacy.md). To report a vulnerability, see [security.md](security.md).

## License

[MIT](license.md)

---

Not affiliated with or endorsed by GitHub, Inc. GitHub is a trademark of GitHub, Inc.
