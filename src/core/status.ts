import { lastFor, lastWake, nextUpcoming, ongoingFor, type CardDef } from './cards';
import { dayKey, dayRange, overlap } from './days';
import { ago, amount, clockTime, duration, shortDate, stopwatch, until } from './format';
import type { LogEvent, Settings } from './types';

type Prefs = Pick<Settings, 'units' | 'clock' | 'dayStartHour'>;

const SIDE = { L: 'L', R: 'R', both: 'both sides' } as const;

/** One-line description of an event's details, e.g. "Bottle · 90 ml · formula". */
export function summary(e: LogEvent, prefs: Pick<Settings, 'units'>): string {
  const d = e.detail ?? {};
  const bits: string[] = [];
  switch (e.type) {
    case 'feed':
      if (d.method === 'bottle') {
        bits.push('Bottle');
        if (d.amount) bits.push(amount(d.amount, prefs.units));
        if (d.milk) bits.push(d.milk === 'formula' ? 'formula' : 'breast milk');
      } else {
        bits.push('Breast');
        if (d.side) bits.push(SIDE[d.side]);
      }
      break;
    case 'diaper':
      bits.push(d.diaper === 'both' ? 'Wet + dirty' : d.diaper === 'dirty' ? 'Dirty' : 'Wet');
      break;
    case 'pump':
      if (d.side) bits.push(SIDE[d.side]);
      if (d.amount) bits.push(amount(d.amount, prefs.units));
      break;
  }
  return bits.join(' · ');
}

export interface CardStatus {
  primary: string;
  secondary: string;
  ongoing: boolean;
}

/** Events that started within a day. */
function startedIn(events: LogEvent[], card: CardDef, start: number, end: number) {
  return events.filter((e) => !e.deleted && card.matches(e) && e.at >= start && e.at < end);
}

function totalIn(events: LogEvent[], card: CardDef, start: number, end: number, now: number) {
  return events.filter((e) => !e.deleted && card.matches(e)).reduce((ms, e) => ms + overlap(e, start, end, now), 0);
}

function sumAmount(events: LogEvent[]) {
  return events.reduce((ml, e) => ml + (e.detail?.amount ?? 0), 0);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What a card shows. Today it's "when did we last…"; on a past day it's that day's totals. */
export function cardStatus(card: CardDef, events: LogEvent[], day: string, now: number, prefs: Prefs): CardStatus {
  const [start, end] = dayRange(day, prefs.dayStartHour);
  const isToday = dayKey(now, prefs.dayStartHour) === day;
  const inDay = startedIn(events, card, start, end);
  const t = (ts: number) => clockTime(ts, prefs.clock);

  if (!isToday) return pastStatus(card, events, inDay, start, end, now, prefs);

  const on = card.timed ? ongoingFor(events, card) : undefined;
  if (on) {
    const elapsed = now - on.at;
    const primary = card.type === 'sleep' ? `asleep ${duration(elapsed)}` : stopwatch(elapsed);
    return { primary, secondary: `since ${t(on.at)} · tap to stop`, ongoing: true };
  }

  const last = lastFor(events, card, now);
  switch (card.id) {
    case 'feed': {
      if (!last) return { primary: 'Tap to log', secondary: 'hold for bottle or side', ongoing: false };
      const side = last.detail?.method !== 'bottle' ? last.detail?.side : undefined;
      const next = side === 'L' ? ' · next R' : side === 'R' ? ' · next L' : '';
      return { primary: ago(last.at, now), secondary: `${t(last.at)} · ${summary(last, prefs)}${next}`, ongoing: false };
    }
    case 'wet':
    case 'dirty':
      if (!last) return { primary: 'Tap to log', secondary: '', ongoing: false };
      return { primary: ago(last.at, now), secondary: `${t(last.at)} · ${inDay.length} today`, ongoing: false };
    case 'nap': {
      const wake = lastWake(events, now);
      const napTotal = totalIn(events, card, start, end, now);
      const secondary = inDay.length ? `${plural(inDay.length, 'nap')} · ${duration(napTotal)} today` : 'tap to start';
      return { primary: wake !== undefined ? `awake ${duration(now - wake)}` : 'Tap to start', secondary, ongoing: false };
    }
    case 'night':
      if (!last || last.endAt === undefined) return { primary: 'Tap at bedtime', secondary: '', ongoing: false };
      return {
        primary: duration(last.endAt - last.at),
        secondary: `last night · woke ${t(last.endAt)}`,
        ongoing: false,
      };
    case 'tummy': {
      const total = totalIn(events, card, start, end, now);
      return {
        primary: total ? `${duration(total)} today` : 'None yet today',
        secondary: last ? `last ${ago(last.endAt ?? last.at, now)}` : 'tap to start',
        ongoing: false,
      };
    }
    case 'pump': {
      if (!last) return { primary: 'Tap to start', secondary: '', ongoing: false };
      const ml = sumAmount(inDay);
      const info = summary(last, prefs);
      return {
        primary: ago(last.endAt ?? last.at, now),
        secondary: [info, ml ? `${amount(ml, prefs.units)} today` : ''].filter(Boolean).join(' · '),
        ongoing: false,
      };
    }
    case 'bath':
      return last ? { primary: ago(last.at, now), secondary: t(last.at), ongoing: false } : { primary: 'Tap to log', secondary: '', ongoing: false };
    case 'doctor': {
      const next = nextUpcoming(events, card, now);
      if (next) return { primary: until(next.at, now), secondary: next.detail?.note || shortDate(next.at), ongoing: false };
      if (last) return { primary: `last ${shortDate(last.at)}`, secondary: last.detail?.note ?? '', ongoing: false };
      return { primary: 'Add a visit', secondary: '', ongoing: false };
    }
  }
}

function pastStatus(
  card: CardDef,
  events: LogEvent[],
  inDay: LogEvent[],
  start: number,
  end: number,
  now: number,
  prefs: Prefs,
): CardStatus {
  const n = inDay.length;
  const none = { primary: '—', secondary: 'tap to add', ongoing: false };
  switch (card.id) {
    case 'feed': {
      if (!n) return none;
      const ml = sumAmount(inDay.filter((e) => e.detail?.method === 'bottle'));
      return { primary: plural(n, 'feed'), secondary: ml ? `${amount(ml, prefs.units)} by bottle` : '', ongoing: false };
    }
    case 'wet':
    case 'dirty':
      return n ? { primary: plural(n, 'diaper'), secondary: '', ongoing: false } : none;
    case 'nap':
    case 'night':
    case 'tummy': {
      const total = totalIn(events, card, start, end, now);
      if (!total && !n) return none;
      return { primary: duration(total), secondary: card.id === 'nap' ? plural(n, 'nap') : '', ongoing: false };
    }
    case 'pump': {
      if (!n) return none;
      const ml = sumAmount(inDay);
      return { primary: plural(n, 'session'), secondary: ml ? amount(ml, prefs.units) : '', ongoing: false };
    }
    case 'bath':
      return n ? { primary: 'Bath ✓', secondary: '', ongoing: false } : none;
    case 'doctor':
      return n ? { primary: plural(n, 'visit'), secondary: inDay[0].detail?.note ?? '', ongoing: false } : none;
  }
}
