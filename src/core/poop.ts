import type { Detail, PoopAmount, PoopColor } from './types';

/**
 * Optional detail for a dirty diaper: its color and how much. A record of what was seen, for a
 * checkup ("green since Tuesday"). Descriptive only: colors are never labelled normal or not; the
 * sheet says to call the doctor if worried.
 */

/** Colors, with a swatch for the sheet (decoration only, never a series color). */
export const POOP_COLORS: [PoopColor, string, string][] = [
  ['yellow', 'Yellow', '#e2b93b'],
  ['orange', 'Orange', '#d9822b'],
  ['green', 'Green', '#6f8f3a'],
  ['brown', 'Brown', '#7a5232'],
  ['black', 'Black', '#2b2522'],
  ['red', 'Red', '#b8453a'],
  ['white', 'White / grey', '#d8d4cc'],
];

export const POOP_AMOUNTS: [PoopAmount, string][] = [
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
];

const COLOR_NAMES: Record<string, PoopColor> = {
  yellow: 'yellow',
  mustard: 'yellow',
  orange: 'orange',
  green: 'green',
  brown: 'brown',
  tan: 'brown',
  black: 'black',
  red: 'red',
  white: 'white',
  grey: 'white',
  gray: 'white',
  pale: 'white',
  chalky: 'white',
};

const AMOUNT_NAMES: Record<string, PoopAmount> = {
  small: 'small',
  s: 'small',
  little: 'small',
  smear: 'small',
  medium: 'medium',
  m: 'medium',
  normal: 'medium',
  large: 'large',
  l: 'large',
  big: 'large',
  blowout: 'large',
};

export function parsePoopColor(raw: string | null | undefined): PoopColor | undefined {
  return COLOR_NAMES[(raw ?? '').trim().toLowerCase()];
}

export function parsePoopAmount(raw: string | null | undefined): PoopAmount | undefined {
  return AMOUNT_NAMES[(raw ?? '').trim().toLowerCase()];
}

/** "Wet", "Dirty", "Wet + dirty". */
export function diaperKind(d: Detail | undefined): string {
  return d?.diaper === 'both' ? 'Wet + dirty' : d?.diaper === 'dirty' ? 'Dirty' : 'Wet';
}

/** "green · small", or '' with no detail (or on a wet-only diaper). */
export function poopSummary(d: Detail | undefined): string {
  if (!d || (d.diaper !== 'dirty' && d.diaper !== 'both')) return '';
  const color = POOP_COLORS.find(([c]) => c === d.poopColor)?.[1].toLowerCase();
  const amount = d.poopAmount;
  return [color, amount].filter(Boolean).join(' · ');
}
