import { describe, expect, it } from 'vitest';
import { createEvent } from './events';
import { diaperKind, parsePoopAmount, parsePoopColor, poopSummary } from './poop';
import { entryLabel, entrySummary, summary } from './status';
import { cardById } from './cards';

const prefs = { units: 'ml' } as const;

describe('dirty diaper detail', () => {
  it('reads colors and amounts by their everyday names', () => {
    expect(parsePoopColor(' Green ')).toBe('green');
    expect(parsePoopColor('grey')).toBe('white');
    expect(parsePoopColor('mustard')).toBe('yellow');
    expect(parsePoopColor('purple')).toBeUndefined();
    expect(parsePoopAmount('Blowout')).toBe('large');
    expect(parsePoopAmount('little')).toBe('small');
    expect(parsePoopAmount('')).toBeUndefined();
  });

  it('summarises color and amount, only for a dirty one', () => {
    expect(poopSummary({ diaper: 'dirty', poopColor: 'green', poopAmount: 'small' })).toBe('green · small');
    expect(poopSummary({ diaper: 'both', poopColor: 'white' })).toBe('white / grey');
    expect(poopSummary({ diaper: 'dirty' })).toBe('');
    expect(poopSummary({ diaper: 'wet', poopColor: 'green' })).toBe('');
    expect(diaperKind({ diaper: 'both' })).toBe('Wet + dirty');
    expect(diaperKind(undefined)).toBe('Wet');
  });

  it('titles the entry by kind and puts the detail beside it', () => {
    const e = createEvent('diaper', 0, { diaper: 'dirty', poopColor: 'yellow', poopAmount: 'large' }, 0);
    expect(summary(e, prefs)).toBe('Dirty · yellow · large');
    expect(entryLabel(e, cardById('dirty'))).toBe('Dirty diaper');
    expect(entrySummary(e, prefs)).toBe('yellow · large');
    expect(entrySummary(createEvent('diaper', 0, { diaper: 'wet' }, 0), prefs)).toBe('');
  });
});
