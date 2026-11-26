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

  it('takes a dirty diaper\'s color and size, only on a dirty one', () => {
    expect(p('?do=log&what=dirty&color=green&size=small')).toEqual({ kind: 'log', card: 'dirty', detail: { poopColor: 'green', poopAmount: 'small' }, minutesAgo: 0 });
    expect(p('?do=log&what=both&color=Yellow')).toMatchObject({ card: 'dirty', detail: { diaper: 'both', poopColor: 'yellow' } });
    expect(p('?do=log&what=diaper&diaper=dirty&size=large')).toMatchObject({ detail: { diaper: 'dirty', poopAmount: 'large' } });
    expect(p('?do=log&what=wet&color=green')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('dirty diaper') });
    expect(p('?do=log&what=dirty&color=purple')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('color is') });
    expect(p('?do=log&what=dirty&size=huge')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('size is') });
    expect(stripLinkAction('https://x.test/tinylog/?do=log&what=dirty&color=green&size=small&keep=1')).toBe('/tinylog/?keep=1');
  });

  it('logs spit-ups and books by their everyday names', () => {
    expect(p('?do=log&what=spit-up')).toMatchObject({ kind: 'log', card: 'spitup' });
    expect(p('?do=log&what=spit up')).toMatchObject({ card: 'spitup' });
    expect(p('?do=log&what=book&ago=5')).toMatchObject({ card: 'books', minutesAgo: 5 });
    expect(p('?do=log&what=reading')).toMatchObject({ card: 'books' });
    for (const w of ['music', 'song', 'sing', 'lullaby']) expect(p(`?do=log&what=${w}`)).toMatchObject({ card: 'music' });
  });

  it('takes a weight or height in whatever unit it was given', () => {
    expect(p('?do=log&what=weight&kg=7.2')).toMatchObject({ card: 'weight', detail: { grams: 7200 } });
    expect(p('?do=log&what=weight&g=6400')).toMatchObject({ card: 'weight', detail: { grams: 6400 } });
    // On a weight, oz is weight, not a bottle volume.
    const lbOz = p('?do=log&what=weight&lb=15&oz=14');
    expect(lbOz).toMatchObject({ card: 'weight' });
    expect(lbOz && 'detail' in lbOz && lbOz.detail.amount).toBeFalsy();
    expect(lbOz && 'detail' in lbOz && Math.round(lbOz.detail.grams!)).toBe(7201);
    expect(p('?do=log&what=weigh-in&oz=12')).toMatchObject({ card: 'weight' });
    expect(p('?do=log&what=height&cm=62')).toMatchObject({ card: 'height', detail: { cm: 62 } });
    expect(p('?do=log&what=length&in=24.5')).toMatchObject({ card: 'height', detail: { cm: 62.23 } });
  });

  it('explains weight and height mistakes', () => {
    expect(p('?do=log&what=weight')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('say the weight') });
    expect(p('?do=log&what=weight&kg=72')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('looks off') });
    expect(p('?do=log&what=weight&kg=abc')).toMatchObject({ kind: 'invalid' });
    expect(p('?do=log&what=height')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('say the height') });
    expect(p('?do=log&what=feed&kg=3')).toMatchObject({ kind: 'invalid', reason: 'kg, g and lb are for weight' });
    expect(p('?do=log&what=wet&cm=3')).toMatchObject({ kind: 'invalid', reason: 'cm and in are for height' });
    expect(stripLinkAction('https://x.test/tinylog/?do=log&what=weight&lb=15&oz=14&keep=1')).toBe('/tinylog/?keep=1');
  });

  it('takes a mood check-in with optional feelings', () => {
    expect(p('?do=log&what=mood&mood=2')).toMatchObject({ card: 'mood', detail: { mood: 2 } });
    expect(p('?do=log&what=check-in&mood=very-low&feelings=anxious,Tearful')).toMatchObject({ card: 'mood', detail: { mood: 1, feelings: ['anxious', 'tearful'] } });
    expect(p('?do=log&what=my mood&mood=great')).toMatchObject({ card: 'mood', detail: { mood: 5 } });
    expect(p('?do=log&what=parent-mood&mood=ok')).toMatchObject({ card: 'mood', detail: { mood: 3 } });
    expect(stripLinkAction('https://x.test/tinylog/?do=log&what=mood&mood=3&feelings=calm&keep=1')).toBe('/tinylog/?keep=1');
  });

  it('explains mood mistakes', () => {
    expect(p('?do=log&what=mood')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('say the mood') });
    expect(p('?do=log&what=mood&mood=7')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('say the mood') });
    expect(p('?do=log&what=mood&mood=3&feelings=happy')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('feelings are calm') });
    expect(p('?do=log&what=wet&mood=3')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('mood check-in') });
  });

  it('takes a medicine by name, with an optional dose', () => {
    expect(p('?do=log&what=medicine&name=Vitamin+D&dose=1&unit=drops')).toMatchObject({ card: 'med', detail: { med: 'Vitamin D', dose: 1, doseUnit: 'drops' } });
    expect(p('?do=log&what=med&name=Gripe%20water')).toEqual({ kind: 'log', card: 'med', detail: { med: 'Gripe water' }, minutesAgo: 0 });
    // &ml on a medicine is its dose, not a bottle.
    const ml = p('?do=log&what=medication&name=Paracetamol&ml=2.5');
    expect(ml).toMatchObject({ card: 'med', detail: { med: 'Paracetamol', dose: 2.5, doseUnit: 'ml' } });
    expect(ml && 'detail' in ml && ml.detail.amount).toBeUndefined();
    // A bare vitamin link is just "Vitamin", never guessed further.
    expect(p('?do=log&what=vitamin')).toMatchObject({ card: 'med', detail: { med: 'Vitamin' } });
    expect(stripLinkAction('https://x.test/tinylog/?do=log&what=med&name=A&dose=1&unit=ml&keep=1')).toBe('/tinylog/?keep=1');
  });

  it('explains medicine mistakes', () => {
    expect(p('?do=log&what=medicine')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('which medicine') });
    expect(p('?do=log&what=medicine&name=A&dose=lots')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('dose must be a number') });
    expect(p('?do=log&what=medicine&name=A&dose=1&unit=tsp')).toMatchObject({ kind: 'invalid', reason: 'unit is ml, drops or mg' });
    expect(p('?do=log&what=wet&name=A')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('for a medicine') });
  });

  it('takes a temperature in °C or °F, and where', () => {
    expect(p('?do=log&what=temp&c=37.8&site=ear')).toEqual({ kind: 'log', card: 'temp', detail: { tempC: 37.8, tempSite: 'ear' }, minutesAgo: 0 });
    expect(p('?do=log&what=fever&f=100.4')).toMatchObject({ card: 'temp', detail: { tempC: 38 } });
    expect(p('?do=log&what=temperature')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('say the reading') });
    expect(p('?do=log&what=temp&c=99')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('looks off') });
    expect(p('?do=log&what=temp&c=hot')).toMatchObject({ kind: 'invalid', reason: 'temperature must be a number' });
    expect(p('?do=log&what=temp&c=37&site=toe')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('site is') });
    expect(p('?do=log&what=wet&c=37')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('for a temperature') });
    expect(stripLinkAction('https://x.test/tinylog/?do=log&what=temp&c=37&site=ear&keep=1')).toBe('/tinylog/?keep=1');
  });

  it('takes vaccines, with or without names', () => {
    expect(p('?do=log&what=vaccines&vaccines=DTaP,Hib,%20PCV')).toEqual({ kind: 'log', card: 'vaccine', detail: { vaccines: ['DTaP', 'Hib', 'PCV'] }, minutesAgo: 0 });
    expect(p('?do=log&what=shots')).toEqual({ kind: 'log', card: 'vaccine', detail: {}, minutesAgo: 0 });
    expect(p('?do=log&what=immunization&vaccines=MMR')).toMatchObject({ card: 'vaccine', detail: { vaccines: ['MMR'] } });
    expect(p('?do=log&what=wet&vaccines=MMR')).toMatchObject({ kind: 'invalid', reason: expect.stringContaining('&what=vaccines') });
    expect(stripLinkAction('https://x.test/tinylog/?do=log&what=vaccine&vaccines=A&keep=1')).toBe('/tinylog/?keep=1');
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

  it('takes where a sleep happened, by everyday names', () => {
    expect(p('?do=start&what=nap&where=bassinet')).toMatchObject({ kind: 'start', card: 'nap', detail: { where: 'bassinet' } });
    expect(p('?do=stop&what=sleep&where=held')).toMatchObject({ card: 'nap', detail: { where: 'contact' } });
    expect(p('?do=toggle&what=night&where=Car Seat')).toMatchObject({ detail: { where: 'car' } });
    expect(p('?do=start&what=nap&where=sofa')).toMatchObject({ kind: 'invalid' });
    expect(p('?do=log&what=wet&where=crib')).toMatchObject({ kind: 'invalid' });
    expect(stripLinkAction('https://x.test/tinylog/?do=start&what=nap&where=crib')).toBe('/tinylog/');
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
