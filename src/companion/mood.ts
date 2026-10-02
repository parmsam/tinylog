import type { CardId } from '../core/cards';
import { dayKey, eventsForDay } from '../core/days';
import { duration } from '../core/format';
import type { LogEvent } from '../core/types';
import type { Reaction } from './companion';

/**
 * How the companion's mood follows the clock and the day: a greeting for the time of day, a little
 * idle moment now and then, and a bigger reaction for moments worth noticing (waking up for the
 * morning, the longest sleep today, a round number of feeds). Pure, so it's tested on its own.
 * Same rules as the companion: descriptive and kind, never sad about anything missed, never advice.
 */

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

const MIN = 60_000;

/** Morning 5–12, afternoon 12–17, evening 17–21, night 21–5 (the night theme's hours, roughly). */
export function timeOfDay(ts: number): TimeOfDay {
  const h = new Date(ts).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

const STARTS: Record<TimeOfDay, number> = { morning: 5, afternoon: 12, evening: 17, night: 21 };

/** When the part of the day `ts` falls in began (night starts the evening before). */
export function periodStart(ts: number): number {
  const d = new Date(ts);
  const tod = timeOfDay(ts);
  if (tod === 'night' && d.getHours() < STARTS.morning) d.setDate(d.getDate() - 1);
  d.setHours(STARTS[tod], 0, 0, 0);
  return d.getTime();
}

/** "Good morning from Puff"; a quieter hello at night. */
export function greeting(label: string, tod: TimeOfDay): string {
  switch (tod) {
    case 'morning':
      return `Good morning from ${label}`;
    case 'evening':
      return `Good evening from ${label}`;
    case 'night':
      return `Shh… hi from ${label}`;
    default:
      return `Hi from ${label}`;
  }
}

/** A small thing to do while nothing's happening: a stretch in the morning, a look around, a yawn in the evening. Nothing at night. */
export function idleBit(tod: TimeOfDay): Reaction | undefined {
  const bits: Record<TimeOfDay, Reaction | undefined> = { morning: 'stretch', afternoon: 'look', evening: 'yawn', night: undefined };
  return bits[tod];
}

/** One of a few lines, picked by a number from the day so it varies but stays the same for the same log. */
const pick = (lines: string[], seed: number) => lines[Math.abs(seed) % lines.length];

const HELLO: Record<TimeOfDay, { reaction: Reaction; lines: string[] }> = {
  morning: { reaction: 'morning', lines: ['Good morning{to}!', 'Rise and shine{to}', 'Morning{to}! Coffee first?'] },
  afternoon: { reaction: 'cheer', lines: ['Good afternoon{to}', 'Afternoon{to}! Still going strong', 'Hello, afternoon crew'] },
  evening: { reaction: 'cheer', lines: ['Good evening{to}', 'Evening{to}! Pajama o’clock soon', 'The evening shift has arrived'] },
  night: { reaction: 'goodnight', lines: ['Night shift · cozy and quiet', 'Shh… the moon is up too', 'Night owls club · {buddy} is here'] },
};

export interface Moment {
  reaction: Reaction;
  /** Shown in the companion's line for a few seconds. */
  note: string;
}

/**
 * A moment worth a bigger reaction, given what was just logged (`event`, after the change) and
 * everything else. Only for today: filling in a past day doesn't count. Lines are meant to be
 * cute or a little funny, never a judgment; most don't need sleep to be tracked.
 */
export function momentFor(
  events: LogEvent[],
  card: CardId,
  what: 'log' | 'start' | 'stop',
  event: LogEvent,
  now: number,
  opts: { dayStartHour: number; name: string; buddy: string },
): Moment | undefined {
  const day = dayKey(now, opts.dayStartHour);
  const when = what === 'stop' ? (event.endAt ?? now) : event.at;
  if (dayKey(when, opts.dayStartHour) !== day) return undefined;
  const tod = timeOfDay(when);
  const todays = eventsForDay(events, day, opts.dayStartHour, now);
  const fill = (line: string) => line.replace('{to}', opts.name ? `, ${opts.name}` : '').replace('{name}', opts.name || 'baby').replace('{buddy}', opts.buddy);
  const say = (reaction: Reaction, lines: string[]): Moment => ({ reaction, note: fill(pick(lines, todays.length)) });
  const length = event.endAt !== undefined ? event.endAt - event.at : 0;
  const isSleep = card === 'nap' || card === 'night';
  const counted = events.filter((e) => !e.deleted && e.type !== 'note');

  if (card === 'night' && what === 'stop' && tod === 'morning')
    return say('morning', [`Good morning{to}! Slept ${duration(length)}`, `Rise and shine{to} · ${duration(length)} of zzz`]);
  if (card === 'night' && what === 'start' && (tod === 'evening' || tod === 'night'))
    return say('goodnight', ['Goodnight{to} · sweet dreams', 'Nighty night{to}', 'Off to dreamland{to}']);

  if (isSleep && what === 'stop' && length >= 45 * MIN) {
    const others = todays.filter((e) => e.type === 'sleep' && e.endAt !== undefined && e.id !== event.id);
    if (others.length && others.every((e) => e.endAt! - e.at < length))
      return say('proud', [`Longest sleep today · ${duration(length)}`, `Longest sleep today · ${duration(length)} · {buddy} took notes`]);
  }
  if (card === 'fussy' && what === 'stop' && length >= 20 * MIN) return say('cheer', [`Calm again after ${duration(length)} · high five`, `Calm again after ${duration(length)} · phew!`]);

  if (what === 'log' && card === 'feed') {
    const count = todays.filter((e) => e.type === 'feed').length;
    if (count && count % 5 === 0) return say('cheer', [`${count} feeds today · tiny but hungry`, `${count} feeds today · a pro snacker`]);
  }
  if (what === 'log' && (card === 'wet' || card === 'dirty')) {
    const diapers = todays.filter((e) => e.type === 'diaper');
    if (diapers.length && diapers.length % 5 === 0) return say('cheer', [`${diapers.length} diapers today · keeping things moving`, `${diapers.length} diapers today · a true diaper dynamo`]);
    const dirty = diapers.filter((e) => e.detail?.diaper === 'dirty' || e.detail?.diaper === 'both');
    if (card === 'dirty' && dirty.length === 1) return say('cheer', ['First poop of the day · delivered!', 'Poop o’clock · well done, {name}']);
  }
  if (what === 'log' && card === 'bath') return say('cheer', ['Squeaky clean{to}!', 'Fresh as a daisy{to}', 'Bath done · {buddy} wants one too']);
  if (card === 'tummy' && what === 'stop' && length >= 3 * MIN) return say('proud', [`Tummy time champ · ${duration(length)}`, `${duration(length)} of tummy time · strong little arms`]);

  // The fifth thing logged within an hour: a busy stretch.
  if (what !== 'stop') {
    const lately = counted.filter((e) => e.createdAt > now - 60 * MIN && e.createdAt <= now);
    if (lately.length === 5) return say('cheer', ["Busy hour · you've got this", 'Busy hour · {buddy} is impressed']);
  }

  // The first entry this morning, afternoon, evening or night gets a hello. Works with whatever
  // gets logged, so it doesn't depend on tracking sleep.
  const start = periodStart(when);
  const inPeriod = (t: number | undefined) => t !== undefined && t >= start && t <= when;
  if (!counted.some((e) => e.id !== event.id && (inPeriod(e.at) || inPeriod(e.endAt)))) return say(HELLO[tod].reaction, HELLO[tod].lines);
  return undefined;
}

const SHARED_TAP_LINES = ['Hehe', 'Hi there!', "You're doing great", 'Hello, hello!'];
const TAP_REACTIONS: Reaction[] = ['giggle', 'cheer', 'look', 'giggle', 'stretch'];
/** Taps this close together count as tickling. */
export const TICKLE_TAPS = 5;
export const TICKLE_MS = 3000;

/**
 * What the companion does on its `n`th tap (0-based): its own lines and a few shared ones, taking
 * turns so taps don't repeat back to back. A quick flurry of taps tickles.
 */
export function tapMoment(own: string[], n: number, tickled: boolean): Moment {
  if (tickled) return { reaction: 'proud', note: 'Hehe, that tickles!' };
  const lines = own.flatMap((l, i) => [l, SHARED_TAP_LINES[i % SHARED_TAP_LINES.length]]).concat(SHARED_TAP_LINES.slice(own.length));
  return { reaction: TAP_REACTIONS[n % TAP_REACTIONS.length], note: lines[n % lines.length] };
}

/** Coin milestones (all-time), celebrated with a line. */
export function milestoneMoment(coins: number, buddy: string): Moment {
  if (coins === 1) return { reaction: 'proud', note: `Your first coin! ${buddy} is keeping count` };
  return { reaction: 'proud', note: pick([`${coins.toLocaleString()} coins! ${buddy} is so proud`, `${coins.toLocaleString()} coins! Look at you go`], coins) };
}
