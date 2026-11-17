import { dayKey } from './days';
import type { LogEvent } from './types';

/**
 * Vaccines given to the baby: a record of which shots and when (one entry per visit, any number of
 * vaccines). Names are free text: schedules and names differ by country ("6-in-1", "DTaP"), so the
 * common ones are only shortcuts. Descriptive only: tinylog never says what's due or when.
 */

/** Shortcuts on the sheet. Not a schedule, and not in any order of when they're given. */
export const COMMON_VACCINES = ['Hep B', 'DTaP', 'Hib', 'Polio', 'PCV', 'Rotavirus', 'MMR', 'Chickenpox', 'Hep A', 'Flu', 'COVID-19', 'RSV'] as const;

export const MAX_VACCINE_NAME = 40;
export const MAX_VACCINES = 12;

/** Trimmed, single-spaced, capped; '' when there's nothing. */
export function cleanVaccineName(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_VACCINE_NAME);
}

/** Names match whatever their case or spacing ("hep b" is "Hep B"). */
export const vaccineKey = (name: string) => cleanVaccineName(name).toLowerCase();

/** A list of names, from an array or "DTaP, Hib; PCV": cleaned, without repeats (first spelling wins), capped. */
export function parseVaccines(raw: readonly string[] | string | null | undefined, limit = MAX_VACCINES): string[] {
  const parts = typeof raw === 'string' ? raw.split(/[,;\n]/) : (raw ?? []);
  const out = new Map<string, string>();
  for (const p of parts) {
    const name = cleanVaccineName(p);
    if (name && !out.has(vaccineKey(name))) out.set(vaccineKey(name), name);
  }
  return [...out.values()].slice(0, limit);
}

/** "DTaP, Hib, PCV", or "Vaccines" when none were named. */
export function vaccineSummary(names: readonly string[] | undefined): string {
  return names?.length ? names.join(', ') : 'Vaccines';
}

/** Shots on an entry: each named vaccine, or one when none were named. */
export const shotCount = (e: LogEvent) => Math.max(1, e.detail?.vaccines?.length ?? 0);

/** The sheet's shortcuts: the common names plus every other name given before, in that order. */
export function vaccineOptions(events: readonly LogEvent[], extra: readonly string[] = []): string[] {
  const given = events.filter((e) => e.type === 'vaccine' && !e.deleted).flatMap((e) => e.detail?.vaccines ?? []);
  return parseVaccines([...COMMON_VACCINES, ...given, ...extra], Infinity);
}

export interface VaccineRecord {
  at: number;
  /** One row per day: entries on the same day are put together. */
  vaccines: string[];
  notes: string[];
}

/** Every vaccine given so far, one row per day, newest first: the baby's own record. */
export function vaccineRecord(events: readonly LogEvent[], now: number, dayStartHour: number): VaccineRecord[] {
  const rows = new Map<string, VaccineRecord>();
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.deleted || e.type !== 'vaccine' || e.at > now) continue;
    const key = dayKey(e.at, dayStartHour);
    const row = rows.get(key) ?? { at: e.at, vaccines: [], notes: [] };
    row.at = Math.max(row.at, e.at);
    row.vaccines = parseVaccines([...row.vaccines, ...(e.detail?.vaccines ?? [])], Infinity);
    const note = e.detail?.note?.trim();
    if (note) row.notes.push(note);
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.at - a.at);
}
