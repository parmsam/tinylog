import type { CardId } from './cards';
import { ML_PER_OZ } from './format';
import type { Detail, Side } from './types';

/**
 * Link actions: open the app with `?do=…` to log something, e.g. from an iOS Shortcut ("Hey Siri,
 * wet diaper"), an Android home-screen shortcut, or a bookmark.
 *
 *   ?do=log&what=wet                      ?do=log&what=feed&method=bottle&ml=90
 *   ?do=toggle&what=nap                   ?do=start&what=tummy     ?do=stop&what=pump&ml=120
 *   &ago=15  logs it 15 minutes ago       &side=L|R|both   &milk=breast|formula   &note=…
 *   &minl=12&minr=8 (or &min=20)  breastfeeding length in minutes
 *
 * Settings never travel in the URL. Parameters are removed once the action has run.
 */

export type LinkVerb = 'log' | 'start' | 'stop' | 'toggle';

export type LinkAction =
  | { kind: LinkVerb; card: CardId; detail: Detail; minutesAgo: number }
  | { kind: 'invalid'; reason: string };

/** Query parameters that belong to an action (removed after it runs). */
export const LINK_PARAMS = ['do', 'what', 'side', 'ml', 'oz', 'milk', 'method', 'note', 'ago', 'diaper', 'min', 'minl', 'minr'] as const;

/** Friendly names for cards: what people (and Siri) actually say. */
const WHAT: Record<string, CardId | 'sleep' | 'both'> = {
  feed: 'feed',
  feeding: 'feed',
  bottle: 'feed',
  breast: 'feed',
  nurse: 'feed',
  nursing: 'feed',
  wet: 'wet',
  pee: 'wet',
  dirty: 'dirty',
  poop: 'dirty',
  poo: 'dirty',
  both: 'both',
  diaper: 'wet',
  nap: 'nap',
  night: 'night',
  bedtime: 'night',
  sleep: 'sleep',
  tummy: 'tummy',
  'tummy-time': 'tummy',
  pump: 'pump',
  pumping: 'pump',
  fussy: 'fussy',
  crying: 'fussy',
  cry: 'fussy',
  bath: 'bath',
  doctor: 'doctor',
  checkup: 'doctor',
};

const SIDES: Record<string, Side> = { l: 'L', left: 'L', r: 'R', right: 'R', both: 'both', b: 'both' };
const MAX_NOTE = 300;

/** "sleep" means night sleep in the evening and early morning, a nap otherwise. */
export function sleepCardAt(ts: number): CardId {
  const h = new Date(ts).getHours();
  return h >= 19 || h < 6 ? 'night' : 'nap';
}

export function parseLinkAction(search: string, now = Date.now()): LinkAction | null {
  const q = new URLSearchParams(search);
  const verb = q.get('do')?.trim().toLowerCase();
  if (!verb) return null;
  if (!['log', 'start', 'stop', 'toggle', 'add'].includes(verb)) return { kind: 'invalid', reason: `unknown action “${verb}” (use log, start, stop or toggle)` };
  const kind: LinkVerb = verb === 'add' ? 'log' : (verb as LinkVerb);

  const whatRaw = q.get('what')?.trim().toLowerCase().replace(/\s+/g, '-');
  if (!whatRaw) return { kind: 'invalid', reason: 'say what to log, e.g. &what=wet' };
  const what = WHAT[whatRaw];
  if (!what) return { kind: 'invalid', reason: `don't know “${whatRaw}” (try feed, wet, dirty, nap, night, tummy, pump, fussy, bath)` };

  const agoRaw = q.get('ago');
  const minutesAgo = agoRaw === null ? 0 : Math.round(Number(agoRaw));
  if (!Number.isFinite(minutesAgo) || minutesAgo < 0 || minutesAgo > 24 * 60) return { kind: 'invalid', reason: `“ago” is minutes ago, 0–1440` };

  const detail: Detail = {};
  let card: CardId;
  if (what === 'both') {
    card = 'dirty';
    detail.diaper = 'both';
  } else if (what === 'sleep') card = sleepCardAt(now - minutesAgo * 60_000);
  else card = what;
  if (whatRaw === 'bottle') detail.method = 'bottle';
  if (whatRaw === 'breast' || whatRaw === 'nurse' || whatRaw === 'nursing') detail.method = 'breast';

  const side = q.get('side')?.trim().toLowerCase();
  if (side) {
    if (!SIDES[side]) return { kind: 'invalid', reason: `side is L, R or both` };
    detail.side = SIDES[side];
  }
  const method = q.get('method')?.trim().toLowerCase();
  if (method === 'bottle' || method === 'breast') detail.method = method;
  const milk = q.get('milk')?.trim().toLowerCase();
  if (milk === 'formula' || milk === 'breast') detail.milk = milk;
  const diaper = q.get('diaper')?.trim().toLowerCase();
  if (diaper === 'wet' || diaper === 'dirty' || diaper === 'both') detail.diaper = diaper;

  const ml = Number(q.get('ml'));
  const oz = Number(q.get('oz'));
  if (q.get('ml') !== null && (!(ml > 0) || ml > 2000)) return { kind: 'invalid', reason: 'ml must be a number' };
  if (q.get('oz') !== null && (!(oz > 0) || oz > 70)) return { kind: 'invalid', reason: 'oz must be a number' };
  if (ml > 0) detail.amount = Math.round(ml);
  else if (oz > 0) detail.amount = Math.round(oz * ML_PER_OZ);
  // An amount on a feed means a bottle.
  if (card === 'feed' && detail.amount && !detail.method) detail.method = 'bottle';

  // Breastfeeding length, in minutes: per side and/or a total.
  for (const [param, key] of [['minl', 'minL'], ['minr', 'minR'], ['min', 'min']] as const) {
    const raw = q.get(param);
    if (raw === null) continue;
    const v = Math.round(Number(raw));
    if (!(v >= 1 && v <= 180)) return { kind: 'invalid', reason: `${param} is minutes, 1–180` };
    detail[key] = v;
  }
  if ((detail.minL || detail.minR || detail.min) && card === 'feed' && !detail.method) detail.method = 'breast';
  if (detail.minL && detail.minR && !detail.side) detail.side = 'both';
  else if (detail.minL && !detail.side) detail.side = 'L';
  else if (detail.minR && !detail.side) detail.side = 'R';

  const note = q.get('note')?.trim().slice(0, MAX_NOTE);
  if (note) detail.note = note;

  return { kind, card, detail, minutesAgo };
}

/** The same URL without the action's parameters, so a reload doesn't run it again. */
export function stripLinkAction(href: string): string {
  const url = new URL(href);
  LINK_PARAMS.forEach((p) => url.searchParams.delete(p));
  return url.pathname + url.search + url.hash;
}
