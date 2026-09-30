import type { Detail, EventType, LogEvent } from './types';

/** A home-screen card: one tappable thing to log. Several cards can share an event type (wet/dirty, nap/night). */
export interface CardDef {
  id: CardId;
  label: string;
  emoji: string;
  type: EventType;
  /** Detail a new event from this card starts with. */
  preset?: Detail;
  timed: boolean;
  /** Tapping opens the sheet instead of logging straight away. */
  sheetFirst?: boolean;
  /** Does an event belong to this card? */
  matches(e: LogEvent): boolean;
  key: string;
}

export type CardId = 'feed' | 'wet' | 'dirty' | 'nap' | 'night' | 'tummy' | 'pump' | 'fussy' | 'bath' | 'doctor';

const of = (type: EventType) => (e: LogEvent) => e.type === type;

export const CARDS: readonly CardDef[] = [
  { id: 'feed', label: 'Feed', emoji: '🍼', type: 'feed', timed: false, matches: of('feed'), key: 'f' },
  {
    id: 'wet',
    label: 'Wet',
    emoji: '💧',
    type: 'diaper',
    preset: { diaper: 'wet' },
    timed: false,
    matches: (e) => e.type === 'diaper' && e.detail?.diaper !== 'dirty',
    key: 'w',
  },
  {
    id: 'dirty',
    label: 'Dirty',
    emoji: '💩',
    type: 'diaper',
    preset: { diaper: 'dirty' },
    timed: false,
    matches: (e) => e.type === 'diaper' && (e.detail?.diaper === 'dirty' || e.detail?.diaper === 'both'),
    key: 'd',
  },
  {
    id: 'nap',
    label: 'Nap',
    emoji: '😴',
    type: 'sleep',
    preset: { sleep: 'nap' },
    timed: true,
    matches: (e) => e.type === 'sleep' && e.detail?.sleep !== 'night',
    key: 'n',
  },
  {
    id: 'night',
    label: 'Night sleep',
    emoji: '🌙',
    type: 'sleep',
    preset: { sleep: 'night' },
    timed: true,
    matches: (e) => e.type === 'sleep' && e.detail?.sleep === 'night',
    key: 's',
  },
  { id: 'tummy', label: 'Tummy time', emoji: '🤸', type: 'tummy', timed: true, matches: of('tummy'), key: 't' },
  { id: 'pump', label: 'Pump', emoji: '🫗', type: 'pump', timed: true, matches: of('pump'), key: 'p' },
  { id: 'fussy', label: 'Fussy', emoji: '😣', type: 'fussy', timed: true, matches: of('fussy'), key: 'c' },
  { id: 'bath', label: 'Bath', emoji: '🛁', type: 'bath', timed: false, matches: of('bath'), key: 'b' },
  { id: 'doctor', label: 'Doctor', emoji: '🩺', type: 'doctor', timed: false, sheetFirst: true, matches: of('doctor'), key: 'o' },
];

export const cardById = (id: CardId) => CARDS.find((c) => c.id === id)!;

/** The card an event is shown under (for its emoji, label and color). */
export function cardFor(e: LogEvent): CardDef | undefined {
  if (e.type === 'diaper') return cardById(e.detail?.diaper === 'wet' || !e.detail?.diaper ? 'wet' : 'dirty');
  return CARDS.find((c) => c.matches(e));
}

/** Most recent event for a card that has started by `now` (future doctor visits don't count). */
export function lastFor(events: LogEvent[], card: CardDef, now: number): LogEvent | undefined {
  let best: LogEvent | undefined;
  for (const e of events) {
    if (e.deleted || e.at > now || !card.matches(e)) continue;
    if (!best || e.at > best.at) best = e;
  }
  return best;
}

export function ongoingFor(events: LogEvent[], card: CardDef): LogEvent | undefined {
  return events.find((e) => !e.deleted && card.matches(e) && e.endAt === undefined && card.timed);
}

export function nextUpcoming(events: LogEvent[], card: CardDef, now: number): LogEvent | undefined {
  let best: LogEvent | undefined;
  for (const e of events) {
    if (e.deleted || e.at <= now || !card.matches(e)) continue;
    if (!best || e.at < best.at) best = e;
  }
  return best;
}

/** Detail for a one-tap feed: same method as last time, and the other breast. */
export function feedDefaults(events: LogEvent[], now: number): Detail {
  const last = lastFor(events, cardById('feed'), now);
  if (!last?.detail?.method || last.detail.method === 'breast') {
    const side = last?.detail?.side;
    return { method: 'breast', side: side === 'L' ? 'R' : side === 'R' ? 'L' : undefined };
  }
  return { method: 'bottle', milk: last.detail.milk };
}

/** Most recent end of any sleep, for "awake for …". */
export function lastWake(events: LogEvent[], now: number): number | undefined {
  let best: number | undefined;
  for (const e of events) {
    if (e.deleted || e.type !== 'sleep' || e.endAt === undefined || e.endAt > now) continue;
    if (best === undefined || e.endAt > best) best = e.endAt;
  }
  return best;
}
