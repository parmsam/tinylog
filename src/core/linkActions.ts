import type { CardId } from './cards';
import { ML_PER_OZ } from './format';
import { cmFrom, gramsFrom, heightInRange, weightInRange } from './growth';
import { cleanMedName, parseDose, parseDoseUnit } from './meds';
import { parseVaccines } from './vaccines';
import { parseTempSite, tempFrom, tempInRange } from './temperature';
import { FEELINGS, parseFeelings, parseMood } from './wellbeing';
import type { Detail, SleepPlace, Side } from './types';

/**
 * Link actions: open the app with `?do=…` to log something, e.g. from an iOS Shortcut ("Hey Siri,
 * wet diaper"), an Android home-screen shortcut, or a bookmark.
 *
 *   ?do=log&what=wet                      ?do=log&what=feed&method=bottle&ml=90
 *   ?do=toggle&what=nap                   ?do=start&what=tummy     ?do=stop&what=pump&ml=120
 *   &ago=15  logs it 15 minutes ago       &side=L|R|both   &milk=breast|formula   &note=…
 *   &minl=12&minr=8 (or &min=20)  breastfeeding length in minutes
 *   &where=bassinet|crib|held|stroller|car  where a sleep happened
 *   ?do=log&what=weight&kg=7.2 (or &g=7200, &lb=15&oz=14)   ?do=log&what=height&cm=62 (or &in=24.5)
 *   ?do=log&what=mood&mood=low (1–5 or very-low|low|okay|good|great)  &feelings=anxious,tearful
 *   ?do=log&what=medicine&name=Vitamin+D&dose=1&unit=drops (unit ml|drops|mg; &ml=2.5 is a dose in ml)
 *   ?do=log&what=vaccines&vaccines=DTaP,Hib,PCV (names optional)
 *   ?do=log&what=temp&c=37.8 (or &f=100.1)  &site=forehead|ear|armpit|rectal|mouth
 *
 * Settings never travel in the URL. Parameters are removed once the action has run.
 */

export type LinkVerb = 'log' | 'start' | 'stop' | 'toggle';

export type LinkAction =
  | { kind: LinkVerb; card: CardId; detail: Detail; minutesAgo: number }
  | { kind: 'invalid'; reason: string };

/** Query parameters that belong to an action (removed after it runs). */
export const LINK_PARAMS = ['do', 'what', 'side', 'ml', 'oz', 'milk', 'method', 'note', 'ago', 'diaper', 'min', 'minl', 'minr', 'where', 'kg', 'g', 'lb', 'cm', 'in', 'mood', 'feelings', 'name', 'dose', 'unit', 'vaccines', 'c', 'f', 'site'] as const;

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
  spitup: 'spitup',
  'spit-up': 'spitup',
  spit: 'spitup',
  bath: 'bath',
  books: 'books',
  book: 'books',
  read: 'books',
  reading: 'books',
  story: 'books',
  music: 'music',
  song: 'music',
  songs: 'music',
  sing: 'music',
  singing: 'music',
  lullaby: 'music',
  doctor: 'doctor',
  checkup: 'doctor',
  weight: 'weight',
  weigh: 'weight',
  weighed: 'weight',
  'weigh-in': 'weight',
  height: 'height',
  length: 'height',
  measure: 'height',
  mood: 'mood',
  'my-mood': 'mood',
  'parent-mood': 'mood',
  'mom-mood': 'mood',
  feeling: 'mood',
  feelings: 'mood',
  'check-in': 'mood',
  checkin: 'mood',
  med: 'med',
  meds: 'med',
  medicine: 'med',
  medicines: 'med',
  medication: 'med',
  vitamin: 'med',
  vitamins: 'med',
  vaccine: 'vaccine',
  vaccines: 'vaccine',
  vaccination: 'vaccine',
  vaccinations: 'vaccine',
  shot: 'vaccine',
  shots: 'vaccine',
  immunization: 'vaccine',
  immunisation: 'vaccine',
  jab: 'vaccine',
  jabs: 'vaccine',
  temp: 'temp',
  temperature: 'temp',
  fever: 'temp',
  thermometer: 'temp',
};

