import { addDays, dayDate, dayRange } from './days';
import { clockTime, dayTitle } from './format';
import type { Feeling, LogEvent, MoodLevel, Settings } from './types';

/**
 * The parent's own mood check-ins (`mood` events), for keeping an eye on postpartum mood.
 * Descriptive only: no scores, averages or streaks, and nothing here decides what a mood means.
 * Support contacts are shown as a fixed note, never triggered by what was logged.
 */

export const MOODS: readonly { level: MoodLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: '😞', label: 'Very low' },
  { level: 2, emoji: '😕', label: 'Low' },
  { level: 3, emoji: '😐', label: 'Okay' },
  { level: 4, emoji: '🙂', label: 'Good' },
  { level: 5, emoji: '😊', label: 'Great' },
];

export const FEELINGS: readonly [Feeling, string][] = [
  ['calm', 'Calm'],
  ['hopeful', 'Hopeful'],
  ['connected', 'Connected'],
  ['anxious', 'Anxious'],
  ['tearful', 'Tearful'],
  ['irritable', 'Irritable'],
  ['overwhelmed', 'Overwhelmed'],
  ['numb', 'Numb'],
  ['lonely', 'Lonely'],
];

export const moodInfo = (level: number | undefined) => MOODS.find((m) => m.level === level);

/** "very-low", "low", "ok", "3"… → a level; undefined if it isn't one. */
export function parseMood(raw: string | number | undefined | null): MoodLevel | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim().toLowerCase().replace(/[\s_]+/g, '-');
  const n = Number(s);
  if (s !== '' && Number.isInteger(n)) return n >= 1 && n <= 5 ? (n as MoodLevel) : undefined;
  const words: Record<string, MoodLevel> = { 'very-low': 1, awful: 1, bad: 1, low: 2, meh: 3, okay: 3, ok: 3, fine: 3, good: 4, great: 5 };
  return words[s];
}

/** "anxious, tearful" (or a list) → known feelings; `bad` lists any it didn't recognize. */
export function parseFeelings(raw: string | string[] | undefined | null): { feelings: Feeling[]; bad: string[] } {
  const parts = (Array.isArray(raw) ? raw : String(raw ?? '').split(','))
    .map((p) => String(p).trim().toLowerCase())
    .filter(Boolean);
  const known = new Set(FEELINGS.map(([f]) => f));
  const feelings: Feeling[] = [];
  const bad: string[] = [];
  for (const p of parts) {
    if (known.has(p as Feeling)) {
      if (!feelings.includes(p as Feeling)) feelings.push(p as Feeling);
    } else bad.push(p);
  }
  return { feelings, bad };
}

/** "Low · anxious, tearful" */
export function moodSummary(level: number | undefined, feelings: Feeling[] | undefined): string {
  const m = moodInfo(level);
  const bits: string[] = [];
  if (m) bits.push(m.label);
  if (feelings?.length) bits.push(feelings.map((f) => FEELINGS.find(([id]) => id === f)?.[1].toLowerCase() ?? f).join(', '));
  return bits.join(' · ');
}

export interface MoodPoint {
  at: number;
  level: MoodLevel;
  feelings: Feeling[];
  note: string;
  id: string;
}

/** Check-ins between `from` and `to` (epoch ms), oldest first, ignoring deleted ones and ones without a level. */
export function moodSeries(events: LogEvent[], from = -Infinity, to = Infinity): MoodPoint[] {
  const out: MoodPoint[] = [];
  for (const e of events) {
    const level = e.detail?.mood;
    if (e.deleted || e.type !== 'mood' || e.at < from || e.at >= to || !moodInfo(level)) continue;
    out.push({ at: e.at, level: level!, feelings: e.detail?.feelings ?? [], note: e.detail?.note?.trim() ?? '', id: e.id });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Where to find help. Shown as a fixed note on the mood sheet and in Trends, the same whatever was
 * logged: the app never decides that a mood means something.
 */
export const SUPPORT_TEXT =
  'Feeling low, anxious or not like yourself for more than two weeks, or having thoughts of harming yourself or your baby? It’s common, it’s not your fault, and it’s treatable. Talk to your doctor or midwife.';
export const SUPPORT_LINKS: readonly { label: string; href: string }[] = [
  { label: 'US: call or text 1-833-TLC-MAMA (852-6262), 24/7', href: 'tel:+18338526262' },
  { label: 'In a crisis: call or text 988', href: 'tel:988' },
];

/** The check-ins in a range of days as Markdown, newest day first: kept apart from the baby's log. */
export function moodMarkdown(events: LogEvent[], fromDay: string, toDay: string, prefs: Pick<Settings, 'clock' | 'dayStartHour'>): string {
  const range = fromDay === toDay ? dayTitle(dayDate(toDay)) : `${dayTitle(dayDate(fromDay))} – ${dayTitle(dayDate(toDay))}`;
  const out = [`# Mood check-ins · ${range}`, ''];
  let any = false;
  for (let day = toDay; day >= fromDay; day = addDays(day, -1)) {
    const [start, end] = dayRange(day, prefs.dayStartHour);
    const pts = moodSeries(events, start, end);
    if (!pts.length) continue;
    any = true;
    out.push(`## ${dayTitle(dayDate(day))}`, '');
    for (const p of pts) {
      const m = moodInfo(p.level)!;
      const rest = [moodSummary(p.level, p.feelings), p.note.replace(/\s+/g, ' ')].filter(Boolean).join(' · ');
      out.push(`- ${clockTime(p.at, prefs.clock)} ${m.emoji} ${rest}`);
    }
    out.push('');
  }
  if (!any) out.push('_No check-ins._', '');
  out.push('_Exported from tinylog. A record of what was logged, not a diagnosis._', '');
  return out.join('\n');
}
