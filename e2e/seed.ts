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
