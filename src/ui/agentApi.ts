import { CARDS, cardById, cardFor, lastFor, lastWake, ongoingFor, type CardId } from '../core/cards';
import { dayTotals } from '../core/daily';
import { addDays, eventsForDay, spanEnd } from '../core/days';
import { parseLinkAction } from '../core/linkActions';
import { app, settings, today } from '../core/log';
import { toMarkdown } from '../core/markdown';
import { logCard, startCard, stopCard, toggleCard, type OpResult } from '../core/ops';
import { patterns } from '../core/stats';
import { summary } from '../core/status';
import type { LogEvent } from '../core/types';
import { undoLast } from './toast';

/**
 * `window.tinylog`: a small scripting API for AI agents and automation driving the page
 * (Playwright `page.evaluate`, DevTools, browser agents). It uses the same rules and names as link
 * actions, returns plain JSON-safe data, and throws an Error with a readable message on bad input.
 * Data stays in this browser: an outside agent can only reach it by driving a browser with the app open.
 */
export interface ActOptions {
  minutesAgo?: number;
  side?: 'L' | 'R' | 'both';
  ml?: number;
  oz?: number;
  method?: 'breast' | 'bottle';
  milk?: 'breast' | 'formula';
  diaper?: 'wet' | 'dirty' | 'both';
  note?: string;
  /** Breastfeeding length in minutes: per side, or one total. */
  minL?: number;
  minR?: number;
  min?: number;
}

export interface Entry {
  id: string;
  what: CardId;
  label: string;
  start: string;
  end: string | null;
  minutes: number | null;
  ongoing: boolean;
  summary: string;
  note: string | null;
}

const MIN = 60_000;
const iso = (ts: number) => new Date(ts).toISOString();

function toEntry(e: LogEvent, now = Date.now()): Entry {
  const card = cardFor(e)!;
  const prefs = settings.get();
  const end = e.endAt ?? null;
  return {
    id: e.id,
    what: card.id,
    label: e.type === 'diaper' ? `${summary(e, prefs)} diaper` : card.label,
    start: iso(e.at),
    end: end === null ? null : iso(end),
    minutes: card.timed ? Math.round((spanEnd(e, now) - e.at) / MIN) : null,
    ongoing: card.timed && e.endAt === undefined,
    summary: e.type === 'diaper' ? '' : summary(e, prefs),
    note: e.detail?.note ?? null,
  };
}

/** Runs a verb through the link-action parser, so names, aliases and validation match `?do=` links. */
function act(verb: 'log' | 'start' | 'stop' | 'toggle', what: string, opts: ActOptions = {}) {
  const q = new URLSearchParams({ do: verb, what: String(what) });
  const { minutesAgo, ...rest } = opts;
  if (minutesAgo !== undefined) q.set('ago', String(minutesAgo));
  // Option names match link parameters, lower-cased (minL → minl).
  for (const [k, v] of Object.entries(rest)) if (v !== undefined && v !== null) q.set(k.toLowerCase(), String(v));
  const now = Date.now();
  const a = parseLinkAction(`?${q}`, now);
  if (!a || a.kind === 'invalid') throw new Error(`tinylog: ${a?.kind === 'invalid' ? a.reason : 'nothing to do'}`);
  if (app.get().day !== today(now)) app.set({ day: today(now) });
  const op = { log: logCard, start: startCard, stop: stopCard, toggle: toggleCard }[a.kind];
  const r: OpResult = op(a.card, { at: now - a.minutesAgo * MIN, detail: Object.keys(a.detail).length ? a.detail : undefined });
  if (r.kind === 'noop') return { result: 'nothing-to-do' as const, reason: r.reason };
  return { result: r.kind, entry: toEntry(r.event) };
}

/** Common requests and the calls that answer them, shown in `tinylog.help()` and `llms.txt`. An e2e test runs each one. */
export const RECIPES: { ask: string; code: string; note: string }[] = [
  { ask: 'When did the baby last eat?', code: 'tinylog.state().last.feed', note: 'minutesAgo, the time (ISO) and a summary like "Breast · L". state() also has what is going on now and today\'s totals.' },
  { ask: 'Log a wet diaper from 10 minutes ago', code: "tinylog.log('wet', { minutesAgo: 10 })", note: 'Also: dirty, both, bath, doctor (with a note).' },
  { ask: 'Log a 90 ml bottle of formula', code: "tinylog.log('bottle', { ml: 90, milk: 'formula' })", note: 'Breast feeds: tinylog.log(\'feed\', { side: \'L\' }). Plain tinylog.log(\'feed\') picks the other breast, like a tap.' },
  { ask: 'The baby fell asleep / woke up', code: "tinylog.toggle('sleep')", note: '"sleep" is a nap by day and night sleep in the evening; toggle starts it or stops the one running.' },
  { ask: 'How has sleep been this week?', code: 'tinylog.patterns(7)', note: 'Descriptive patterns (typical nap length, bedtime window…); each says what it is based on. Not advice.' },
  { ask: 'Summarize today', code: 'tinylog.markdown(1)', note: 'Markdown with totals, the day note and every entry. entries() gives the same as data.' },
];

