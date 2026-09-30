import { cardById, lastFor, lastWake, ongoingFor, type CardId } from '../core/cards';
import { ago, duration, stopwatch } from '../core/format';
import { app, settings, today } from '../core/log';
import { characterById } from '../companion/characters';
import { Companion, type CompanionState, type Reaction } from '../companion/companion';
import { backgroundCalm, backgroundPulse } from './background';

/**
 * The companion row under the date: the chosen character plus one line about right now
 * ("Pip is sleeping · 42m", "Awake 1h 10m · fed 38m ago"). Only shown on today, unless turned off.
 */
let buddy: Companion | null = null;

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
  const greeting = buddy ? characterById(buddy.id).greeting : 'Hi';
  const bits = [wake !== undefined ? `Awake ${duration(now - wake)}` : greeting, feed ? `fed ${ago(feed.at, now)}` : ''];
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
  const { state, line } = stateAndLine(now);
  buddy.setState(state);
  const el = host.querySelector('.companion-line')!;
  if (el.textContent !== line) el.textContent = line;
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

/** Something was logged: the background pulses, and the companion reacts (when shown). */
export function companionReact(card: CardId, what: 'log' | 'start' | 'stop') {
  backgroundPulse();
  if (!buddy || settings.get().companion === 'off') return;
  const r = REACTIONS[card][what] ?? REACTIONS[card].log;
  if (r) buddy.react(r);
}

/** The live companion SVG, for the recap card (null when turned off). */
export function companionElement(): SVGSVGElement | null {
  if (settings.get().companion === 'off') return null;
  return document.querySelector<SVGSVGElement>('#companion svg.buddy');
}
