import { cardFor } from './cards';
import { addDays, dayDate, dayRange, eventsForDay } from './days';
import { dayTotals, type DayTotals } from './daily';
import { amount, clockTime, dayTitle, duration } from './format';
import { summary } from './status';
import type { DayNote, LogEvent, Settings } from './types';

type Prefs = Pick<Settings, 'units' | 'clock' | 'dayStartHour' | 'babyName'>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "7 feeds (180 ml by bottle) · 6 wet, 2 dirty · sleep 14h 20m (3 naps, 3h 10m) · tummy 25m · pumped 240 ml" */
export function totalsLine(t: DayTotals, prefs: Pick<Settings, 'units'>): string {
  const bits: string[] = [];
  if (t.feeds) bits.push(`${plural(t.feeds, 'feed')}${t.bottleMl ? ` (${amount(t.bottleMl, prefs.units)} by bottle)` : ''}`);
  if (t.wet || t.dirty) bits.push(`${t.wet} wet, ${t.dirty} dirty`);
  if (t.sleepMs) bits.push(`sleep ${duration(t.sleepMs)}${t.naps ? ` (${plural(t.naps, 'nap')}, ${duration(t.napMs)})` : ''}`);
  if (t.tummyMs) bits.push(`tummy ${duration(t.tummyMs)}`);
  if (t.fussyMs) bits.push(`fussy ${duration(t.fussyMs)}`);
  if (t.pumps) bits.push(`pumped ${t.pumpMl ? amount(t.pumpMl, prefs.units) : plural(t.pumps, 'time')}`);
  if (t.baths) bits.push('bath');
  if (t.doctor) bits.push(plural(t.doctor, 'doctor visit'));
  return bits.join(' · ');
}

function eventLine(e: LogEvent, dayStart: number, prefs: Prefs): string {
  const card = cardFor(e);
  if (!card) return '';
  const t = clockTime(e.at, prefs.clock);
  const time = e.at < dayStart ? `${t} (prev. day)` : t;
  const bits: string[] = [];
  if (card.timed) {
    if (e.endAt === undefined) bits.push('still going');
    else bits.push(`until ${clockTime(e.endAt, prefs.clock)} (${duration(e.endAt - e.at)})`);
  }
  const s = summary(e, prefs);
  if (s && e.type !== 'diaper') bits.push(s);
  if (e.detail?.note) bits.push(e.detail.note.replace(/\s+/g, ' '));
  const label = e.type === 'diaper' ? `${summary(e, prefs)} diaper` : card.label;
  return `- ${time} ${card.emoji} **${label}**${bits.length ? ` — ${bits.join(' · ')}` : ''}`;
}

/** A readable Markdown log for a range of days, newest first (for Obsidian, Notes, a pediatrician). */
export function toMarkdown(
  events: LogEvent[],
  notes: Record<string, DayNote>,
  fromDay: string,
  toDay: string,
  prefs: Prefs,
  now: number,
): string {
  const name = prefs.babyName.trim();
  const range = fromDay === toDay ? dayTitle(dayDate(toDay)) : `${dayTitle(dayDate(fromDay))} – ${dayTitle(dayDate(toDay))}`;
  const out = [`# ${name ? `${name}'s log` : 'Baby log'} · ${range}`, ''];
  for (let day = toDay; day >= fromDay; day = addDays(day, -1)) {
    const list = eventsForDay(events, day, prefs.dayStartHour, now).sort((a, b) => a.at - b.at);
    const note = notes[day]?.text?.trim();
    out.push(`## ${dayTitle(dayDate(day))}`, '');
    if (!list.length && !note) {
      out.push('_Nothing logged._', '');
      continue;
    }
    const totals = totalsLine(dayTotals(events, day, prefs.dayStartHour, now), prefs);
    if (totals) out.push(`**Totals:** ${totals}`, '');
    if (note) out.push(...note.split('\n').map((l) => `> ${l}`), '');
    const [start] = dayRange(day, prefs.dayStartHour);
    out.push(...list.map((e) => eventLine(e, start, prefs)), '');
  }
  out.push('_Exported from tinylog. A record of what was logged, not medical advice._', '');
  return out.join('\n');
}