const HELP = `tinylog: baby tracker scripting API (window.tinylog). Data stays in this browser.
All calls are synchronous. Names: feed, bottle, breast, wet, dirty, both, nap, night, sleep, tummy, pump, fussy, bath, doctor.

tinylog.state()                        what's going on now, the last of each thing, today's totals
tinylog.log(what, opts?)               log it now (timed things toggle); opts:
                                       { minutesAgo, side: 'L'|'R'|'both', ml, oz, method, milk, diaper, note,
                                         minL, minR, min }  (breastfeeding minutes: per side, or a total)
tinylog.start(what, opts?)             start nap / night / tummy / pump / fussy
tinylog.stop(what, opts?)              stop it (pump: pass ml)
tinylog.toggle(what, opts?)            start or stop
tinylog.entries(day?)                  a day's entries ('YYYY-MM-DD', default today)
tinylog.undo()                         undo the last change made in the app (within 5 minutes)
tinylog.markdown(days = 1)             the last N days as Markdown
tinylog.patterns(days = 7)             typical naps, bedtime, feeds… (descriptive, not advice)

Common requests:
${RECIPES.map((r) => `- ${r.ask}\n    ${r.code}\n    ${r.note}`).join('\n')}`;

export function createAgentApi() {
  return {
    version: __APP_VERSION__,
    help: () => HELP,
    state() {
      const now = Date.now();
      const { events } = app.get();
      const prefs = settings.get();
      const t = dayTotals(events, today(now), prefs.dayStartHour, now);
      const last = (id: CardId) => {
        const e = lastFor(events, cardById(id), now);
        return e ? { at: iso(e.at), minutesAgo: Math.round((now - (e.endAt ?? e.at)) / MIN), summary: summary(e, prefs) } : null;
      };
      const ongoing = CARDS.filter((c) => c.timed)
        .map((c) => ongoingFor(events, c))
        .filter((e): e is LogEvent => !!e)
        .map((e) => ({ what: cardFor(e)!.id, since: iso(e.at), minutes: Math.round((now - e.at) / MIN) }));
      const wake = lastWake(events, now);
      const asleep = ongoing.find((o) => o.what === 'nap' || o.what === 'night');
      return {
        baby: prefs.babyName.trim() || null,
        now: iso(now),
        ongoing,
        awakeMinutes: asleep ? null : wake !== undefined ? Math.round((now - wake) / MIN) : null,
        last: { feed: last('feed'), wet: last('wet'), dirty: last('dirty'), nap: last('nap'), night: last('night'), tummy: last('tummy'), pump: last('pump'), bath: last('bath') },
        today: {
          feeds: t.feeds,
          bottleMl: t.bottleMl,
          wet: t.wet,
          dirty: t.dirty,
          sleepMinutes: Math.round(t.sleepMs / MIN),
          naps: t.naps,
          tummyMinutes: Math.round(t.tummyMs / MIN),
          fussyMinutes: Math.round(t.fussyMs / MIN),
          pumpMl: t.pumpMl,
        },
      };
    },
    log: (what: string, opts?: ActOptions) => act('log', what, opts),
    start: (what: string, opts?: ActOptions) => act('start', what, opts),
    stop: (what: string, opts?: ActOptions) => act('stop', what, opts),
    toggle: (what: string, opts?: ActOptions) => act('toggle', what, opts),
    entries(day?: string): Entry[] {
      const d = day ?? today();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("tinylog: day is 'YYYY-MM-DD'");
      const now = Date.now();
      return eventsForDay(app.get().events, d, settings.get().dayStartHour, now)
        .sort((a, b) => a.at - b.at)
        .map((e) => toEntry(e, now));
    },
    undo: () => undoLast(),
    markdown(days = 1) {
      const s = app.get();
      const last = today();
      return toMarkdown(s.events, s.notes, addDays(last, -(Math.max(1, Math.round(days)) - 1)), last, settings.get(), Date.now());
    },
    patterns(days = 7) {
      return patterns(app.get().events, today(), Math.max(3, Math.min(60, Math.round(days))), settings.get().dayStartHour, Date.now());
    },
  };
}

export type TinylogApi = ReturnType<typeof createAgentApi>;

declare global {
  interface Window {
    tinylog: TinylogApi;
  }
}
