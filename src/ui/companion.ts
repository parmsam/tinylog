import { cardById, lastFor, lastWake, ongoingFor, type CardId } from '../core/cards';
import { ago, duration, stopwatch } from '../core/format';
import { app, settings, today } from '../core/log';
import { Cloud, type CompanionState, type Reaction } from '../companion/cloud';

/**
 * The companion row under the date: Puff plus one line about right now
 * ("Sleeping · 42m", "Awake 1h 10m · fed 38m ago"). Only shown on today and when enabled.
 */
let cloud: Cloud | null = null;

export function mountCompanion() {
  const host = document.getElementById('companion');
  if (!host) return;
  cloud = new Cloud(host.querySelector('.puff-host') as HTMLElement);
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
  const bits = [wake !== undefined ? `Awake ${duration(now - wake)}` : `Hi from ${who === 'Baby' ? 'Puff' : `${who}'s Puff`}`, feed ? `fed ${ago(feed.at, now)}` : ''];
  return { state: 'idle', line: bits.filter(Boolean).join(' · ') };
}

export function renderCompanion(now = Date.now()) {
  const host = document.getElementById('companion');
  if (!host || !cloud) return;
  const show = settings.get().companion && app.get().day === today(now);
  host.hidden = !show;
  if (!show) return;
  const { state, line } = stateAndLine(now);
  cloud.setState(state);
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

/** Something was logged: let Puff react (only when visible). */
export function companionReact(card: CardId, what: 'log' | 'start' | 'stop') {
  if (!cloud || !settings.get().companion) return;
  const r = REACTIONS[card][what] ?? REACTIONS[card].log;
  if (r) cloud.react(r);
}

export function companionUndo() {
  cloud?.react('undo');
}
