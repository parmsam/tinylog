import type { Detail, DoseUnit, LogEvent } from './types';

/**
 * Medicines and vitamins given to the baby: a name (free text, e.g. "Vitamin D"), and optionally a
 * dose with its unit. Descriptive only: tinylog records what was given and when, and never suggests
 * a dose, an interval or a next time.
 */

export const DOSE_UNITS: [DoseUnit, string][] = [
  ['ml', 'ml'],
  ['drops', 'drops'],
  ['mg', 'mg'],
];

const UNIT_NAMES: Record<string, DoseUnit> = { ml: 'ml', drop: 'drops', drops: 'drops', mg: 'mg' };

export const MAX_MED_NAME = 60;

/** Trimmed, single-spaced, capped; '' when there's nothing. */
export function cleanMedName(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_MED_NAME);
}

/** Names match whatever their case or spacing ("vitamin d" is "Vitamin D"). */
export const medKey = (name: string) => cleanMedName(name).toLowerCase();

export function parseDoseUnit(raw: string | null | undefined): DoseUnit | undefined {
  return UNIT_NAMES[(raw ?? '').trim().toLowerCase()];
}

/** A dose, e.g. 2.5 (ml), 1 (drop): positive and below a sanity cap, rounded to 0.01. */
export function parseDose(raw: string | number | null | undefined): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  const v = Number(raw);
  if (!(v > 0) || v > 1000) return undefined;
  return Math.round(v * 100) / 100;
}

/** "2.5 ml", "1 drop", "40 mg". */
export function formatDose(dose: number | undefined, unit: DoseUnit | undefined): string {
  if (!dose) return '';
  if (!unit) return String(dose);
  return `${dose} ${unit === 'drops' && dose === 1 ? 'drop' : unit}`;
}

/** "Vitamin D · 1 drop". */
export function medSummary(d: Pick<Detail, 'med' | 'dose' | 'doseUnit'>): string {
  return [cleanMedName(d.med), formatDose(d.dose, d.doseUnit)].filter(Boolean).join(' · ');
}

export interface RecentMed {
  /** As last written. */
  name: string;
  dose?: number;
  doseUnit?: DoseUnit;
  /** When it was last given. */
  at: number;
}

/** Each medicine given so far, most recently given first, with its last dose (for one-tap repeats). */
export function recentMeds(events: readonly LogEvent[], now: number, limit = 6): RecentMed[] {
  const byName = new Map<string, RecentMed>();
  for (const e of events) {
    if (e.deleted || e.type !== 'med' || e.at > now) continue;
    const name = cleanMedName(e.detail?.med);
    if (!name) continue;
    const key = medKey(name);
    const seen = byName.get(key);
    if (!seen || e.at > seen.at) byName.set(key, { name, dose: e.detail?.dose, doseUnit: e.detail?.doseUnit, at: e.at });
  }
  return [...byName.values()].sort((a, b) => b.at - a.at).slice(0, limit);
}
