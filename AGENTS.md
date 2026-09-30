# AGENTS.md

Guidance for AI coding agents working in this repo.

**`PLAN.md` is the living plan.** Read it before starting work. When you finish a task, tick its checklist item; when scope or a key decision changes, update the relevant section and add a dated line to the decisions log.

## Project
Baby tracker: one-tap logging plus beautiful visualizations. Static site on GitHub Pages; no backend. All data stays in the browser.

## Stack
- Vite + TypeScript (strict), **no UI framework**: plain DOM modules.
- anime.js v4 for UI animation; three.js only for optional scenes, always **lazy-loaded** via dynamic `import()`.
- vite-plugin-pwa (`registerType: 'prompt'`, never auto-reload).
- Charts are hand-written SVG.

## Commands
- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` (Vitest, jsdom), `npm run test:e2e` (Playwright)
- `npm run check`: typecheck + unit + e2e; run before every commit

## Conventions
- **Event log is the source of truth.** Never store derived counters; compute from events.
- **Time**: store epoch ms. Ongoing sessions are events without `endAt`; derive elapsed from `Date.now()`. Never count with `setInterval`.
- **Days**: all day bucketing goes through `src/core/days.ts` (respects "day starts at" and DST). Tests run in `America/New_York`.
- **Storage**: only via `src/core/db.ts` (events + day notes: IndexedDB primary, mirrored to localStorage `tinylog:v1:mirror`) and `src/core/settings.ts` (`tinylog:v1:settings`). Wrap every read/write in try/catch; bump the version and add a migration on schema changes. Deletes are soft (`deleted: true`).
- **State**: mutate via `src/core/store.ts`; UI modules subscribe.
- **Night mode**: no bright flashes, no sound by default, reduced animation.
- **Motion**: respect `prefers-reduced-motion`.
- **SVG pivots**: never use pixel `transform-origin` on SVG artwork (Safari bug from pomo). Use `transform-box: fill-box` with percentages, or SVG `transform` attributes.
- **Charts**: series colors are the `--v-*` tokens, validated with the dataviz palette validator (light + dark). Don't add series colors without re-running it. Each series gets its own lane/ring and mark shape; every chart needs a text equivalent (log list or totals table) and `data-tip` tooltips on marks. Geometry lives in `src/viz/geom.ts` (tested, DST-aware).
- **Stats**: descriptive only. Show "based on N days", hide below a minimum, never phrase as advice or prediction.
- **Privacy**: no analytics, no network calls besides fonts. Never commit real logs or the real baby's name; demo data uses a fake baby.
- New behavior needs tests; every bug fix needs a regression test.

## Deployment
Push to `main` → GitHub Actions builds and publishes to GitHub Pages (`base: '/tinylog/'`).
