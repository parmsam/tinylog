import { animate } from 'animejs';
import { cardById, lastFor, lastWake, ongoingFor, type CardId } from '../core/cards';
import { coins } from '../core/coins';
import { ago, duration, stopwatch } from '../core/format';
import { app, settings, today } from '../core/log';
import { characterById } from '../companion/characters';
import { Companion, type CompanionState, type Reaction } from '../companion/companion';
import { greeting, idleBit, momentFor, timeOfDay } from '../companion/mood';
import type { LogEvent } from '../core/types';
import { backgroundCalm, backgroundPulse } from './background';

/**
 * The companion row under the date: the chosen character plus one line about right now
 * ("Pip is sleeping · 42m", "Awake 1h 10m · fed 38m ago"). Only shown on today, unless turned off.
 */
let buddy: Companion | null = null;
/** A moment's line ("Longest sleep today · 2h"), shown for a few seconds instead of the usual one. */
let note: { text: string; until: number } | undefined;
/** Last time the companion did anything, so idle bits only come after a quiet spell. */
let lastLively = Date.now();
/** Today's coins as last shown, so a new entry pops a "+1" (undefined until the first render, and after a day change). */
let shownCoins: { day: string; today: number } | undefined;
const NOTE_MS = 8000;
const IDLE_MS = 90_000;
const quiet = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.theme === 'night';

export function mountCompanion() {
  const host = document.getElementById('companion');
  if (!host) return;
  const choice = settings.get().companion;
  buddy = new Companion(host.querySelector('.puff-host') as HTMLElement, choice === 'off' ? 'puff' : choice);
}

function stateAndLine(now: number): { state: CompanionState; line: string } {
  const { events } = app.get();
  const name = settings.get().babyName.trim();
  const who = name || 'Baby';
  const sleeping = ongoingFor(events, cardById('nap')) ?? ongoingFor(events, cardById('night'));
  if (sleeping) return { state: 'sleeping', line: `${who} is sleeping · ${duration(now - sleeping.at)}` };
  const fussy = ongoingFor(events, cardById('fussy'));
  if (fussy) return { state: 'fussy', line: `Fussy spell · ${stopwatch(now - fussy.at)} · you've got this` };
  const tummy = ongoingFor(events, cardById('tummy'));
  if (tummy) return { state: 'tummy', line: `Tummy time · ${stopwatch(now - tummy.at)}` };
  const pump = ongoingFor(events, cardById('pump'));
  if (pump) return { state: 'pump', line: `Pumping · ${stopwatch(now - pump.at)}` };
  const wake = lastWake(events, now);
  const feed = lastFor(events, cardById('feed'), now);
  const hello = greeting(characterById(buddy?.id ?? 'puff').label, timeOfDay(now));
  const bits = [wake !== undefined ? `Awake ${duration(now - wake)}` : hello, feed ? `fed ${ago(feed.at, now)}` : ''];
  return { state: 'idle', line: bits.filter(Boolean).join(' · ') };
}

export function renderCompanion(now = Date.now()) {
  const { events } = app.get();
  backgroundCalm(!!(ongoingFor(events, cardById('nap')) ?? ongoingFor(events, cardById('night'))));
  const host = document.getElementById('companion');
  if (!host || !buddy) return;
  const choice = settings.get().companion;
  const show = choice !== 'off' && app.get().day === today(now);
  host.hidden = !show;
  if (!show) return;
  buddy.setCharacter(choice);
  const { state, line: status } = stateAndLine(now);
  const line = note && now < note.until ? note.text : status;
  buddy.setState(state);
  const tod = timeOfDay(now);
  buddy.setTime(tod);
  // Now and then, while nothing's going on, a small something for the time of day.
  const bit = idleBit(tod);
  if (state === 'idle' && bit && now - lastLively >= IDLE_MS) {
    lastLively = now;
    if (!quiet()) buddy.react(bit);
  }
  const el = host.querySelector('.companion-line')!;
  if (el.textContent !== line) el.textContent = line;
  renderCoins(host, now);
}

/** Today's coin chip; a "+1" floats up when entries are added. */
function renderCoins(host: HTMLElement, now: number) {
  if (!app.get().loaded) return; // or the whole log would pop in as "+12" on launch
  const day = today(now);
  const { today: n } = coins(app.get().events, now, settings.get().dayStartHour);
  const prev = shownCoins?.day === day ? shownCoins.today : undefined;
  shownCoins = { day, today: n };
  if (prev === n) return;
  const chip = host.querySelector<HTMLElement>('.coin-chip')!;
  chip.querySelector('.coin-n')!.textContent = String(n);
  chip.setAttribute('aria-label', `${n} ${n === 1 ? 'coin' : 'coins'} today`);
  if (prev === undefined || n <= prev || quiet()) return;
  const pop = document.createElement('span');
  pop.className = 'coin-pop';
  pop.textContent = `+${n - prev}`;
  pop.setAttribute('aria-hidden', 'true');
  chip.append(pop);
  animate(chip, { scale: [{ to: 1.18, duration: 140, ease: 'outQuad' }, { to: 1, duration: 420, ease: 'outElastic(1, .5)' }] });
  animate(pop, { opacity: [0, 1, 0], translateY: [0, -18], duration: 900, ease: 'outQuad', onComplete: () => pop.remove() });
}

const REACTIONS: Record<CardId, { log?: Reaction; start?: Reaction; stop?: Reaction }> = {
  feed: { log: 'feed' },
  wet: { log: 'wet' },
  dirty: { log: 'dirty' },
  nap: { start: 'sleep', stop: 'wake', log: 'sleep' },
  night: { start: 'sleep', stop: 'wake', log: 'sleep' },
  tummy: { start: 'tummy', stop: 'tummy', log: 'tummy' },
  pump: { start: 'pump', stop: 'pump', log: 'pump' },
  fussy: { start: 'fussy', stop: 'settled', log: 'fussy' },
  bath: { log: 'bath' },
  doctor: { log: 'doctor' },
};

/**
 * Something was logged: the background pulses, and the companion reacts (when shown). With the
 * event, a moment of the day (see mood.ts) can follow with a bigger reaction and a line of its own.
 */
export function companionReact(card: CardId, what: 'log' | 'start' | 'stop', event?: LogEvent) {
  backgroundPulse();
  if (!buddy || settings.get().companion === 'off') return;
  const now = Date.now();
  lastLively = now;
  const r = REACTIONS[card][what] ?? REACTIONS[card].log;
  if (r) buddy.react(r);
  const s = settings.get();
  const moment = event && momentFor(app.get().events, card, what, event, now, { dayStartHour: s.dayStartHour, name: s.babyName.trim(), buddy: characterById(buddy.id).label });
  note = moment && { text: moment.note, until: now + NOTE_MS };
  if (!moment) return;
  const b = buddy;
  window.setTimeout(() => b.react(moment.reaction), r ? 1300 : 0);
  renderCompanion(now);
}

/** The live companion SVG, for the recap card (null when turned off). */
export function companionElement(): SVGSVGElement | null {
  if (settings.get().companion === 'off') return null;
  return document.querySelector<SVGSVGElement>('#companion svg.buddy');
}
