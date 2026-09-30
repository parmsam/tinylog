import { dayTotals } from './daily';
import { addDays, dayKey, dayRange } from './days';
import type { LogEvent } from './types';

/**
 * Descriptive patterns from the log: what usually happens, never what should.
 * Per-day averages use completed days only (today is still happening); ranges use the median
 * and the middle half of values, which a single odd nap or a missed log can't drag around.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Minimum completed days before any per-day average is shown. */
export const MIN_DAYS = 3;
/** Minimum samples before a "usually …" range is shown. */
export const MIN_NIGHTS = 3;
export const MIN_SAMPLES = 5;
/** Gaps between feeds longer than this are probably missed logs, not real gaps. */
const MAX_FEED_GAP = 8 * HOUR;

export interface Spread {
  p25: number;
  median: number;
  p75: number;
  n: number;
}

export function spread(values: number[]): Spread | null {
  if (!values.length) return null;
  const xs = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const i = (xs.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
  };
  return { p25: q(0.25), median: q(0.5), p75: q(0.75), n: xs.length };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** A metric that may not have enough data yet. */
export type Maybe<T> = { ok: true; value: T; basis: number } | { ok: false; have: number; need: number };

const need = <T>(have: number, min: number, value: () => T): Maybe<T> =>
  have >= min ? { ok: true, value: value(), basis: have } : { ok: false, have, need: min };

export interface Patterns {
  /** Completed days in range that count (after logging began, before today). */
  days: string[];
  sleepPerDay: Maybe<{ avg: number; napAvg: number; nightAvg: number; series: number[] }>;
  napLength: Maybe<Spread>;
  napsPerDay: Maybe<number>;
  longestStretch: Maybe<{ avg: number; best: number; bestNight: string }>;
  /** Minutes after noon (so 8:30 PM = 510, 12:30 AM = 750). */
  bedtime: Maybe<Spread>;
  /** Minutes after midnight. */
  wake: Maybe<Spread>;
  feedsPerDay: Maybe<{ avg: number; bottleMlAvg: number; series: number[] }>;
  feedGap: Maybe<Spread>;
  diapers: Maybe<{ wet: number; dirty: number; series: number[] }>;
  tummy: Maybe<{ weeks: { from: string; to: string; ms: number }[]; perDay: number }>;
  /** Only when anything fussy was logged in range. `peak` is the busiest 3-hour window (start hour). */
  fussy?: Maybe<{ perDay: number; spells: number; peak: number | null }>;
  /** Only when there's any pumping in range. */
  pump?: Maybe<{ mlPerDay: number; perSession: Spread | null; sessionsPerDay: number }>;
}

/** Local date of the evening a night belongs to: sleep starting before noon counts for the previous evening. */
export function nightOf(ts: number): string {
  return dayKey(ts - 12 * HOUR);
}

function minutesOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

export function patterns(events: LogEvent[], lastDay: string, rangeDays: number, dayStartHour: number, now: number): Patterns {
  const live = events.filter((e) => !e.deleted);
  const today = dayKey(now, dayStartHour);
  const first = live.reduce((m, e) => Math.min(m, e.at), Infinity);
  const firstDay = Number.isFinite(first) ? dayKey(first, dayStartHour) : today;

  // Completed days in range: not today, not before logging started.
  const days: string[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = addDays(lastDay, -i);
    if (d >= firstDay && d < today) days.push(d);
  }
  const [rangeStart] = dayRange(addDays(lastDay, -(rangeDays - 1)), dayStartHour);
  const inRange = live.filter((e) => e.at >= Math.max(rangeStart, first) && e.at < now);

  const totals = days.map((d) => dayTotals(live, d, dayStartHour, now));
  const nd = days.length;

  const sleepPerDay = need(nd, MIN_DAYS, () => ({
    avg: avg(totals.map((t) => t.sleepMs)),
    napAvg: avg(totals.map((t) => t.napMs)),
    nightAvg: avg(totals.map((t) => t.nightMs)),
    series: totals.map((t) => t.sleepMs),
  }));

  const naps = inRange.filter((e) => e.type === 'sleep' && e.detail?.sleep !== 'night' && e.endAt !== undefined);
  const napLength = need(naps.length, MIN_SAMPLES, () => spread(naps.map((e) => e.endAt! - e.at))!);
  const napsPerDay = need(nd, MIN_DAYS, () => avg(totals.map((t) => t.naps)));

  // Nights: night sleeps grouped by the evening they belong to.
  const nights = new Map<string, LogEvent[]>();
  for (const e of inRange) {
    if (e.type !== 'sleep' || e.detail?.sleep !== 'night' || e.endAt === undefined) continue;
    const k = nightOf(e.at);
    nights.set(k, [...(nights.get(k) ?? []), e]);
  }
  const nightList = [...nights.entries()].sort(([a], [b]) => a.localeCompare(b));
  const stretches = nightList.map(([k, es]) => ({ k, ms: Math.max(...es.map((e) => e.endAt! - e.at)) }));
  const longestStretch = need(stretches.length, MIN_NIGHTS, () => {
    const best = stretches.reduce((b, s) => (s.ms > b.ms ? s : b));
    return { avg: avg(stretches.map((s) => s.ms)), best: best.ms, bestNight: best.k };
  });

  // Bedtime: first night-sleep start of the evening, between 4 PM and 4 AM. Up for the day: last night-sleep end, 3 AM–noon.
  const bedtimes: number[] = [];
  const wakes: number[] = [];
  for (const [, es] of nightList) {
    const start = Math.min(...es.map((e) => e.at));
    const sm = minutesOfDay(start);
    if (sm >= 16 * 60 || sm < 4 * 60) bedtimes.push((sm - 12 * 60 + 24 * 60) % (24 * 60));
    const end = Math.max(...es.map((e) => e.endAt!));
    const em = minutesOfDay(end);
    if (em >= 3 * 60 && em < 12 * 60) wakes.push(em);
  }
  const bedtime = need(bedtimes.length, MIN_NIGHTS, () => spread(bedtimes)!);
  const wake = need(wakes.length, MIN_NIGHTS, () => spread(wakes)!);

  const feedsPerDay = need(nd, MIN_DAYS, () => ({
    avg: avg(totals.map((t) => t.feeds)),
    bottleMlAvg: avg(totals.map((t) => t.bottleMl)),
    series: totals.map((t) => t.feeds),
  }));
  const feeds = inRange.filter((e) => e.type === 'feed').sort((a, b) => a.at - b.at);
  const gaps: number[] = [];
  for (let i = 1; i < feeds.length; i++) {
    const g = feeds[i].at - feeds[i - 1].at;
    if (g > 0 && g <= MAX_FEED_GAP) gaps.push(g);
  }
  const feedGap = need(gaps.length, MIN_SAMPLES, () => spread(gaps)!);

  const diapers = need(nd, MIN_DAYS, () => ({
    wet: avg(totals.map((t) => t.wet)),
    dirty: avg(totals.map((t) => t.dirty)),
    series: totals.map((t) => t.wet + t.dirty),
  }));

  // Tummy time in rolling 7-day blocks ending today (so "this week" includes today so far).
  const weeks: { from: string; to: string; ms: number }[] = [];
  for (let w = 0; w * 7 < rangeDays; w++) {
    const to = addDays(today, -w * 7);
    const from = addDays(to, -6);
    if (to < firstDay) break;
    let ms = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) ms += dayTotals(live, d, dayStartHour, now).tummyMs;
    weeks.unshift({ from, to, ms });
  }
  const tummy = need(nd, MIN_DAYS, () => ({ weeks, perDay: avg(totals.map((t) => t.tummyMs)) }));

  // Fussy: time per day, and the 3-hour window of the day it most often falls in.
  const fussies = inRange.filter((e) => e.type === 'fussy');
  const fussy = fussies.length
    ? need(nd, MIN_DAYS, () => {
        const byHour = new Array<number>(24).fill(0);
        for (const e of fussies) {
          const end = e.endAt ?? now;
          for (let t = e.at; t < end; ) {
            const d = new Date(t);
            d.setMinutes(0, 0, 0);
            const next = Math.min(d.getTime() + HOUR, end);
            byHour[new Date(t).getHours()] += next - t;
            t = next;
          }
        }
        let peak: number | null = null;
        let best = 0;
        for (let h = 0; h < 24; h++) {
          const w = byHour[h] + byHour[(h + 1) % 24] + byHour[(h + 2) % 24];
          if (w > best) [best, peak] = [w, h];
        }
        return { perDay: avg(totals.map((t) => t.fussyMs)), spells: fussies.length, peak: fussies.length >= MIN_NIGHTS ? peak : null };
      })
    : undefined;

  const pumps = inRange.filter((e) => e.type === 'pump');
  const pump = pumps.length
    ? need(nd, MIN_DAYS, () => {
        const amounts = pumps.map((e) => e.detail?.amount ?? 0).filter((a) => a > 0);
        return {
          mlPerDay: avg(totals.map((t) => t.pumpMl)),
          perSession: amounts.length >= MIN_SAMPLES ? spread(amounts) : null,
          sessionsPerDay: avg(totals.map((t) => t.pumps)),
        };
      })
    : undefined;

  return { days, sleepPerDay, napLength, napsPerDay, longestStretch, bedtime, wake, feedsPerDay, feedGap, diapers, tummy, fussy, pump };
}
