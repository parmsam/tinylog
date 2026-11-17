import type { Detail, Settings, TempSite, TempUnit } from './types';

/**
 * Body temperature readings. Stored in °C to 0.01, so a reading typed in °F to one decimal comes
 * back the same. Descriptive only: tinylog shows the reading and never labels it (no "fever",
 * no thresholds); the sheet says to call the doctor when worried.
 */

/** Where the reading was taken; doctors ask, and readings differ by site. */
export const TEMP_SITES: [TempSite, string][] = [
  ['forehead', 'Forehead'],
  ['ear', 'Ear'],
  ['armpit', 'Armpit'],
  ['rectal', 'Rectal'],
  ['mouth', 'Mouth'],
];

const SITE_NAMES: Record<string, TempSite> = {
  forehead: 'forehead',
  temporal: 'forehead',
  ear: 'ear',
  tympanic: 'ear',
  armpit: 'armpit',
  underarm: 'armpit',
  axillary: 'armpit',
  rectal: 'rectal',
  bottom: 'rectal',
  mouth: 'mouth',
  oral: 'mouth',
};

/** Plausible body temperatures, to catch typos (e.g. 3.78) or the wrong unit. */
export const TEMP_RANGE_C: readonly [number, number] = [30, 45];

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;

/** °C from what was typed (°C wins if both); undefined if nothing usable was. */
export function tempFrom(v: { c?: number; f?: number }): number | undefined {
  if (v.c !== undefined && Number.isFinite(v.c) && v.c > 0) return round(v.c, 2);
  if (v.f !== undefined && Number.isFinite(v.f) && v.f > 0) return round(fToC(v.f), 2);
  return undefined;
}

export const tempInRange = (c: number | undefined) => c !== undefined && c >= TEMP_RANGE_C[0] && c <= TEMP_RANGE_C[1];

/** The reading in a unit, to one decimal, as a number (for a form field). */
export const tempIn = (c: number, unit: TempUnit) => round(unit === 'F' ? cToF(c) : c, 1);

/** "37.8 °C", "100.0 °F". */
export function formatTemp(c: number, unit: TempUnit): string {
  return `${tempIn(c, unit).toFixed(1)} °${unit}`;
}

export function parseTempSite(raw: string | null | undefined): TempSite | undefined {
  return SITE_NAMES[(raw ?? '').trim().toLowerCase()];
}

export const siteLabel = (s: TempSite | undefined) => TEMP_SITES.find(([v]) => v === s)?.[1].toLowerCase() ?? '';

/** "37.8 °C · ear". */
export function tempSummary(d: Pick<Detail, 'tempC' | 'tempSite'>, unit: TempUnit): string {
  return [d.tempC ? formatTemp(d.tempC, unit) : '', siteLabel(d.tempSite)].filter(Boolean).join(' · ');
}

/** The unit to show: the setting, or (for older settings without one) °F alongside lb, otherwise °C. */
export function tempUnit(prefs: Partial<Pick<Settings, 'tempUnit' | 'growthUnits' | 'units'>>): TempUnit {
  if (prefs.tempUnit === 'C' || prefs.tempUnit === 'F') return prefs.tempUnit;
  return (prefs.growthUnits ?? (prefs.units === 'oz' ? 'imperial' : 'metric')) === 'imperial' ? 'F' : 'C';
}
