import { describe, expect, it } from 'vitest';
import { dayTotals } from './daily';
import { createEvent, patchEvent } from './events';
import { toMarkdown, totalsLine } from './markdown';

const at = (h: number, m = 0, d = 30) => new Date(2026, 8, d, h, m).getTime();
const now = at(20);
const ended = (e: ReturnType<typeof createEvent>, end: number) => patchEvent(e, { endAt: end }, e.at);

const events = [
  ended(createEvent('sleep', at(21, 0, 29), { sleep: 'night' }, 0), at(6)),
  createEvent('feed', at(6, 30), { method: 'breast', side: 'L' }, 0),
  createEvent('feed', at(10), { method: 'bottle', amount: 90 }, 0),
  createEvent('diaper', at(7), { diaper: 'wet' }, 0),
  createEvent('diaper', at(11), { diaper: 'both', note: 'blowout' }, 0),
  ended(createEvent('sleep', at(12), { sleep: 'nap' }, 0), at(13, 30)),
  ended(createEvent('tummy', at(15), undefined, 0), at(15, 10)),
  ended(createEvent('pump', at(16), { side: 'both', amount: 120 }, 0), at(16, 20)),
  patchEvent(createEvent('bath', at(18), undefined, 0), { deleted: true }, 1),
];

describe('dayTotals', () => {
  it('counts spit-ups and books', () => {
    const more = [createEvent('spitup', at(9), undefined, 0), createEvent('spitup', at(10), undefined, 0), createEvent('book', at(19), undefined, 0)];
    const t = dayTotals(more, '2026-09-30', 0, now);
    expect(t).toMatchObject({ spitups: 2, books: 1 });
    expect(totalsLine(t, { units: 'ml' })).toBe('2 spit-ups · 1 book');
  });

  it('adds up a day, splitting a night that started the evening before', () => {
    const t = dayTotals(events, '2026-09-30', 0, now);
    expect(t).toMatchObject({ feeds: 2, breastFeeds: 1, bottleMl: 90, wet: 2, dirty: 1, naps: 1, pumps: 1, pumpMl: 120, baths: 0 });
    expect(t.nightMs).toBe(6 * 3_600_000);
    expect(t.napMs).toBe(90 * 60_000);
    expect(t.sleepMs).toBe(7.5 * 3_600_000);
    expect(t.tummyMs).toBe(10 * 60_000);
  });

  it('respects a later day start', () => {
    const t = dayTotals(events, '2026-09-29', 7, now);
    // 7 AM Sep 29 → 7 AM Sep 30: the whole night and the 6:30 feed.
    expect(t.nightMs).toBe(9 * 3_600_000);
    expect(t.feeds).toBe(1);
  });
});

describe('markdown', () => {
  const prefs = { units: 'ml', clock: '24h', dayStartHour: 0, babyName: 'Pip' } as const;

  it('summarizes totals in one line', () => {
    expect(totalsLine(dayTotals(events, '2026-09-30', 0, now), prefs)).toBe(
      '2 feeds (90 ml by bottle) · 2 wet, 1 dirty · sleep 7h 30m (1 nap, 1h 30m) · tummy 10m · pumped 120 ml',
    );
  });

  it('writes days newest first with notes and entries', () => {
    const md = toMarkdown(events, { '2026-09-30': { day: '2026-09-30', text: 'First smile!', updatedAt: 1 } }, '2026-09-29', '2026-09-30', prefs, now);
    expect(md).toMatch(/^# Pip's log · /);
    expect(md.indexOf('Sep 30')).toBeLessThan(md.indexOf('## Tue, Sep 29'));
    expect(md).toContain('> First smile!');
    expect(md).toContain('- 21:00 (prev. day) 🌙 **Night sleep** — until 06:00 (9h)');
    expect(md).toContain('- 10:00 🍼 **Feed** — Bottle · 90 ml');
    expect(md).toContain('- 11:00 💩 **Wet + dirty diaper** — blowout');
    expect(md).not.toContain('Bath');
    expect(md).toContain('not medical advice');
  });

  it('marks empty days', () => {
    expect(toMarkdown([], {}, '2026-09-30', '2026-09-30', prefs, now)).toContain('_Nothing logged._');
  });
});

describe('breastfeeding minutes', () => {
  it('adds per-side lengths, or the total when there are none', () => {
    const feeds = [
      createEvent('feed', at(8), { method: 'breast', minL: 12, minR: 8 }, 0),
      createEvent('feed', at(11), { method: 'breast', min: 15 }, 0),
      createEvent('feed', at(14), { method: 'breast' }, 0),
    ];
    const t = dayTotals(feeds, '2026-09-30', 0, now);
    expect(t.breastMin).toBe(35);
    expect(totalsLine(t, { units: 'ml' })).toBe('3 feeds (35m breastfeeding)');
  });
});
