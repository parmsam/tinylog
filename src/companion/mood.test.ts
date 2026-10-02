import { describe, expect, it } from 'vitest';
import { createEvent, patchEvent } from '../core/events';
import type { LogEvent } from '../core/types';
import { greeting, idleBit, milestoneMoment, momentFor, periodStart, tapMoment, timeOfDay } from './mood';

const at = (h: number, m = 0, d = 30) => new Date(2026, 8, d, h, m).getTime();
const opts = { dayStartHour: 0, name: 'Pip', buddy: 'Puff' };
const ev = (type: Parameters<typeof createEvent>[0], t: number, detail?: Parameters<typeof createEvent>[2]) => createEvent(type, t, detail, t);
const slept = (from: number, to: number, sleep: 'nap' | 'night' = 'nap') => patchEvent(ev('sleep', from, { sleep }), { endAt: to }, to);

/** The moment for logging `e` now (with `before` already in the log). */
const moment = (card: Parameters<typeof momentFor>[1], what: Parameters<typeof momentFor>[2], e: LogEvent, before: LogEvent[], now = e.endAt ?? e.at) =>
  momentFor([...before, e], card, what, e, now, opts);

describe('time of day', () => {
  it('splits the clock into morning, afternoon, evening and night', () => {
    expect([4, 5, 11, 12, 16, 17, 20, 21, 0].map((h) => timeOfDay(at(h)))).toEqual([
      'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ]);
  });

  it('starts the night the evening before', () => {
    expect(periodStart(at(2, 30))).toBe(at(21, 0, 29));
    expect(periodStart(at(22))).toBe(at(21));
    expect(periodStart(at(9, 15))).toBe(at(5));
  });

  it('greets for the time of day, and idles quietly at night', () => {
    expect(greeting('Sadie', 'morning')).toBe('Good morning from Sadie');
    expect(greeting('Sadie', 'afternoon')).toBe('Hi from Sadie');
    expect(greeting('Sadie', 'night')).toBe('Shh… hi from Sadie');
    expect(idleBit('morning')).toBe('stretch');
    expect(idleBit('night')).toBeUndefined();
  });
});

describe('moments', () => {
  it('says good morning when the night sleep ends, with how long it was', () => {
    const night = slept(at(20, 0, 29), at(6, 30), 'night');
    expect(moment('night', 'stop', night, [])).toEqual({ reaction: 'morning', note: expect.stringMatching(/Pip.*10h 30m/) });
  });

  it('says goodnight when night sleep starts in the evening', () => {
    expect(moment('night', 'start', ev('sleep', at(19, 30), { sleep: 'night' }), [ev('feed', at(19))])?.reaction).toBe('goodnight');
  });

  it('celebrates the longest sleep today, but not the only one', () => {
    const short = slept(at(9), at(9, 40));
    const long = slept(at(13), at(14, 30));
    expect(moment('nap', 'stop', long, [short])).toEqual({ reaction: 'proud', note: expect.stringContaining('Longest sleep today · 1h 30m') });
    expect(moment('nap', 'stop', long, [])?.note ?? '').not.toContain('Longest');
    expect(moment('nap', 'stop', short, [long])?.note ?? '').not.toContain('Longest');
  });

  it('greets the first entry of each part of the day, so it works without logging sleep', () => {
    expect(moment('feed', 'log', ev('feed', at(7)), [ev('feed', at(3))])).toEqual({ reaction: 'morning', note: expect.stringMatching(/morning|shine/i) });
    expect(moment('wet', 'log', ev('diaper', at(13), { diaper: 'wet' }), [ev('feed', at(7))])?.note).toMatch(/afternoon/i);
    expect(moment('feed', 'log', ev('feed', at(18)), [ev('feed', at(13))])?.note).toMatch(/evening/i);
    expect(moment('feed', 'log', ev('feed', at(23)), [ev('feed', at(18))])?.reaction).toBe('goodnight');
    // Not the second time.
    expect(moment('feed', 'log', ev('feed', at(9)), [ev('feed', at(7))])).toBeUndefined();
  });

  it('cheers round numbers of feeds and diapers', () => {
    const feeds = [1, 3, 5, 7].map((h) => ev('feed', at(h)));
    expect(moment('feed', 'log', ev('feed', at(9)), feeds)?.note).toMatch(/^5 feeds today/);
    const diapers = [1, 3, 5, 7].map((h) => ev('diaper', at(h), { diaper: 'wet' }));
    expect(moment('wet', 'log', ev('diaper', at(9), { diaper: 'wet' }), diapers)?.note).toMatch(/^5 diapers today/);
  });

  it('has a few cute ones: first poop, baths, tummy time', () => {
    const morning = [ev('feed', at(6))];
    expect(moment('dirty', 'log', ev('diaper', at(8), { diaper: 'dirty' }), morning)?.note).toMatch(/poop/i);
    expect(moment('dirty', 'log', ev('diaper', at(10), { diaper: 'both' }), [...morning, ev('diaper', at(8), { diaper: 'dirty' })])).toBeUndefined();
    expect(moment('bath', 'log', ev('bath', at(8)), morning)?.reaction).toBe('cheer');
    const tummy = patchEvent(ev('tummy', at(8)), { endAt: at(8, 6) }, at(8, 6));
    expect(moment('tummy', 'stop', tummy, morning)).toEqual({ reaction: 'proud', note: expect.stringContaining('6m') });
  });

  it('notices a busy hour once, on the fifth entry', () => {
    const recent = [10, 20, 30, 40].map((m) => ev('feed', at(8, m)));
    expect(moment('wet', 'log', ev('diaper', at(8, 50), { diaper: 'wet' }), [ev('feed', at(6)), ...recent])?.note).toMatch(/Busy hour/);
  });

  it('calls out a fussy spell that settled, kindly', () => {
    const fussy = patchEvent(ev('fussy', at(17)), { endAt: at(17, 25) }, at(17, 25));
    expect(moment('fussy', 'stop', fussy, [ev('feed', at(16))])?.note).toMatch(/^Calm again after 25m/);
  });

  it('stays out of filling in a past day', () => {
    expect(moment('feed', 'log', ev('feed', at(8, 0, 29)), [], at(10))).toBeUndefined();
  });

  it('fills in the baby and companion names, with a fallback when there is no name', () => {
    const e = ev('bath', at(8));
    const lines = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const before = Array.from({ length: i }, (_, k) => ev('feed', at(1, k)));
      lines.add(momentFor([...before, e], 'bath', 'log', e, at(8), { ...opts, name: '' })!.note);
    }
    for (const l of lines) expect(l).not.toMatch(/\{|, !|,$/);
    expect([...lines].some((l) => l.includes('Puff'))).toBe(true);
  });
});

describe('taps', () => {
  const own = ['Woof!', 'Belly rubs later?', 'Who’s a good pup? Me!'];

  it('takes turns between its own lines and shared ones, never the same twice in a row', () => {
    const notes = Array.from({ length: 14 }, (_, n) => tapMoment(own, n, false).note);
    expect(notes[0]).toBe('Woof!');
    expect(new Set(notes.slice(0, 7)).size).toBe(7);
    for (const l of own) expect(notes).toContain(l);
    notes.slice(1).forEach((l, i) => expect(l).not.toBe(notes[i]));
  });

  it('giggles, and tickling gets its own line', () => {
    expect(tapMoment(own, 0, false).reaction).toBe('giggle');
    expect(tapMoment(own, 3, true)).toEqual({ reaction: 'proud', note: 'Hehe, that tickles!' });
  });
});

describe('coin milestones', () => {
  it('welcomes the first coin and cheers the rest', () => {
    expect(milestoneMoment(1, 'Puff').note).toBe('Your first coin! Puff is keeping count');
    expect(milestoneMoment(1000, 'Puff').note).toMatch(/^1,000 coins!/);
  });
});
