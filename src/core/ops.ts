import { cardById, feedDefaults, ongoingFor, type CardId } from './cards';
import { createEvent } from './events';
import { addEvent, app, updateEvent } from './log';
import type { Detail, LogEvent } from './types';

/**
 * What logging means, in one place: a card tap, a link action (`?do=`) and `window.tinylog` all
 * call these, so they behave the same. No UI here; callers decide how to show the result.
 */
export type OpResult =
  | { kind: 'logged' | 'started'; card: CardId; event: LogEvent }
  | { kind: 'stopped'; card: CardId; event: LogEvent; prev: LogEvent }
  /** A running nap became night sleep (or the other way round) instead of starting a second sleep. */
  | { kind: 'switched'; card: CardId; event: LogEvent; prev: LogEvent }
  | { kind: 'noop'; card: CardId; reason: string };

export interface OpOptions {
  at?: number;
  detail?: Detail;
}

/** Log an instant card (feed, diapers, bath, doctor) at `at`. Feeds default to the other breast / same bottle. */
export function logCard(id: CardId, { at = Date.now(), detail }: OpOptions = {}): OpResult {
  const card = cardById(id);
  if (card.timed) return toggleCard(id, { at, detail });
  const base = card.id === 'feed' ? feedDefaults(app.get().events, at) : card.preset;
  const merged = card.id === 'feed' && detail?.method === 'bottle' ? { ...detail } : { ...base, ...detail };
  const event = addEvent(createEvent(card.type, at, merged, Date.now()));
  return { kind: 'logged', card: id, event };
}

export function startCard(id: CardId, { at = Date.now(), detail }: OpOptions = {}): OpResult {
  const card = cardById(id);
  if (!card.timed) return logCard(id, { at, detail });
  const { events } = app.get();
  if (ongoingFor(events, card)) return { kind: 'noop', card: id, reason: `${card.label} is already going` };
  // Nap ran into bedtime (or the other way round): switch the running sleep instead of starting another.
  if (card.type === 'sleep') {
    const other = events.find((e) => !e.deleted && e.type === 'sleep' && e.endAt === undefined);
    if (other) {
      const event = updateEvent(other.id, { detail: { ...other.detail, sleep: card.preset?.sleep } })!;
      return { kind: 'switched', card: id, event, prev: other };
    }
  }
  const event = addEvent(createEvent(card.type, Math.min(at, Date.now()), { ...card.preset, ...detail }, Date.now()));
  return { kind: 'started', card: id, event };
}

export function stopCard(id: CardId, { at = Date.now(), detail }: OpOptions = {}): OpResult {
  const card = cardById(id);
  const on = card.timed ? ongoingFor(app.get().events, card) : undefined;
  if (!on) return { kind: 'noop', card: id, reason: `No ${card.label.toLowerCase()} is going` };
  const patch = detail ? { endAt: Math.max(at, on.at), detail: { ...on.detail, ...detail } } : { endAt: Math.max(at, on.at) };
  const event = updateEvent(on.id, patch)!;
  return { kind: 'stopped', card: id, event, prev: on };
}

export function toggleCard(id: CardId, opts: OpOptions = {}): OpResult {
  const card = cardById(id);
  if (!card.timed) return logCard(id, opts);
  return ongoingFor(app.get().events, card) ? stopCard(id, opts) : startCard(id, opts);
}
