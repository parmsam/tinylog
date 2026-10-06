import { describe, expect, it } from 'vitest';
import { createEvent, patchEvent } from './events';
import { MIN_DAYS, nightOf, patterns, spread } from './stats';
import type { LogEvent } from './types';

const MIN = 60_000;
const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
const timed = (type: LogEvent['type'], start: number, mins: number, detail?: LogEvent['detail']) =>
  patchEvent(createEvent(type, start, detail, start), { endAt: start + mins * MIN }, start);

/** Sep 20–29: a steady little routine. "Now" is Sep 30 at 10:00. */
function routine(): LogEvent[] {
  const out: LogEvent[] = [];
  for (let d = 20; d <= 29; d++) {
    const late = d % 2 ? 30 : 0; // bedtime alternates 8:00 / 8:30 PM
    out.push(timed('sleep', at(d, 20, late), 5 * 60, { sleep: 'night' })); // first stretch 5h
    out.push(createEvent('feed', at(d + 1, 1, late + 10), undefined, 0));
    out.push(timed('sleep', at(d + 1, 1, late + 40), 5 * 60, { sleep: 'night' })); // back down until ~6:40–7:10
    for (const h of [8, 11, 14, 17]) {
      out.push(createEvent('feed', at(d, h), { method: 'bottle', amount: 90 }, 0));
      out.push(createEvent('diaper', at(d, h, 20), { diaper: h === 11 ? 'both' : 'wet' }, 0));
    }
    out.push(timed('sleep', at(d, 9), 60, { sleep: 'nap' }));
    out.push(timed('sleep', at(d, 12), 45, { sleep: 'nap' }));
    out.push(timed('sleep', at(d, 15), 90, { sleep: 'nap' }));
    out.push(timed('tummy', at(d, 10), 10));
  }
  return out;
}

const now = at(30, 10);

describe('spread', () => {
  it('gives the median and middle half', () => {
    expect(spread([1, 2, 3, 4, 5])).toEqual({ p25: 2, median: 3, p75: 4, n: 5 });
    expect(spread([])).toBeNull();
  });
});

describe('nightOf', () => {
  it('counts sleep after midnight as the previous evening', () => {
    expect(nightOf(at(30, 0, 30))).toBe('2026-09-29');
    expect(nightOf(at(29, 20))).toBe('2026-09-29');
  });
});

describe('patterns', () => {
  const p = patterns(routine(), '2026-09-30', 7, 0, now);

  it('uses completed days only', () => {
    expect(p.days).toEqual(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29']);
  });

  it('describes naps', () => {
    expect(p.napLength).toMatchObject({ ok: true, value: { median: 60 * MIN } });
    if (p.napLength.ok) {
      expect(p.napLength.value.p25).toBe(45 * MIN);
      expect(p.napLength.value.p75).toBe(90 * MIN);
    }
    expect(p.napsPerDay).toMatchObject({ ok: true, value: 3 });
  });

  it('finds the bedtime window and wake-up time', () => {
    expect(p.bedtime.ok).toBe(true);
    if (p.bedtime.ok) {
      // 8:00 PM = 480 min after noon, 8:30 PM = 510.
      expect(p.bedtime.value.p25).toBeGreaterThanOrEqual(480);
      expect(p.bedtime.value.p75).toBeLessThanOrEqual(510);
    }
    if (p.wake.ok) expect(p.wake.value.median).toBeGreaterThanOrEqual(6 * 60 + 40);
  });

  it('averages the longest stretch per night', () => {
    expect(p.longestStretch).toMatchObject({ ok: true, value: { avg: 5 * 60 * MIN, best: 5 * 60 * MIN } });
  });

  it('describes feeds and the gaps between them', () => {
    expect(p.feedsPerDay).toMatchObject({ ok: true, value: { avg: 5, bottleMlAvg: 360 } });
    // Daytime feeds are 3h apart; the 17:00 → 1:10 gap (over 8h) is treated as a missed log.
    if (p.feedGap.ok) expect(p.feedGap.value.median).toBe(3 * 60 * MIN);
  });

  it('counts diapers and weekly tummy time', () => {
    expect(p.diapers).toMatchObject({ ok: true, value: { wet: 4, dirty: 1 } });
    expect(p.tummy.ok && p.tummy.value.weeks).toHaveLength(1);
    expect(p.tummy.ok && p.tummy.value.perDay).toBe(10 * MIN);
    expect(p.pump).toBeUndefined();
    expect(p.sleepPlace).toBeUndefined();
  });

  it('shares sleep time by place, once enough sleeps have one', () => {
    const placed = [
      timed('sleep', at(25, 13), 90, { sleep: 'nap', where: 'bassinet' }),
      timed('sleep', at(26, 13), 90, { sleep: 'nap', where: 'bassinet' }),
      timed('sleep', at(27, 13), 60, { sleep: 'nap', where: 'stroller' }),
      timed('sleep', at(28, 13), 60, { sleep: 'nap', where: 'bassinet' }),
    ];
    const few = patterns([...routine(), ...placed], '2026-09-30', 7, 0, now).sleepPlace;
    expect(few).toEqual({ ok: false, have: 4, need: 5 });
    const enough = patterns([...routine(), ...placed, timed('sleep', at(29, 13), 90, { sleep: 'nap', where: 'stroller' })], '2026-09-30', 7, 0, now).sleepPlace;
    expect(enough).toEqual({
      ok: true,
      basis: 5,
      value: [
        { place: 'bassinet', share: 240 / 390 },
        { place: 'stroller', share: 150 / 390 },
      ],
    });
  });

  it('holds back until there is enough data', () => {
    const fresh = routine().filter((e) => e.at >= at(28, 12)); // nights of the 28th and 29th only
    const q = patterns(fresh, '2026-09-30', 7, 0, now);
    expect(q.days).toHaveLength(2);
    expect(q.sleepPerDay).toEqual({ ok: false, have: 2, need: MIN_DAYS });
    expect(q.longestStretch.ok).toBe(false);
  });

  it('ignores feed gaps long enough to be missed logs', () => {
    // Gaps of 3, 3, 3, 13 (dropped) and 3 hours: only 4 usable, so not enough yet.
    const gappy = [0, 3, 6, 9, 22, 25].map((h) => createEvent('feed', at(25, 0) + h * 60 * MIN, undefined, 0));
    const g = patterns(gappy, '2026-09-30', 7, 0, now).feedGap;
    expect(g.ok).toBe(false);
    expect(!g.ok && g.have).toBe(4);
  });
});

describe('fussy patterns', () => {
  it('finds the busiest 3-hour window and time per day, only when fussiness is logged', () => {
    const evenings = [25, 26, 27, 28, 29].map((d) => timed('fussy', at(d, 17, 30), 60));
    const p = patterns([...routine(), ...evenings, timed('fussy', at(26, 10), 10)], '2026-09-30', 7, 0, now);
    expect(p.fussy?.ok).toBe(true);
    if (p.fussy?.ok) {
      expect(p.fussy.value.peak).toBeGreaterThanOrEqual(16);
      expect(p.fussy.value.peak).toBeLessThanOrEqual(17);
      expect(p.fussy.value.spells).toBe(6);
    }
    expect(patterns(routine(), '2026-09-30', 7, 0, now).fussy).toBeUndefined();
  });
});
