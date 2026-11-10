import { describe, expect, it } from 'vitest';
import { createEvent } from '../core/events';
import { moodHtml } from './moodChart';

const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime();
const prefs = { clock: '24h', dayStartHour: 0 } as const;

describe('mood chart', () => {
  it('says how to start when there are no check-ins in the range', () => {
    const old = createEvent('mood', at(1, 9), { mood: 3 }, 0);
    expect(moodHtml([old], '2026-10-20', 7, prefs)).toContain('Tap 🌷 Parent mood');
  });

  it('draws a dot with a tooltip per check-in, and a table row for each, newest first', () => {
    const events = [createEvent('mood', at(18, 9), { mood: 2, feelings: ['anxious', 'lonely'] }, 0), createEvent('mood', at(20, 21), { mood: 4 }, 0)];
    const doc = new DOMParser().parseFromString(moodHtml(events, '2026-10-20', 7, prefs), 'text/html');
    expect(doc.querySelectorAll('.mood-chart [data-tip]')).toHaveLength(2);
    expect(doc.querySelector('.mood-chart [data-tip]')!.getAttribute('data-tip')).toBe('😕 Oct 18 09:00 · Low · anxious, lonely');
    const rows = [...doc.querySelectorAll('.mood-table tbody tr')].map((r) => r.textContent);
    expect(rows).toEqual(['Oct 20 · 21:00🙂 Good—', 'Oct 18 · 09:00😕 LowAnxious, Lonely']);
    expect(doc.body.textContent).toContain('2 check-ins in the last 7 days');
  });
});
