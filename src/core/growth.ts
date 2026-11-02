import type { GrowthUnits, LogEvent, Settings } from './types';

/**
 * Weight and height. Stored metric (grams, cm) with enough precision that what was typed in either
 * unit comes back exactly: grams to 0.1 g (oz to 0.1), cm to 0.01 (inches to 0.01).
 */

export const G_PER_OZ = 28.349523125;
export const CM_PER_IN = 2.54;

/** Plausible ranges for a baby/toddler, to catch typos (e.g. 72 kg for 7.2). */
export const WEIGHT_RANGE_G: readonly [number, number] = [300, 40_000];
export const HEIGHT_RANGE_CM: readonly [number, number] = [20, 130];

const round = (v: number, places: number) => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

/** "7.2", "3.452", "24.25": up to `places` decimals, no trailing zeros. */
const num = (v: number, places: number) => String(round(v, places));

export const roundGrams = (g: number) => round(g, 1);
export const roundCm = (cm: number) => round(cm, 2);

/** The growth units to use: the setting, or (for older settings without one) whatever matches the volume unit. */
export function growthUnits(prefs: Pick<Settings, 'units'> & Partial<Pick<Settings, 'growthUnits'>>): GrowthUnits {
  return prefs.growthUnits ?? (prefs.units === 'oz' ? 'imperial' : 'metric');
}

/** A weight in lb + oz, oz to 0.1 (16 oz carries into a pound). */
export function toLbOz(g: number): { lb: number; oz: number } {
  const totalOz = round(g / G_PER_OZ, 1);
  const lb = Math.floor(totalOz / 16);
  return { lb, oz: round(totalOz - lb * 16, 1) };
}

export function formatWeight(g: number, units: GrowthUnits): string {
  if (units === 'imperial') {
    const { lb, oz } = toLbOz(g);
    if (!lb) return `${num(oz, 1)} oz`;
    return oz ? `${lb} lb ${num(oz, 1)} oz` : `${lb} lb`;
  }
  return `${num(g / 1000, 3)} kg`;
}

export function formatHeight(cm: number, units: GrowthUnits): string {
  return units === 'imperial' ? `${num(cm / CM_PER_IN, 2)} in` : `${num(cm, 1)} cm`;
}

/** Grams from what was typed; undefined if nothing usable was. */
export function gramsFrom(v: { kg?: number; g?: number; lb?: number; oz?: number }): number | undefined {
  const ok = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x >= 0;
  let g: number | undefined;
  if (ok(v.kg) && v.kg > 0) g = v.kg * 1000;
  else if (ok(v.g) && v.g > 0) g = v.g;
  else if ((ok(v.lb) && v.lb > 0) || (ok(v.oz) && v.oz > 0)) g = ((ok(v.lb) ? v.lb : 0) * 16 + (ok(v.oz) ? v.oz : 0)) * G_PER_OZ;
  return g === undefined ? undefined : roundGrams(g);
}

export function cmFrom(v: { cm?: number; inches?: number }): number | undefined {
  if (v.cm !== undefined && Number.isFinite(v.cm) && v.cm > 0) return roundCm(v.cm);
  if (v.inches !== undefined && Number.isFinite(v.inches) && v.inches > 0) return roundCm(v.inches * CM_PER_IN);
  return undefined;
}

export const weightInRange = (g: number) => g >= WEIGHT_RANGE_G[0] && g <= WEIGHT_RANGE_G[1];
export const heightInRange = (cm: number) => cm >= HEIGHT_RANGE_CM[0] && cm <= HEIGHT_RANGE_CM[1];

export interface GrowthPoint {
  at: number;
  /** grams or cm */
  value: number;
  id: string;
}

/** Every measurement of one kind, oldest first, ignoring deleted entries and ones without a value. */
export function growthSeries(events: LogEvent[], kind: 'weight' | 'height', now = Infinity): GrowthPoint[] {
  const key = kind === 'weight' ? 'grams' : 'cm';
  const out: GrowthPoint[] = [];
  for (const e of events) {
    const v = e.detail?.[key];
    if (e.deleted || e.type !== kind || e.at > now || typeof v !== 'number' || !(v > 0)) continue;
    out.push({ at: e.at, value: v, id: e.id });
  }
  return out.sort((a, b) => a.at - b.at);
}
