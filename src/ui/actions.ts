import { cardById, feedDefaults, ongoingFor, type CardDef, type CardId } from '../core/cards';
import { dayRange } from '../core/days';
import { createEvent } from '../core/events';
import { clockTime, duration } from '../core/format';
import { addEvent, app, deleteEvent, getEvent, revertTo, settings, today, updateEvent } from '../core/log';
import type { LogEvent } from '../core/types';
import { companionReact } from './companion';
import { requestPersistence } from './persist';
import { openSheet } from './sheet';
import { toast, type ToastAction } from './toast';

const MIN = 60_000;

/** The same clock time as now, on another day (for adding entries to past days). */
export function sameTimeOn(day: string, now = Date.now()): number {
  const { dayStartHour } = settings.get();
  const [start, end] = dayRange(day, dayStartHour);
  const [todayStart] = dayRange(today(now), dayStartHour);
  return Math.min(start + (now - todayStart), end - MIN);
}

/** "−5m / −15m / −30m" chips that move a just-logged time back, for logging after the fact. */
function shiftChips(id: string, field: 'at', base: number, onShift: (ts: number) => void): ToastAction[] {
  return [5, 15, 30].map((m) => ({
    label: `−${m}m`,
    keepOpen: true,
    run: () => {
      const ts = base - m * MIN;
      updateEvent(id, { [field]: ts });
      onShift(ts);
    },
  }));
}

function logged(card: CardDef, e: LogEvent, verb: string) {
  const t = (ts: number) => clockTime(ts, settings.get().clock);
  const label = (ts: number) => `${card.emoji} ${card.label} ${verb} · ${t(ts)}`;
  const handle = toast(label(e.at), {
    actions: [
      { label: 'Undo', primary: true, run: () => deleteEvent(e.id) },
      ...shiftChips(e.id, 'at', e.at, (ts) => handle.update(label(ts))),
      { label: 'Details', run: () => openSheet({ event: getEvent(e.id)! }) },
    ],
  });
}

/** Tap on a card. Today: log (or start/stop) right now. Past days: open the sheet at that day. */
export function tapCard(id: CardId, now = Date.now()) {
  const card = cardById(id);
  const s = app.get();
  if (s.day !== today(now)) return openSheet({ cardId: id, at: sameTimeOn(s.day, now) });
  if (card.sheetFirst) return openSheet({ cardId: id, at: now });

  requestPersistence();

  if (card.timed) {
    const on = ongoingFor(s.events, card);
    if (on) return stop(card, on, now);
    // Nap ran into bedtime (or the other way round): switch the running sleep instead of starting another.
    const otherSleep = card.type === 'sleep' ? s.events.find((e) => !e.deleted && e.type === 'sleep' && e.endAt === undefined) : undefined;
    if (otherSleep) {
      const prev = otherSleep;
      updateEvent(otherSleep.id, { detail: { ...otherSleep.detail, sleep: card.preset?.sleep } }, now);
      companionReact(card.id, 'start');
      toast(`${card.emoji} Now counting as ${card.label.toLowerCase()}`, {
        actions: [{ label: 'Undo', primary: true, run: () => revertTo(prev) }],
      });
      return;
    }
    const e = addEvent(createEvent(card.type, now, card.preset, now));
    companionReact(card.id, 'start');
    return logged(card, e, 'started');
  }

  const detail = card.id === 'feed' ? feedDefaults(s.events, now) : card.preset;
  const e = addEvent(createEvent(card.type, now, detail, now));
  companionReact(card.id, 'log');
  logged(card, e, 'logged');
}

function stop(card: CardDef, on: LogEvent, now: number) {
  const prev = on;
  const done = updateEvent(on.id, { endAt: now }, now)!;
  companionReact(card.id, 'stop');
  if (card.id === 'pump') {
    // Ending a pump is when you know the volume: ask (skippable).
    openSheet({ event: done });
    return;
  }
  toast(`${card.emoji} ${card.label} · ${duration(now - on.at)}`, {
    actions: [
      { label: 'Undo', primary: true, run: () => revertTo(prev) },
      { label: 'Details', run: () => openSheet({ event: getEvent(on.id)! }) },
    ],
  });
}

/** Long press: straight to the sheet, prefilled like a tap would be. */
export function holdCard(id: CardId, now = Date.now()) {
  const card = cardById(id);
  const s = app.get();
  const isToday = s.day === today(now);
  if (isToday && card.timed) {
    const on = ongoingFor(s.events, card);
    if (on) return openSheet({ event: on });
  }
  const at = isToday ? now : sameTimeOn(s.day, now);
  const detail = card.id === 'feed' ? feedDefaults(s.events, now) : card.preset;
  openSheet({ cardId: id, at, detail, ongoing: isToday && card.timed });
}
