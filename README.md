# 🌙 tinylog

An absurdly beautiful, local-only baby tracker. One tap to log a feed, diaper, nap, night sleep, tummy time, pump, bath or doctor visit, with lovely ways to see the day.

**Live:** https://parmsam.github.io/tinylog/ (install it: Share → Add to Home Screen)

## Features
- **"When did we last…?" cards.** Tap to log right now. Timed things (nap, night sleep, tummy time, pump) are tap to start, tap to stop, and keep running across reloads.
- **Logging late is normal.** Every log gets a toast with **Undo** and **−5m / −15m / −30m** chips. Hold a card to fill in details first (breast side, bottle amount, pump volume, a note).
- **One day at a time.** Step back through days to fill in or fix entries; a night sleep that crosses midnight shows on both days. Each day has its own note.
- **Night theme.** Dim and warm from 9 PM to 6 AM (or whenever you pick it), with muted colors and calmer animation.
- **Two phones.** Share an export from one phone (AirDrop, Messages) and import it on the other: entries merge, the newest edit wins, and importing twice is harmless.
- **Keyboard:** `F` feed, `W` wet, `D` dirty, `N` nap, `S` night sleep, `T` tummy time, `P` pump, `B` bath, `O` doctor, `←/→` days, `,` settings.
- **Works offline** as an installable PWA.

## Privacy
Everything stays in your browser: IndexedDB, with a second copy in localStorage. No accounts, no servers, no analytics. Export a backup now and then (the app reminds you). On iPhone, add it to your Home Screen: Safari can clear data for sites that aren't installed.

tinylog describes what you logged. It isn't medical advice.

## Development
```sh
npm install
npm run dev        # http://localhost:5173/tinylog/
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end (Playwright: Chromium, WebKit, mobile, PWA)
npm run check      # all of the above + typecheck; run before committing
```
Pushing to `main` runs CI and deploys to GitHub Pages (set Pages → Source to "GitHub Actions").

See [PLAN.md](PLAN.md) for the roadmap and [AGENTS.md](AGENTS.md) for conventions. Sibling project: [pomotimer2](https://github.com/parmsam/pomotimer2).

## License
MIT
