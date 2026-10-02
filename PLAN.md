# tinylog — Plan

An absurdly beautiful baby tracker. One tap to log a feed, diaper, nap, sleep, tummy time, pump, bath or doctor visit; an over-engineered, lovely way to see the day.
Static site on GitHub Pages, installable PWA, **all data stays on the device**.

Sibling project to [pomotimer2](https://github.com/parmsam/pomotimer2): same stack, conventions and "pomo aesthetic", reused wherever it fits.

## Principles
1. **One tap, one hand, 3 AM.** The home screen is big buttons. Logging never needs a form. Everything else is optional detail you can add later.
2. **Logging late is normal.** Most entries happen after the fact ("she ate at 3:10, I'm logging at 3:25"), so adjusting the time is one gesture, not a dialog.
3. **Night-safe.** Dim, warm, low-contrast night mode; no bright flashes or loud sounds after dark. Animations calm down at night.
4. **Patterns, not predictions.** Show what happened (averages, windows, totals). Never say what *should* happen or give medical guidance. A short "not medical advice" note lives in About.
5. **Private by design.** No backend, no analytics, no accounts. The baby's name and data never leave the browser unless you export them.

## Stack
- Vite + TypeScript (strict), no UI framework, plain DOM modules (same as pomo)
- anime.js v4 for all UI motion (card taps, SVG arc drawing, character, transitions)
- three.js only for optional, lazy-loaded scenes (e.g. a night-sky backdrop for the day recap)
- SVG for all charts, hand-written (radial clock, arcs, sparklines). No chart library unless one earns its bundle size
- vite-plugin-pwa (`registerType: 'prompt'`, never auto-reload mid-timer)
- Vitest (jsdom, `TZ=America/New_York` for DST) + Playwright (Chromium, WebKit, mobile)
- GitHub Actions: CI on every push, deploy to Pages (`base: '/tinylog/'`) only when it passes

## Core technical decisions
1. **Event log is the source of truth.** Everything (cards, timeline, stats, recap) is derived from one list of events; no separate counters to drift (the pomo streak lesson).
   ```ts
   type EventType = 'feed' | 'diaper' | 'sleep' | 'tummy' | 'pump' | 'bath' | 'doctor' | 'note'
   interface LogEvent {
     id: string            // crypto.randomUUID()
     type: EventType
     at: number            // epoch ms, start time
     endAt?: number        // sleep / tummy / pump; undefined while ongoing
     detail?: {            // all optional, never required to log
       method?: 'breast' | 'bottle'           // feed
       side?: 'L' | 'R' | 'both'              // breast feed, pump
       milk?: 'breast' | 'formula'            // bottle
       amount?: number                         // ml (bottle, pump); displayed in the user's unit
       diaper?: 'wet' | 'dirty' | 'both'
       sleep?: 'nap' | 'night'
       note?: string                           // any event, and the whole of a doctor visit
     }
     createdAt: number     // when it was logged
     updatedAt: number     // last-write-wins when merging two phones' exports
     deleted?: boolean     // soft delete, so undo and merging work
   }
   interface DayNote { day: string /* YYYY-MM-DD */; text: string; updatedAt: number }
   ```
2. **Ongoing things are timestamps, not timers.** A running sleep or tummy-time session is just an event with `at` and no `endAt`; the UI derives "asleep 42m" from `Date.now()` in rAF. Survives reload, background tabs and phone lock (pomo's `endsAt` rule).
3. **Storage: IndexedDB is primary** (events + day notes), **mirrored to localStorage** as a second on-device copy (`tinylog:v1:mirror`); settings live in localStorage. On load, if IndexedDB is empty or unavailable (private mode, eviction, a bug) but the mirror has data, the app restores from it. A few years of logs is well under localStorage's ~5 MB; if the mirror ever fails to write, the app says so and suggests an export. JSON export/import is the backup. Cloud sync (e.g. iCloud) is a later, optional feature. All access goes through `core/db.ts` / `core/settings.ts`, versioned, with migrations.
4. **Two phones, no server (for now).** Each phone keeps its own log. "Share with partner" sends a JSON export through the share sheet (AirDrop, Messages); importing it on the other phone **merges** by event `id`, newest `updatedAt` wins, deletes included. Importing the same file twice is harmless.
5. **Data durability is a first-class feature.** Local-only means the browser *is* the database:
   - Call `navigator.storage.persist()` on first log.
   - **iOS Safari can evict data for sites not used in ~7 days unless installed to the home screen.** Nudge to install (one-time tip), and show the storage status in Settings.
   - Automatic backup reminder (e.g. weekly) with one-tap JSON export; JSON import merges by `id`.
6. **Days are local days, with a configurable "day starts at".** The radial clock is midnight-at-top, but the recap and daily stats can use e.g. 7 AM → 7 AM so a night isn't split in half. All bucketing lives in one tested module (DST-aware).
7. **Units and formats are settings**: ml/oz, 12h/24h, week start.
8. **Accessibility**: every visualization has a text equivalent (a list or table the screen reader gets); `prefers-reduced-motion` disables three.js and big animations; keyboard shortcuts for everything.

## Home screen: the day view
The input view is **one day at a time**: ‹ Today › with arrows (and swipe/keys) to step back through days. Today is where almost all logging happens; past days are for fixing and filling in.

```
‹  Today · Wed Sep 30  ›                      ⚙

🍼 Feed          1h 38m ago · 8:32 · L breast
💧 Wet           42m ago
💩 Dirty         3h 11m ago
😴 Nap           awake 54m          [tap: start]
🌙 Night sleep   last: 7h 10m
🤸 Tummy time    today 12m
🫗 Pump          4h ago · 120 ml
🛁 Bath          2 days ago
🩺 Doctor        in 3 days · 2-month checkup

Today's log                      (timeline, newest first; tap to edit)
📝 Day note: "first real smile at the park"
```

- **Tap** a card = log it now. A toast appears with **Undo** and quick time chips (**−5m −15m −30m · pick time**) so late logging is one more tap.
- **Timed types** (nap, night sleep, tummy, pump) toggle: tap to start, tap again to end (ending a pump asks side and volume, both skippable). The card shows a live elapsed timer and a gentle breathing animation while running.
- **Long press** = open the detail sheet first (side, amount, time, note) instead of logging instantly.
- **The day's log** lists every entry for the selected day; tap one to edit time, end time, details or delete it. Sleeps that cross midnight show on both days.
- **Past days**: cards show that day's counts and tapping one opens the sheet with the time to fill in (it never logs "now" on a past day). Editing old entries is always possible.
- **Day note**: a free-text note per day for anything special.
- **Doctor visits** can be in the future; the card shows "in 3 days" until then.
- Card order and which cards appear are configurable; the feed card hints which breast side is next.
- Ambient mode (later): when idle, the page can dim to a big "last feed / awake for" display, readable from across the room, with Wake Lock optional.

## Visualizations (the over-engineered part)
- **24-hour radial clock**: today's events around a circle. Sleep = thick arcs, feeds = dots/ticks (sized by amount if known), diapers = small glyphs. "Now" hand sweeps slowly. Arcs draw in with anime.js on load.
- **Week of rings**: 7 concentric 24h rings (today outermost), so sleep patterns line up visually as the week goes on. Tap a ring = that day.
- **Day strip**: a horizontal 24h bar per day, stacked for 2–4 weeks (the classic "sleep log" chart), as the precise, accessible alternative to the rings.
- **Feeding streaks & intervals**: a spark-strip of gaps between feeds for today.
- **Tummy-time meter**: daily progress toward an optional goal; weekly totals.
- Charts use five validated series colors (feed, sleep, tummy, diaper, pump; checked with the dataviz palette validator in light and dark). Sleep/diaper and tummy/pump are too close to share a lane, so every chart gives each series its own lane or ring plus a distinct mark shape. Bath and doctor appear as emoji markers. Every chart has a text equivalent (the day log, or the daily totals table).

## Patterns (lightweight analytics)
Descriptive only, computed from the log, each with "based on N days" shown. Hidden until there's enough data (e.g. ≥3 days); never phrased as advice.
- Average nap length, naps per day, and longest stretch of night sleep
- Common bedtime window (e.g. the middle 50% of "last sleep start before night")
- Feed intervals: average and typical range, today vs. last 7 days
- Feeds and diapers per day (7-day)
- "Fussier parts of the day": from the 😣 Fussy card (logged, not derived), shown as the busiest 3-hour window
- Weekly tummy-time totals
- Pump output per day and per side
- All time windows respect "day starts at" and the 7/14/30-day selector

## "<name>'s day" recap (later)
An end-of-day card, animated and shareable-as-image (on device): the day's radial clock, totals (feeds, diapers, sleep hours, tummy time), longest sleep, a small highlight ("first 4h stretch!"), and the character. Optional three.js night-sky scene behind it, lazy-loaded. Export as PNG or Markdown.

## The character
A little companion that reacts as you log, like pomo's Tamagotchi / Plant / Robot faces: yawns and curls up when sleep starts, sips a tiny bottle on a feed, wiggles on tummy time, winces-then-smiles on a dirty diaper. It's decoration, never a status indicator (it doesn't look sad if you "missed" something). Faces are swappable modules like pomo's `src/faces`.

## Structure
```
src/
  core/    types.ts, store.ts, storage.ts (IndexedDB + settings), events.ts (log/edit/undo),
           days.ts (day bucketing, DST), stats.ts, markdown.ts, backup.ts, format.ts, units.ts
  ui/      cards.ts, toast.ts, eventSheet.ts, history.ts, settings.ts, ambient.ts, shortcuts.ts
  viz/     radialClock.ts, weekRings.ts, dayStrip.ts, sparks.ts
  faces/   companion characters (swappable)
  fx/      anims.ts, scenes/ (three.js, lazy)
  themes/  tokens.css, presets.ts (day / dusk / night)
public/
.github/workflows/ci.yml, deploy.yml
```

## Phases & status
Keep this checklist current: tick items as they land, add new ones as scope changes.

### Phase 0 — Scaffold
- [x] Vite + TS + Vitest + Playwright, copying pomo's config patterns (TZ in tests, e2e helpers that seed state and fail on page errors)
- [x] CI + GitHub Pages deploy workflow
- [x] AGENTS.md, README skeleton, MIT license

### Phase 1 — Day view MVP
- [x] Event model, IndexedDB storage, store, soft delete
- [x] Cards: feed (breast/bottle), wet, dirty, nap, night sleep, tummy time, pump, bath, doctor
- [x] Tap to log, Undo toast with −5/−15/−30m and pick-time; long press opens the sheet first
- [x] Timed events (nap, night, tummy, pump) with live elapsed display that survives reload
- [x] Detail sheet: edit type-specific details, start/end time, note, delete
- [x] Day navigation (‹ ›, keys), day log list, add/edit entries on past days
- [x] Day note per day
- [x] Settings: baby name, ml/oz, 12/24h, day start
- [x] Night mode (auto by time or manual), light/dark themes
- [x] JSON export/import that merges (last write wins), "Share with partner" via the share sheet
- [x] `storage.persist()`, backup reminder (every 50 new entries, or weekly), storage status in settings
- [x] PWA: offline, installable, update prompt, iOS "install to keep your data" tip
- [x] First deploy

### Phase 2 — Timeline & keyboard
- [x] 24h radial clock for today, with anime.js arc drawing and "now" hand
- [x] Day view: scroll back through days (radial + list)
- [x] Day strip chart (multi-day)
- [x] Week of rings
- [x] Day view: Clock | Grid toggle on the main page. Grid = hour rows × category columns for the selected day, position in a cell = minute; marks as dots, ✓ or ✕ (Settings → Grid marks)
- [x] One-time tips (welcome, iPhone install, two phones) with Settings → Show tips again
- [x] Heatmap view (Trends → Timeline | Heatmap): rows are hours of the day, columns are feeds, wet, dirty, sleep, tummy, pump; darker = more often at that hour over the range
- [x] Markdown export (per-day headings, events with times, daily totals), copy + download
- [x] Keyboard shortcuts (`F` feed, `W` wet, `D` dirty, `N` nap, `S` night sleep, `T` tummy, `P` pump, `B` bath, `←/→` days, `U` undo, `?` cheat sheet, `.` today, `G` trends, `A` bedside, `M` copy today as Markdown, `?` cheat sheet). Cmd/Ctrl+K palette: backburner
- [x] Ambient "last event" display with optional Wake Lock

### Phase 3 — Patterns
- [x] Stats module with minimum-data thresholds and "based on N days"
- [x] Nap length, night stretch, bedtime window, feed intervals, daily counts, weekly tummy time, pump output
- [x] Fussy is a quick-tag: a 😣 Fussy card (tap to start, tap to stop, key `C`), with its own heatmap/grid column, clock lane, totals column and a "most often 4–7 PM" pattern tile
- [x] Patterns section at the top of Trends, sharing its 7/14/28-day selector

### Phase 4 — Delight
- [x] Companion character reacting to logs (one face first): Puff, a little cloud (`src/companion/cloud.ts`)
- [x] "<name>'s day" recap card (✨ Recap / `R`), PNG via Canvas 2D + Markdown copy, share sheet where supported
- [x] Optional three.js night sky (Settings → Background): lazy chunk, ~30 fps, paused when hidden, a still frame under reduced motion, falls back to the glow without WebGL
- [x] Haptics (pomo's module as-is: `navigator.vibrate` on Android, the iOS switch trick on iPhone), Settings toggle on touch devices

#### More background scenes
Settings → Background is a picker with small static previews: Glow (default), five three.js scenes, and Plain. Each scene is a lazy module in `src/fx/scenes/` (pomotimer2's `Scene` interface) sharing one three.js chunk: ~30 fps, paused when hidden, a still frame under reduced motion, glow fallback without WebGL, dimmer in the night theme.
- [x] Scene registry (`src/fx/scenes/index.ts`, like pomo's) with the night sky moved into it; picker with previews
- [x] **Night sky**: twinkling stars and the odd shooting star
- [x] **Fireflies**: warm drifting points that pulse softly (ported from pomotimer2)
- [x] **Bubbles**: slow rising bath bubbles with an iridescent rim
- [x] **Crib mobile**: paper moon, stars, cloud and heart turning slowly at the top of the screen
- [x] **Snow**: light flakes at different depths
- [x] Scenes follow the day, gently: slower while the baby is sleeping, a soft pulse when something is logged
- Tried and dropped: aurora, clouds (muddy, especially on the light theme) and rain (gloomy). Five is enough.

#### More companions
Companions live in `src/companion/`: `characters.ts` holds each character's SVG, all following one contract (shared eyes/mouth/prop positions and class names), and `companion.ts` runs the shared states and reactions. Each character adds its own touches in CSS under `[data-companion=…]`. Same rules for all: decoration only, never sad about anything missed, quiet at night, static under reduced motion.
- [x] Companion picker in Settings (Puff by default, or Off), with still previews
- [x] **Sadie**: a mini golden retriever pup with fluffy wavy ears, a top-knot and a red collar. Her tail wags, faster when you log a feed; ears lift when excited
- [x] **Moon**: a sleepy moon in a nightcap that rocks while the baby sleeps
- [x] **Bunny**: ears perk up when excited and flop down for naps; the nose twitches
- [x] **Duckling**: flaps for baths, feeds and tummy time
- [x] The recap card draws whichever companion is chosen (a snapshot of the live SVG with colors inlined)
- [x] Coins: one for every entry, today's (with the all-time total under it) in a chip by the companion (a "+1" pops on each log), all time in Settings → Companion. Derived from the log, so undo takes the coin back; no streaks, nothing lost on a quiet day
- [x] Tap the companion: a line in its own voice (each character has `tapLines`) mixed with shared ones, taking turns; five quick taps tickle it
- [x] Coin milestones (all time: 1, 50, 100, 250, 500, 1,000, 2,500, 5,000, 10,000) get a celebration; Settings shows the next one
- [x] Moods by time of day and moments of the day (`src/companion/mood.ts`): greetings and drowsier eyes in the evening and at night, small idle bits (morning stretch, afternoon look-around, evening yawn), and bigger reactions with a cute line for a few seconds: first entry of each part of the day, waking up for the morning, goodnight, longest sleep today, round numbers of feeds and diapers, first poop, baths, tummy time, a calm-again fussy spell and a busy hour

### Phase 5 — Links & shortcuts
- [x] Link actions: `?do=log|start|stop|toggle&what=…` with `ago`, `side`, `ml`/`oz`, `milk`, `method`, `note`; friendly names (bottle, poop, both, sleep…); params stripped after running; a repeat within 8 s is ignored; bad links explain themselves
- [x] PWA icon shortcuts (log feed, wet diaper, dirty diaper, start/stop sleep) built on link actions
- [x] iOS Shortcuts / Siri: Settings → Shortcuts & Siri lists ready-made links with Copy buttons and setup steps; README has the same
- [x] `window.tinylog` API (state, log/start/stop/toggle, entries, undo, markdown, patterns) + `public/llms.txt`, with recipes an e2e test runs

## Later / not now
- **Cloud sync** (iCloud or similar) for the two phones, so merging isn't manual. The `updatedAt` + soft-delete model is already sync-ready.
- Medicines, growth (weight/length/head) and milestones: out of scope for now.
- Pump volume per side (currently one amount per session).
- **Companion unlocks with coins**: special companions or accessories at coin milestones (all-time total, so nothing is ever lost or spent down).

## Decisions log
- 2026-09-30 — Same stack and conventions as pomotimer2 (Vite + vanilla TS, anime.js, lazy three.js, vite-plugin-pwa, Vitest + Playwright, Pages).
- 2026-09-30 — Event log is the single source of truth; every view and stat is derived from it.
- 2026-09-30 — Phase 1 is the "When did we last…?" card screen; visualizations come after it's useful day to day.
- 2026-09-30 — Patterns are descriptive only, with data thresholds and no medical framing.
- 2026-09-30 — Two caregivers on two phones: each phone logs locally; sharing is a JSON export sent via the share sheet and merged on import (by id, last write wins, soft deletes). Cloud sync later.
- 2026-09-30 — IndexedDB is primary storage, JSON export/import is the backup.
- 2026-09-30 — Event types: feed (breast or bottle), diaper, sleep (nap or night), tummy, pump (side + volume), bath, doctor, plus a per-day note. No medicines, growth or milestones for now.
- 2026-09-30 — The input view is per day, with navigation to past days for filling in and correcting entries.
- 2026-09-30 — localStorage also keeps a mirror of the full log, as a fallback if IndexedDB is empty or unavailable.
- 2026-09-30 — Phase 1 built. Past days: a card tap opens the sheet at the same clock time on that day (never logs "now"). Tapping Night sleep during a nap (or the reverse) switches the running sleep instead of starting a second one. Stopping a pump opens the sheet for side and volume.
- 2026-09-30 — Auto theme: night 9 PM–6 AM, otherwise follows the system light/dark setting. Night also dims emoji and stops background motion.
- 2026-09-30 — E2E tests reset storage from `favicon.svg` (same origin, not the app) so no open IndexedDB connection blocks the delete.
- 2026-09-30 — Phase 2 built. The radial day clock sits between the cards and the log and follows day navigation. Trends (G) holds the day strip (7/14/28 days), the week of rings, the daily totals table and Markdown export. Bedside display (A) is a dim full-screen dialog with Wake Lock.
- 2026-09-30 — Chart palette: the card colors failed the validator as a 9-color categorical set, so charts use 5 re-stepped series colors (`--v-*` tokens) in a validated order; the cards keep their pastel identity colors.
- 2026-09-30 — Arcs draw in with anime.js `createDrawable` when a day opens; afterwards only new entries animate. Dots only fade (no SVG scale transforms, per the Safari pivot rule). No animation in the night theme.
- 2026-09-30 — Fixed before shipping: a full-day arc collapsed to nothing (start = end), and hour marks skipped the repeated hour when clocks fall back.
- 2026-09-30 — Heatmap added as a view option next to the day-by-day timeline. Rows start at the day-start hour (12 AM by default) and cover all 24 hours. Counts are per day; sleep/tummy/pump are minutes of the hour. Each column is scaled on its own (sleep against the full 60 minutes) and quantized into 5 steps of its series hue. Days before the first entry, and today's hours that haven't happened yet, don't dilute the averages. It's a real <table>, so it's its own text equivalent.
- 2026-09-30 — Main page gets a Clock | Grid toggle (remembered per device). The grid is the heatmap's layout for one day, but exact rather than averaged: segments for sleep/tummy/pump and marks for feeds/diapers at their minute within the hour, DST-aware rows, a "now" line.
- 2026-09-30 — Grid marks are a setting: dots (wet hollow, dirty filled), ✓ or ✕. Wet and dirty have their own columns, so glyphs lose nothing.
- 2026-09-30 — Tips: `tipsSeen: string[]` replaces `installTipSeen` (migrated on load). One tip at a time in the banner; the backup reminder is a reminder, not a tip, so it isn't reset by "Show tips again".
- 2026-09-30 — Backup reminder also counts: every 50 entries created since the last backup (50, 100, 150…), checked as you log, not just at launch. "Not now" snoozes to the next 50 (and the weekly reminder to the next session); Export or Share resets both. The weekly rule now only fires if something new was logged since the last backup. Logic is pure in `core/backupReminder.ts`.
- 2026-09-30 — Phase 3 Patterns: per-day averages use completed days only (today is left out until it's over) and skip days before logging began; "usually" ranges are the median and middle half; minimums are 3 full days, 3 nights, 5 naps/feed gaps, and tiles below them say what they still need. Bedtime/wake are grouped by night (a 12:30 AM bedtime belongs to the evening before). Feed gaps over 8h are treated as missed logs. No up/down deltas: they read as judgments. Sparklines are anchored at zero.
- 2026-09-30 — Fussy is logged, not derived: guessing it from short naps or frequent feeds would be a guess dressed up as data. Timed like tummy time. Sixth chart color is amber (`--v-fussy`), validated at the end of the order so the other five stay put. The pattern tile shows the busiest 3-hour window once there are 3+ spells.
- 2026-09-30 — iPhone form layout: two-column rows collapse to one column under 520px (iOS date-time fields need the full width), and date/number inputs get consistent Safari styling. An `iphone` Playwright project (WebKit + iPhone 14) runs `layout.spec.ts`, which fails if any form control overlaps another, spills out of the sheet, or a date field is squeezed. Timed entries added after the fact now start with an end time (start + 30 min, never past now) instead of an empty field, which iOS renders as a real-looking placeholder date.
- 2026-09-30 — Phase 4. Puff the cloud lives in a row under the date (today only, can be turned off) with one line about right now ("Pip is sleeping · 42m", "Awake 1h 10m · fed 38m ago"). States mirror ongoing events (sleeping, fussy, tummy, pump); reactions are one-shot anime.js on groups that pivot with `transform-box: fill-box`. It never looks sad about anything missed. Quieter in the night theme, static under reduced motion.
- 2026-09-30 — The recap is drawn with Canvas 2D rather than an HTML/SVG screenshot: no dependency, and iOS Safari refuses to export SVG `<foreignObject>` to an image. Theme colors (including color-mix and oklab) are resolved to rgba through a 1×1 canvas. Highlights stay descriptive: the longest stretch, and "longest this week" only with at least 2 other days to compare.
- 2026-09-30 — Planned more background scenes (fireflies, aurora, rain from pomotimer2, plus clouds, bubbles, crib mobile, snow) as a lazy scene registry with a preview picker. Not built yet.
- 2026-09-30 — Background scenes capped at five (night sky, fireflies, bubbles, crib mobile, snow). three.js color management is off for scenes (colors stay exactly as the theme defines them) and shader materials declare premultiplied alpha; both bugs made scenes far too dark or invisible.
- 2026-09-30 — Planned a few more companions (moon, bunny, duckling) on Puff's interface with a Settings picker. Not built yet.
- 2026-09-30 — Companions: Puff, Sadie (a mini golden retriever), Moon, Bunny and Duckling. The `companion` setting became a character id or 'off' (the old boolean migrates). The recap snapshots the live companion SVG with computed colors inlined, so new characters show up there without extra work.
- 2026-09-30 — Phase 5. Taps, link actions and `window.tinylog` share one set of operations (`core/ops.ts`), and the API builds a link query and runs it through the same parser, so names, aliases and validation can't drift apart. Links show the usual toast (prefixed "Via shortcut") with Undo; the API is silent and returns JSON. On iPhone, links open in Safari, whose storage iOS keeps separate from a Home Screen web app, so the app says so where the links are offered.
- 2026-09-30 — Zoom: pinch-zoom stays. Double-tap zoom is off (`touch-action: manipulation`), and on iPhone `maximum-scale=1` stops Safari's automatic zoom into focused fields (iOS still allows pinch with it; it's iOS-only because other browsers treat it as no-pinch). Text fields stay at least 16px, which a test checks on iPhone.
- 2026-09-30 — Longer undo: toasts with Undo stay 12 s (was 8 s), and `U` / `tinylog.undo()` work for 5 minutes after the last change (was 2). The footer shows the version and links to GitHub.
- 2026-09-30 — Optional breastfeeding length, entered in the details sheet (a tap still logs instantly): minutes per side (`minL`/`minR`) or one total (`min`) when both sides weren't timed separately. Only the lengths matching the chosen side are kept. Shown as "Breast · L 12m · R 8m"; daily totals and Markdown add breastfeeding time. Links and the API take `minl`/`minr`/`min`.
- 2026-09-30 — Share with partner on Android: Chrome's share sheet refuses JSON files, so the export goes as plain text (`tinylog-….txt`, same content) when the .json can't be shared; iPhone still gets the .json. Import accepts .txt as well as .json.
- 2026-10-01 — Companion moods follow the clock (morning 5–12, afternoon 12–17, evening 17–21, night 21–5) and the day. Moments are worked out from the event log when something is logged (today only, never for filling in past days), and most don't need sleep tracking: the first entry of each part of the day gets a hello, so families who only log feeds or diapers still see them. Lines are cute or a little funny, picked from a few variants, and never judge or advise. Idle bits run after 90 s of quiet, never at night or under reduced motion.
- 2026-10-01 — Coins: one per entry, counted on the day it was added (`createdAt`, through `days.ts`), derived in `core/coins.ts` rather than stored. Just a counter for now; unlocks may come later. Entries merged from the other phone bring their coins along, so it's the family's count. No streaks: a quiet day never costs anything.
- 2026-10-01 — v0.6.0: companion moods by time of day, moments of the day, and coins. Versions now go up with a major group of updates (see AGENTS.md).
- 2026-10-01 — The companion is a button ("Say hi to Sadie"). Tap lines cycle rather than pick at random, so taps never repeat back to back and tests can check them. Coin milestones are worked out by comparing all-time totals between renders (only after the log has loaded), so a merge that jumps past several celebrates the biggest one. The very first coin's celebration takes over from the moment of the day.
- 2026-10-02 — Deploys failed when CI ran shortly after midnight UTC: e2e tests seed entries relative to now, which then fell on yesterday. E2E now runs in a fixed-offset time zone where it's around midday (browser and test process), picked when the run starts.
