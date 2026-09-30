import { cardFor } from '../core/cards';
import { addDays, dayDate, dayKey, dayRange, eventsForDay, spanEnd } from '../core/days';
import { isOngoing } from '../core/events';
import { clockTime, dayTitle, duration, shortDate } from '../core/format';
import { app, getEvent, setNote, settings, today } from '../core/log';
import { summary } from '../core/status';
import type { LogEvent } from '../core/types';
import { riseIn } from '../fx/anims';
import { sameTimeOn } from './actions';
import { openSheet } from './sheet';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function goToDay(day: string) {
  const max = today();
  app.set({ day: day > max ? max : day });
}

export function mountDayView() {
  $('day-prev').addEventListener('click', () => goToDay(addDays(app.get().day, -1)));
  $('day-next').addEventListener('click', () => goToDay(addDays(app.get().day, 1)));
  $('day-today').addEventListener('click', () => goToDay(today()));
  $('add-entry').addEventListener('click', () => {
    const day = app.get().day;
    openSheet({ cardId: 'feed', at: day === today() ? Date.now() : sameTimeOn(day) });
  });
  $('entries').addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
    const ev = row && getEvent(row.dataset.id!);
    if (ev) openSheet({ event: ev });
  });

  // Day note: saved as you type (debounced) and on blur. Tied to the day it was typed on.
  const note = $<HTMLTextAreaElement>('day-note');
  let timer: number | undefined;
  let noteDay = app.get().day;
  const saveNote = () => {
    clearTimeout(timer);
    setNote(noteDay, note.value.trim() ? note.value : '');
  };
  note.addEventListener('focus', () => (noteDay = app.get().day));
  note.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(saveNote, 500);
  });
  note.addEventListener('blur', saveNote);
  window.addEventListener('pagehide', saveNote);
}

let lastRendered = '';

export function renderDayView(now = Date.now()) {
  const s = app.get();
  const prefs = settings.get();
  const isToday = s.day === dayKey(now, prefs.dayStartHour);
  const isYesterday = s.day === addDays(dayKey(now, prefs.dayStartHour), -1);

  $('day-title').textContent = isToday ? 'Today' : isYesterday ? 'Yesterday' : dayTitle(dayDate(s.day));
  $('day-title').title = dayTitle(dayDate(s.day));
  $<HTMLButtonElement>('day-next').disabled = isToday;
  $('day-today').hidden = isToday;
  $('log-title').textContent = isToday ? "Today's log" : `Log · ${dayTitle(dayDate(s.day))}`;
  $<HTMLTextAreaElement>('day-note').placeholder = isToday ? 'Anything special about today?' : 'Anything special about this day?';

  const note = $<HTMLTextAreaElement>('day-note');
  if (document.activeElement !== note) note.value = s.notes[s.day]?.text ?? '';

  const events = eventsForDay(s.events, s.day, prefs.dayStartHour, now).sort((a, b) => b.at - a.at);
  const list = $('entries');
  const [start] = dayRange(s.day, prefs.dayStartHour);
  const html = events.map((e) => entryHtml(e, start, now)).join('');
  $('entries-empty').hidden = events.length > 0;
  $('entries-empty').textContent = isToday ? 'Nothing logged yet today. Tap a card above.' : 'Nothing logged this day. Use + Add entry to fill it in.';
  // Only touch the DOM when something changed, so rows don't flicker every tick.
  if (html !== lastRendered) {
    const before = new Set([...list.querySelectorAll<HTMLElement>('[data-id]')].map((el) => el.dataset.id));
    const dayChanged = list.dataset.day !== s.day;
    list.innerHTML = html;
    list.dataset.day = s.day;
    lastRendered = html;
    const fresh = [...list.querySelectorAll<HTMLElement>('[data-id]')].filter((el) => dayChanged || !before.has(el.dataset.id));
    riseIn(fresh.slice(0, 20));
  }
}

function entryHtml(e: LogEvent, dayStart: number, now: number): string {
  const card = cardFor(e);
  if (!card) return '';
  const prefs = settings.get();
  const t = clockTime(e.at, prefs.clock);
  const before = e.at < dayStart ? `<small>${shortDate(e.at)}</small>` : '';
  const ongoing = isOngoing(e);
  const dur = card.timed ? (ongoing ? `${duration(now - e.at)} …` : duration(spanEnd(e, now) - e.at)) : '';
  const until = card.timed && e.endAt !== undefined ? `until ${clockTime(e.endAt, prefs.clock)}` : '';
  // Diapers are titled by kind ("Wet + dirty"), so the summary isn't repeated underneath.
  const isDiaper = e.type === 'diaper';
  const bits = [until, isDiaper ? '' : summary(e, prefs), e.detail?.note].filter(Boolean).join(' · ');
  const title = isDiaper ? `${summary(e, prefs)} diaper` : ongoing ? `${card.label} (still going)` : card.label;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<li><button type="button" class="entry" data-id="${e.id}" style="--c: var(--c-${card.id})">
    <span class="entry-time">${t}${before}</span>
    <span class="entry-emoji" aria-hidden="true">${card.emoji}</span>
    <span class="entry-text"><span class="entry-title">${esc(title)}</span><span class="entry-sub">${esc(bits) || '&nbsp;'}</span></span>
    <span class="entry-dur ${ongoing ? 'is-ongoing' : ''}">${dur}</span>
  </button></li>`;
}
