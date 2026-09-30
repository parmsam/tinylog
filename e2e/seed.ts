import type { LogEvent } from '../src/core/types';

const MIN = 60_000;
let n = 0;
const id = () => `seed-${++n}`;

/** A believable recent stretch for a fake baby, relative to `now`. Never real data. */
export function demoEvents(now = Date.now()): LogEvent[] {
  const ev = (type: LogEvent['type'], minsAgo: number, extra: Partial<LogEvent> = {}): LogEvent => {
    const at = now - minsAgo * MIN;
    return { id: id(), type, at, createdAt: at, updatedAt: at, ...extra };
  };
  const out: LogEvent[] = [
    ev('sleep', 14 * 60, { detail: { sleep: 'night' } }),
    ev('feed', 11 * 60, { detail: { method: 'breast', side: 'L' } }),
    ev('diaper', 10 * 60 + 50, { detail: { diaper: 'wet' } }),
    ev('feed', 8 * 60, { detail: { method: 'breast', side: 'R' } }),
    ev('diaper', 7 * 60 + 40, { detail: { diaper: 'both' } }),
    ev('pump', 6 * 60 + 30, { detail: { side: 'both', amount: 110 } }),
    ev('sleep', 5 * 60 + 20, { detail: { sleep: 'nap' } }),
    ev('tummy', 3 * 60 + 30),
    ev('feed', 2 * 60 + 5, { detail: { method: 'bottle', amount: 90, milk: 'breast' } }),
    ev('diaper', 50, { detail: { diaper: 'wet' } }),
    ev('bath', 26 * 60),
    ev('doctor', -3 * 24 * 60, { detail: { note: '2-month checkup + vaccines' } }),
  ];
  const lengths: Record<number, number> = { 0: 8 * 60, 5: 20, 6: 75, 7: 12 };
  for (const [i, len] of Object.entries(lengths)) out[+i].endAt = out[+i].at + len * MIN;
  return out;
}

/** Deterministic pseudo-random numbers, so demo data (and screenshots) are stable. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

/**
 * Several days of a fake baby's life before today, settling a little over time:
 * night sleep with a wake-up, 3–4 naps, feeds every ~3h, diapers, tummy time, some pumping.
 */
export function demoDays(days: number, now = Date.now()): LogEvent[] {
  const r = rng(42);
  const out: LogEvent[] = [];
  const mk = (type: LogEvent['type'], at: number, endAt?: number, detail?: LogEvent['detail']): void => {
    if (at > now || (endAt ?? 0) > now) return;
    out.push({ id: id(), type, at, endAt, detail, createdAt: at, updatedAt: at });
  };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let d = days; d >= 1; d--) {
    const base = new Date(today);
    base.setDate(base.getDate() - d);
    const h = (hours: number) => base.getTime() + hours * 60 * MIN;
    const settle = (days - d) / days; // 0 → 1 as the days go on
    // Night: bed ~20:30–22:00, one wake around 2–3 AM for a feed.
    const bed = h(20.5 + r() * 1.5 - settle * 0.8);
    const wake1 = bed + (4 + r() * 1.5 + settle) * 60 * MIN;
    mk('sleep', bed, wake1, { sleep: 'night' });
    mk('feed', wake1 + 5 * MIN, undefined, { method: 'breast', side: r() > 0.5 ? 'L' : 'R' });
    mk('diaper', wake1 + 25 * MIN, undefined, { diaper: 'wet' });
    const back = wake1 + 40 * MIN;
    mk('sleep', back, h(24 + 6 + r() * 1.2), { sleep: 'night' });
    // Day: feeds ~every 3h, naps between.
    for (let t = 7; t < 20; t += 2.6 + r() * 0.8) {
      const bottle = r() > 0.7;
      mk('feed', h(t), undefined, bottle ? { method: 'bottle', amount: 60 + Math.round(r() * 6) * 10, milk: r() > 0.3 ? 'breast' : 'formula' } : { method: 'breast', side: r() > 0.5 ? 'L' : 'R' });
      mk('diaper', h(t + 0.3), undefined, { diaper: r() > 0.7 ? (r() > 0.5 ? 'both' : 'dirty') : 'wet' });
      if (t < 18) mk('sleep', h(t + 1), h(t + 1 + 0.5 + r() * 1.2), { sleep: 'nap' });
    }
    mk('tummy', h(10.2), h(10.2 + 0.1 + r() * 0.15));
    mk('tummy', h(16.4), h(16.4 + 0.08 + r() * 0.15));
    if (r() > 0.4) mk('pump', h(13), h(13.3), { side: 'both', amount: 80 + Math.round(r() * 8) * 10 });
    if (r() > 0.35) mk('fussy', h(17 + r() * 1.5), h(17.6 + r() * 1.5));
    if (d % 3 === 0) mk('bath', h(19.2));
  }
  return out;
}
