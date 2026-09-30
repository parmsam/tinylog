import { describe, expect, it } from 'vitest';
import { parseLinkAction, sleepCardAt, stripLinkAction } from './linkActions';

const noon = new Date(2026, 8, 30, 12).getTime();
const p = (q: string) => parseLinkAction(q, noon);

describe('parseLinkAction', () => {
  it('ignores links without an action', () => {
    expect(p('')).toBeNull();
    expect(p('?utm_source=x')).toBeNull();
  });

  it('logs diapers, including both', () => {
    expect(p('?do=log&what=wet')).toEqual({ kind: 'log', card: 'wet', detail: {}, minutesAgo: 0 });
    expect(p('?do=log&what=poop')).toMatchObject({ card: 'dirty' });
    expect(p('?do=log&what=both')).toMatchObject({ card: 'dirty', detail: { diaper: 'both' } });
  });

  it('understands feed details and amounts', () => {
    expect(p('?do=log&what=bottle&oz=3&milk=formula')).toMatchObject({ card: 'feed', detail: { method: 'bottle', amount: 89, milk: 'formula' } });
    expect(p('?do=log&what=feed&ml=90')).toMatchObject({ detail: { method: 'bottle', amount: 90 } });
    expect(p('?do=log&what=breast&side=left')).toMatchObject({ detail: { method: 'breast', side: 'L' } });
  });

  it('takes breastfeeding length per side or as a total', () => {
    expect(p('?do=log&what=feed&minl=12&minr=8')).toMatchObject({ detail: { method: 'breast', side: 'both', minL: 12, minR: 8 } });
    expect(p('?do=log&what=feed&minl=10')).toMatchObject({ detail: { side: 'L', minL: 10 } });
    expect(p('?do=log&what=breast&side=both&min=20')).toMatchObject({ detail: { side: 'both', min: 20 } });
    expect(p('?do=log&what=feed&min=0')).toMatchObject({ kind: 'invalid' });
  });

  it('starts, stops and toggles timed things, with an optional "ago"', () => {
    expect(p('?do=toggle&what=nap')).toMatchObject({ kind: 'toggle', card: 'nap' });
    expect(p('?do=start&what=tummy&ago=10')).toMatchObject({ kind: 'start', card: 'tummy', minutesAgo: 10 });
    expect(p('?do=stop&what=pump&ml=120&side=both')).toMatchObject({ kind: 'stop', card: 'pump', detail: { amount: 120, side: 'both' } });
  });

  it('"sleep" is a nap by day and night sleep in the evening', () => {
    expect(p('?do=toggle&what=sleep')).toMatchObject({ card: 'nap' });
    expect(sleepCardAt(new Date(2026, 8, 30, 20).getTime())).toBe('night');
    expect(sleepCardAt(new Date(2026, 8, 30, 3).getTime())).toBe('night');
  });

  it('explains bad links instead of guessing', () => {
    expect(p('?do=dance&what=wet')).toMatchObject({ kind: 'invalid' });
    expect(p('?do=log')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('what=') });
    expect(p('?do=log&what=unicorn')).toMatchObject({ kind: 'invalid' });
    expect(p('?do=log&what=wet&ago=-5')).toMatchObject({ kind: 'invalid' });
    expect(p('?do=log&what=feed&ml=lots')).toMatchObject({ kind: 'invalid' });
    expect(p('?do=log&what=feed&side=up')).toMatchObject({ kind: 'invalid' });
  });

  it('caps notes', () => {
    const a = p(`?do=log&what=doctor&note=${'x'.repeat(500)}`);
    expect(a?.kind === 'log' && a.detail.note?.length).toBe(300);
  });
});

describe('stripLinkAction', () => {
  it('removes only the action parameters', () => {
    expect(stripLinkAction('https://x.dev/tinylog/?do=log&what=wet&ml=3&keep=1#top')).toBe('/tinylog/?keep=1#top');
  });
});
