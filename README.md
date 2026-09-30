# 🌙 tinylog

An absurdly beautiful, local-only baby tracker. One tap to log a feed, diaper, nap, night sleep, tummy time, pump, fussy spell, bath or doctor visit, with lovely ways to see the day.

**Live:** https://parmsam.github.io/tinylog/ (install it: Share → Add to Home Screen)

## Features
- **"When did we last…?" cards.** Tap to log right now. Timed things (nap, night sleep, tummy time, pump) are tap to start, tap to stop, and keep running across reloads.
- **Logging late is normal.** Every log gets a toast with **Undo** and **−5m / −15m / −30m** chips. Hold a card to fill in details first (breast side, bottle amount, pump volume, a note).
- **One day at a time.** Step back through days to fill in or fix entries; a night sleep that crosses midnight shows on both days. Each day has its own note.
- **Over-engineered charts.** Each day as a 24-hour clock (sleep arcs draw themselves in) or an hour-by-hour grid (dots, ✓ or ✕). In Trends: a day-by-day timeline or a time-of-day heatmap, a week of concentric sleep rings, and a daily totals table.
- **Patterns, not predictions.** Typical nap length, bedtime and wake-up windows, longest stretch, feeds and diapers per day, time between feeds, weekly tummy time and pump output. Each says what it's based on, and waits until there's enough data.
- **Markdown export.** Copy or download any range (or press `M` for today): totals, day notes and every entry. Paste it into Notes or Obsidian, or bring it to a checkup.
- **A little companion.** Puff the cloud, Sadie the mini golden retriever, Moon, Bunny or Duckling. They sip a bottle when you log a feed, doze while the baby sleeps and sigh with relief when a fussy spell ends (Sadie wags). Or turn them off in Settings.
- **Day recap.** A shareable image of any day (clock, totals, longest stretch, your note), or the day as Markdown.
- **Backgrounds.** A soft glow by default, or one of five gentle three.js scenes (night sky, fireflies, bubbles, crib mobile, snow), loaded only if you pick one and slower while the baby sleeps.
- **Bedside display.** A dim, huge "since last feed / awake for" screen that keeps the phone awake.
- **Night theme.** Dim and warm from 9 PM to 6 AM (or whenever you pick it), with muted colors and calmer animation.
- **Two phones.** Share an export from one phone (AirDrop, Messages) and import it on the other: entries merge, the newest edit wins, and importing twice is harmless.
- **Keyboard:** `F` feed, `W` wet, `D` dirty, `N` nap, `S` night sleep, `T` tummy time, `P` pump, `C` fussy, `B` bath, `O` doctor, `U` undo, `←/→` days, `.` today, `G` trends, `A` bedside display, `M` copy today as Markdown, `R` day recap, `,` settings, `?` all shortcuts.
- **Works offline** as an installable PWA.

## Privacy
Everything stays in your browser: IndexedDB, with a second copy in localStorage. No accounts, no servers, no analytics. Export a backup now and then: the app reminds you every 50 new entries, or after a week. On iPhone, add it to your Home Screen: Safari can clear data for sites that aren't installed.

tinylog describes what you logged. It isn't medical advice.

## Development
```sh
npm install
npm run dev        # http://localhost:5173/tinylog/
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end (Playwright: Chromium, WebKit, Android, iPhone layout, PWA)
npm run check      # all of the above + typecheck; run before committing
```
Pushing to `main` runs CI and deploys to GitHub Pages (set Pages → Source to "GitHub Actions").

See [PLAN.md](PLAN.md) for the roadmap and [AGENTS.md](AGENTS.md) for conventions. Sibling project: [pomotimer2](https://github.com/parmsam/pomotimer2).

## License
[MIT](LICENSE) © 2026 Sam Parmar
