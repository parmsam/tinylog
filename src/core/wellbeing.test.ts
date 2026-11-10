import { describe, expect, it } from 'vitest';
import { cardById } from './cards';
import { createEvent, patchEvent } from './events';
import { toMarkdown } from './markdown';
import { cardStatus, summary } from './status';
import { moodMarkdown, moodSeries, moodSummary, parseFeelings, parseMood } from './wellbeing';
import { momentFor } from '../companion/mood';

const at = (h: number, m = 0, d = 30) => new Date(2026, 8, d, h, m).getTime();
const prefs = { units: 'ml', clock: '24h', dayStartHour: 0, babyName: 'Pip' } as const;

describe('parsing a mood', () => {
  it('takes 1–5 or a word', () => {
    expect([1, '2', ' 3 ', 5].map(parseMood)).toEqual([1, 2, 3, 5]);
    expect(['very low', 'very-low', 'Low', 'ok', 'okay', 'good', 'GREAT'].map(parseMood)).toEqual([1, 1, 2, 3, 3, 4, 5]);
    expect([0, 6, 2.5, '', 'sad', undefined, null].map(parseMood)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  it('takes feelings as a list or comma-separated, and reports unknown ones', () => {
    expect(parseFeelings('Anxious, tearful,anxious')).toEqual({ feelings: ['anxious', 'tearful'], bad: [] });
    expect(parseFeelings(['calm'])).toEqual({ feelings: ['calm'], bad: [] });
    expect(parseFeelings('happy,calm')).toEqual({ feelings: ['calm'], bad: ['happy'] });
    expect(parseFeelings(null)).toEqual({ feelings: [], bad: [] });
  });
});

describe('describing a check-in', () => {
  it('names the mood and any feelings', () => {
    expect(moodSummary(2, ['anxious', 'tearful'])).toBe('Low · anxious, tearful');
    expect(moodSummary(5, [])).toBe('Great');
    expect(summary(createEvent('mood', 0, { mood: 3, feelings: ['overwhelmed'] }, 0), prefs)).toBe('Okay · overwhelmed');
  });

  it('lists check-ins in a range, oldest first, skipping deleted and empty ones', () => {
    const a = createEvent('mood', at(20), { mood: 4 }, 0);
    const b = createEvent('mood', at(8), { mood: 2, note: ' rough night ' }, 0);
    const gone = patchEvent(createEvent('mood', at(9), { mood: 1 }, 0), { deleted: true }, 0);
    const empty = createEvent('mood', at(10), {}, 0);
    const yesterday = createEvent('mood', at(8, 0, 29), { mood: 5 }, 0);
    const pts = moodSeries([a, b, gone, empty, yesterday], at(0));
    expect(pts.map((p) => p.level)).toEqual([2, 4]);
    expect(pts[0].note).toBe('rough night');
  });
});

describe('the Parent mood card', () => {
  const now = at(21);
  const status = (events: ReturnType<typeof createEvent>[], day = '2026-09-30') => cardStatus(cardById('mood'), events, day, now, prefs);

  it('asks how you are until there is a check-in today', () => {
    expect(status([])).toEqual({ primary: 'How are you?', secondary: 'tap to check in', ongoing: false });
    // Yesterday's mood isn't carried onto today.
    expect(status([createEvent('mood', at(20, 0, 29), { mood: 1 }, 0)])).toMatchObject({ primary: 'How are you?', secondary: 'last check-in Sep 29' });
  });

  it("shows today's latest check-in", () => {
    const events = [createEvent('mood', at(8), { mood: 2 }, 0), createEvent('mood', at(19, 30), { mood: 4 }, 0)];
    expect(status(events)).toEqual({ primary: '🙂 Good', secondary: '19:30 · 2 today', ongoing: false });
    expect(status([events[0]], '2026-09-30')).toEqual({ primary: '😕 Low', secondary: '08:00', ongoing: false });
  });

  it("shows a past day's latest check-in", () => {
    const events = [createEvent('mood', at(8, 0, 28), { mood: 2 }, 0), createEvent('mood', at(18, 0, 28), { mood: 3 }, 0)];
    expect(status(events, '2026-09-28')).toEqual({ primary: '😐 Okay', secondary: '2 check-ins', ongoing: false });
    expect(status(events, '2026-09-27').primary).toBe('—');
  });
});

describe('mood and exports', () => {
  const events = [
    createEvent('feed', at(9), { method: 'bottle', amount: 90 }, 0),
    createEvent('mood', at(10), { mood: 2, feelings: ['anxious'], note: 'so tired' }, 0),
    createEvent('mood', at(9, 0, 28), { mood: 4 }, 0),
  ];

  it("keeps check-ins out of the baby's Markdown log", () => {
    const md = toMarkdown(events, {}, '2026-09-30', '2026-09-30', prefs, at(20));
    expect(md).toContain('Feed');
    expect(md).not.toContain('mood');
    expect(md).not.toContain('anxious');
    expect(toMarkdown([events[1]], {}, '2026-09-30', '2026-09-30', prefs, at(20))).toContain('_Nothing logged._');
  });

  it('has its own Markdown export, newest day first', () => {
    const md = moodMarkdown(events, '2026-09-28', '2026-09-30', prefs);
    expect(md).toMatch(/^# Mood check-ins · /);
    expect(md).toContain('- 10:00 😕 Low · anxious · so tired');
    expect(md).toContain('- 09:00 🙂 Good');
    expect(md.indexOf('## Wed, Sep 30')).toBeGreaterThan(0);
    expect(md.indexOf('## Wed, Sep 30')).toBeLessThan(md.indexOf('## Mon, Sep 28'));
    expect(md).not.toContain('Sep 29');
    expect(md).not.toContain('Feed');
    expect(moodMarkdown([], '2026-09-30', '2026-09-30', prefs)).toContain('_No check-ins._');
  });
});

describe('the companion on a check-in', () => {
  it('says the same kind of thing whatever the mood', () => {
    const opts = { dayStartHour: 0, name: 'Pip', buddy: 'Puff' };
    for (const mood of [1, 3, 5] as const) {
      const e = createEvent('mood', at(10), { mood }, at(10));
      const m = momentFor([e], 'mood', 'log', e, at(10), opts)!;
      expect(m.reaction).toBe('settled');
      expect(m.note).toMatch(/[Cc]heck|Noted/);
    }
  });
});
