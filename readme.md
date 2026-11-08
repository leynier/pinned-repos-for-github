# 📌 Pinned Repos for GitHub

**Your most important repositories, always one click away on your GitHub home.**

GitHub's home dashboard shows a "Top repositories" list that GitHub picks for you. It shifts around based on recent activity, so the repo you need every day can quietly drop below *Show more*. GitHub doesn't let you pin anything there. This extension does.

Pinned Repos for GitHub adds a **Pinned repositories** section right above *Top repositories* in the dashboard sidebar. It shows exactly the repositories you choose, in the order you choose, every time.

> 🚧 **Status:** in active development. It will be published to the Chrome Web Store soon. Star or watch this repo to get notified.

## Why you'll like it

- **You decide what's on top.** Pin the repos you actually work on, not the ones an algorithm guessed.
- **Feels native.** The section reuses GitHub's own sidebar look, so it fits light and dark themes without looking bolted on.
- **Pin from anywhere.** Use the 📌 button that appears when you hover over a *Top repositories* item, or the **Pin** button on any repository page.
- **Your order, your rules.** Reorder pins so the most important ones stay first.
- **Synced across your browsers.** Pins are stored with `chrome.storage.sync`, so they follow you to every Chrome where you're signed in.
- **No token, no server, no tracking.** It doesn't ask for a GitHub token, doesn't call the GitHub API, and sends your data nowhere. It only needs permission to run on `github.com` and to store your pins.
- **Leaves GitHub alone.** *Top repositories* stays exactly as it is. The extension only adds a section above it.

## How it works

```text
┌──────────────────────────────┐
│ 📌 Pinned repositories       │  ← your picks, your order
│   leynier/alera              │
│   …                          │
├──────────────────────────────┤
│ Top repositories             │  ← GitHub's list, untouched
│   …                          │
└──────────────────────────────┘
```

1. Install the extension.
2. Open [github.com](https://github.com) and hover over any repo in *Top repositories*, or open a repository page.
3. Click 📌 **Pin**. The repository appears in *Pinned repositories* from then on.

## Install

- **Chrome Web Store:** coming soon.
- **From source:** instructions will be added with the first release.

## Roadmap

- [ ] Pinned repositories section on the GitHub home dashboard
- [ ] Pin and unpin from *Top repositories* and from repository pages
- [ ] Reorder pins
- [ ] Import and export your pins as JSON
- [ ] Chrome Web Store release
- [ ] Firefox and Edge builds

## Contributing

Ideas, bug reports, and pull requests are welcome. If GitHub changes its dashboard and the section stops appearing, please [open an issue](https://github.com/leynier/pinned-repos-for-github/issues).

---

Not affiliated with or endorsed by GitHub, Inc. GitHub is a trademark of GitHub, Inc.
