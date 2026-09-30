import { cardById, feedDefaults, ongoingFor, type CardDef, type CardId } from '../core/cards';
import { dayRange } from '../core/days';
import { clockTime, duration } from '../core/format';
import { app, deleteEvent, getEvent, revertTo, settings, today, updateEvent } from '../core/log';
import { logCard, toggleCard, type OpResult } from '../core/ops';
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

function logged(card: CardDef, e: LogEvent, verb: string, prefix = '') {
  const t = (ts: number) => clockTime(ts, settings.get().clock);
  const label = (ts: number) => `${prefix}${card.emoji} ${card.label} ${verb} · ${t(ts)}`;
  const handle = toast(label(e.at), {
    actions: [
      { label: 'Undo', primary: true, run: () => deleteEvent(e.id) },
      ...shiftChips(e.id, 'at', e.at, (ts) => handle.update(label(ts))),
      { label: 'Details', run: () => openSheet({ event: getEvent(e.id)! }) },
    ],
  });
}

/**
 * Shows what an operation did: toast with Undo, the companion's reaction, and for a pump that
 * just stopped without a volume, the sheet to add one. Shared by taps and link actions.
 */
export function present(r: OpResult, opts: { prefix?: string } = {}) {
  const card = cardById(r.card);
  const prefix = opts.prefix ?? '';
  switch (r.kind) {
    case 'noop':
      toast(`${prefix}${card.emoji} ${r.reason}`);
      return;
    case 'logged':
      companionReact(r.card, 'log');
      logged(card, r.event, 'logged', prefix);
      return;
    case 'started':
      companionReact(r.card, 'start');
      logged(card, r.event, 'started', prefix);
      return;
    case 'switched': {
      const prev = r.prev;
      companionReact(r.card, 'start');
      toast(`${prefix}${card.emoji} Now counting as ${card.label.toLowerCase()}`, { actions: [{ label: 'Undo', primary: true, run: () => revertTo(prev) }] });
      return;
    }
    case 'stopped': {
      const prev = r.prev;
      companionReact(r.card, 'stop');
      // Ending a pump is when you know the volume: ask (skippable), unless it came with one.
      if (r.card === 'pump' && !r.event.detail?.amount) return openSheet({ event: r.event });
      toast(`${prefix}${card.emoji} ${card.label} · ${duration((r.event.endAt ?? r.event.at) - r.event.at)}`, {
        actions: [
          { label: 'Undo', primary: true, run: () => revertTo(prev) },
          { label: 'Details', run: () => openSheet({ event: getEvent(r.event.id)! }) },
        ],
      });
      return;
    }
  }
}

/** Tap on a card. Today: log (or start/stop) right now. Past days: open the sheet at that day. */
export function tapCard(id: CardId, now = Date.now()) {
  const card = cardById(id);
  const s = app.get();
  if (s.day !== today(now)) return openSheet({ cardId: id, at: sameTimeOn(s.day, now) });
  if (card.sheetFirst) return openSheet({ cardId: id, at: now });
  requestPersistence();
  present(card.timed ? toggleCard(id, { at: now }) : logCard(id, { at: now }));
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
