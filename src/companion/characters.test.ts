import { describe, expect, it } from 'vitest';
import { addDays } from '../core/days';
import { BASE_IDS, CHARACTERS, characterSvg, companionForDay } from './characters';

describe('companionForDay ("Surprise me")', () => {
  const days = Array.from({ length: 400 }, (_, i) => addDays('2026-01-01', i));
  const picks = days.map((d) => companionForDay(d));

  it('is the same pick for the same day', () => {
    expect(companionForDay('2026-10-03')).toBe(companionForDay('2026-10-03'));
  });

  it('never repeats on consecutive days', () => {
    for (let i = 1; i < picks.length; i++) expect(picks[i], days[i]).not.toBe(picks[i - 1]);
  });

  it('brings out every character, about evenly', () => {
    const counts = new Map<string, number>();
    for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual([...BASE_IDS].sort());
    for (const n of counts.values()) expect(Math.abs(n - picks.length / BASE_IDS.length)).toBeLessThanOrEqual(BASE_IDS.length);
  });

  it('works across a DST change and before 1970', () => {
    expect(companionForDay('2026-03-08')).not.toBe(companionForDay('2026-03-09'));
    expect(BASE_IDS).toContain(companionForDay('1969-12-31'));
  });
});

describe('companionForDay with unlocked specials', () => {
  it('brings them into the rotation, still never two days running', () => {
    const pool = [...BASE_IDS, 'star', 'unicorn'] as const;
    const picks = Array.from({ length: 90 }, (_, i) => companionForDay(addDays('2026-01-01', i), [...pool]));
    expect(picks).toContain('star');
    expect(picks).toContain('unicorn');
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
  });
  it('a pool of one is just that one', () => {
    expect(companionForDay('2026-10-03', ['bee'])).toBe('bee');
  });
});

describe('characterSvg accessories', () => {
  const acc = (svg: string) => [...svg.matchAll(/data-acc="(\w+)"/g)].map((m) => m[1]);
  it('puts on what is worn, one per slot (the last wins)', () => {
    expect(acc(characterSvg('puff', { wearing: ['bowtie', 'partyhat', 'crown'] })).sort()).toEqual(['bowtie', 'crown']);
  });
  it('sits a hat on the head anchor and a bow tie on the neck', () => {
    const svg = characterSvg('sadie', { wearing: ['crown', 'bowtie'] });
    expect(svg).toContain('data-acc="crown" transform="translate(60 27)"');
    expect(svg).toContain('data-acc="bowtie" transform="translate(60 66)"');
  });
  it('skips hats on characters that already wear something on their head', () => {
    expect(acc(characterSvg('moon', { wearing: ['partyhat', 'bowtie'] }))).toEqual(['bowtie']);
    expect(acc(characterSvg('unicorn', { wearing: ['flowers'] }))).toEqual([]);
  });
  it('draws the rainbow behind the character', () => {
    const svg = characterSvg('bee', { wearing: ['rainbow'] });
    expect(svg.indexOf('data-acc="rainbow"')).toBeLessThan(svg.indexOf('p-body'));
  });
  it('every character has a neck, and the contract parts', () => {
    for (const c of CHARACTERS) {
      expect(c.neck).toHaveLength(2);
      for (const part of ['p-eyes', 'p-closed', 'p-smile', 'p-o', 'p-wince', 'p-sweat', 'p-cheek']) expect(c.body, `${c.id} ${part}`).toContain(part);
    }
  });
});