const SIDES: Record<string, Side> = { l: 'L', left: 'L', r: 'R', right: 'R', both: 'both', b: 'both' };
const PLACES: Record<string, SleepPlace> = {
  bassinet: 'bassinet',
  crib: 'crib',
  cot: 'crib',
  held: 'contact',
  contact: 'contact',
  arms: 'contact',
  stroller: 'stroller',
  pram: 'stroller',
  car: 'car',
  'car-seat': 'car',
};
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
  if (!what) return { kind: 'invalid', reason: `don't know “${whatRaw}” (try feed, wet, dirty, nap, night, tummy, pump, fussy, spitup, bath, books, music, medicine, vaccines, temp, weight, height, mood)` };

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

  const num = (k: string) => (q.get(k) === null ? undefined : Number(q.get(k)));
  if (card === 'weight') {
    const raw = { kg: num('kg'), g: num('g'), lb: num('lb'), oz: num('oz') };
    if (Object.values(raw).some((v) => v !== undefined && !(v >= 0))) return { kind: 'invalid', reason: 'weight must be a number' };
    const grams = gramsFrom(raw);
    if (!grams) return { kind: 'invalid', reason: 'say the weight, e.g. &kg=7.2 or &lb=15&oz=14' };
    if (!weightInRange(grams)) return { kind: 'invalid', reason: 'that weight looks off (0.3–40 kg)' };
    detail.grams = grams;
  } else if (['kg', 'g', 'lb'].some((k) => q.get(k) !== null)) return { kind: 'invalid', reason: 'kg, g and lb are for weight' };
  if (card === 'height') {
    const raw = { cm: num('cm'), inches: num('in') };
    if (Object.values(raw).some((v) => v !== undefined && !(v >= 0))) return { kind: 'invalid', reason: 'height must be a number' };
    const cm = cmFrom(raw);
    if (!cm) return { kind: 'invalid', reason: 'say the height, e.g. &cm=62 or &in=24.5' };
    if (!heightInRange(cm)) return { kind: 'invalid', reason: 'that height looks off (20–130 cm)' };
    detail.cm = cm;
  } else if (['cm', 'in'].some((k) => q.get(k) !== null)) return { kind: 'invalid', reason: 'cm and in are for height' };

  if (card === 'mood') {
    const mood = parseMood(q.get('mood'));
    if (!mood) return { kind: 'invalid', reason: 'say the mood, e.g. &mood=3 (1–5) or &mood=low (very-low, low, okay, good, great)' };
    detail.mood = mood;
    const { feelings, bad } = parseFeelings(q.get('feelings'));
    if (bad.length) return { kind: 'invalid', reason: `feelings are ${FEELINGS.map(([f]) => f).join(', ')}` };
    if (feelings.length) detail.feelings = feelings;
  } else if (q.get('mood') !== null || q.get('feelings') !== null) return { kind: 'invalid', reason: 'mood and feelings are for a mood check-in (&what=mood)' };

  if (card === 'med') {
    // A plain "vitamin" link is logged as "Vitamin" (never guessed further); anything else needs a name.
    const name = cleanMedName(q.get('name')) || (whatRaw.startsWith('vitamin') ? 'Vitamin' : '');
    if (!name) return { kind: 'invalid', reason: 'say which medicine, e.g. &name=Vitamin+D' };
    detail.med = name;
    // &ml=2.5 on a medicine is the dose in ml, not a bottle.
    const rawDose = q.get('dose') ?? q.get('ml');
    const dose = parseDose(rawDose);
    if (rawDose !== null && !dose) return { kind: 'invalid', reason: 'dose must be a number, e.g. &dose=2.5' };
    const rawUnit = q.get('unit');
    const unit = q.get('dose') === null && q.get('ml') !== null ? 'ml' : parseDoseUnit(rawUnit);
    if (rawUnit !== null && !unit) return { kind: 'invalid', reason: 'unit is ml, drops or mg' };
    if (dose) detail.dose = dose;
    if (dose && unit) detail.doseUnit = unit;
  } else if (['name', 'dose', 'unit'].some((k) => q.get(k) !== null)) return { kind: 'invalid', reason: 'name, dose and unit are for a medicine (&what=medicine)' };

  if (card === 'vaccine') {
    // Which ones is optional: "shots today" is worth logging even before the names are to hand.
    const vaccines = parseVaccines(q.get('vaccines'));
    if (vaccines.length) detail.vaccines = vaccines;
  } else if (q.get('vaccines') !== null) return { kind: 'invalid', reason: 'vaccines are for &what=vaccines' };

  if (card === 'temp') {
    const raw = { c: num('c'), f: num('f') };
    if (Object.values(raw).some((v) => v !== undefined && !(v >= 0))) return { kind: 'invalid', reason: 'temperature must be a number' };
    const tempC = tempFrom(raw);
    if (!tempC) return { kind: 'invalid', reason: 'say the reading, e.g. &c=37.8 or &f=100.1' };
    if (!tempInRange(tempC)) return { kind: 'invalid', reason: 'that temperature looks off (30–45 °C, 86–113 °F)' };
    detail.tempC = tempC;
    const rawSite = q.get('site');
    const site = parseTempSite(rawSite);
    if (rawSite !== null && !site) return { kind: 'invalid', reason: 'site is forehead, ear, armpit, rectal or mouth' };
    if (site) detail.tempSite = site;
  } else if (['c', 'f', 'site'].some((k) => q.get(k) !== null)) return { kind: 'invalid', reason: 'c, f and site are for a temperature (&what=temp)' };

  const ml = card === 'med' ? 0 : Number(q.get('ml'));
  // On a weight, oz is part of the weight (above), not a volume.
  const oz = card === 'weight' ? 0 : Number(q.get('oz'));
  if (card !== 'med' && q.get('ml') !== null && (!(ml > 0) || ml > 2000)) return { kind: 'invalid', reason: 'ml must be a number' };
  if (card !== 'weight' && q.get('oz') !== null && (!(oz > 0) || oz > 70)) return { kind: 'invalid', reason: 'oz must be a number' };
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

  const where = q.get('where')?.trim().toLowerCase().replace(/\s+/g, '-');
  if (where) {
    if (card !== 'nap' && card !== 'night') return { kind: 'invalid', reason: 'where is for naps and night sleep' };
    if (!PLACES[where]) return { kind: 'invalid', reason: 'where is bassinet, crib, held, stroller or car' };
    detail.where = PLACES[where];
  }

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
