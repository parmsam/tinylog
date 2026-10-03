import type { AccessoryId } from '../core/types';

/**
 * Accessories a companion can wear, unlocked at coin milestones (rewards.ts). Head and neck art is
 * drawn around (0, 0), which lands on each character's `head` / `neck` anchor (characters.ts); a
 * hat's brim sits on y = 0 and the hat rises into negative y. Back art is drawn in the 120×96 box
 * itself, behind the character. One accessory per slot.
 */
export type Slot = 'head' | 'neck' | 'back';

export interface Accessory {
  id: AccessoryId;
  label: string;
  slot: Slot;
  art: string;
}

const flower = (x: number, y: number, petal: string) =>
  `<g transform="translate(${x} ${y})" fill="${petal}">${[0, 72, 144, 216, 288]
    .map((a) => `<circle cx="${(2.3 * Math.cos((a * Math.PI) / 180)).toFixed(2)}" cy="${(2.3 * Math.sin((a * Math.PI) / 180)).toFixed(2)}" r="2"/>`)
    .join('')}<circle r="1.3" fill="#f7d24c"/></g>`;

export const ACCESSORIES: Accessory[] = [
  {
    id: 'bowtie',
    label: 'Bow tie',
    slot: 'neck',
    art: `<path d="M0 0-9-5.5q-2.5 5.5 0 11ZM0 0l9-5.5q2.5 5.5 0 11Z" fill="#7b8cf0" stroke="#5b6bd6" stroke-width="1" stroke-linejoin="round"/><circle r="2.6" fill="#5b6bd6"/>`,
  },
  {
    id: 'partyhat',
    label: 'Party hat',
    slot: 'head',
    art: `<g transform="rotate(12)"><path d="M-10 2 10 2 1-21Z" fill="#f28a9a"/>
      <path d="M-6.4-6 6.4-6M-3.4-13.5 3.6-13.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="1" cy="-22" r="3.2" fill="#f7d24c"/></g>`,
  },
  {
    id: 'flowers',
    label: 'Flower crown',
    slot: 'head',
    art: `<path d="M-17 4q17-9 34 0" fill="none" stroke="#7cc47f" stroke-width="2" stroke-linecap="round"/>
      ${flower(-14, 2, '#f7b8c4')}${flower(-7, -1.5, '#c9b8e8')}${flower(0, -2.5, '#fbf7f2')}${flower(7, -1.5, '#f7b8c4')}${flower(14, 2, '#c9b8e8')}`,
  },
  {
    id: 'crown',
    label: 'Crown',
    slot: 'head',
    art: `<path d="M-12 2v-11l6 5.5L0-14l6 10.5L12-9V2Z" fill="#f5cd6a" stroke="#d9a93a" stroke-width="1.2" stroke-linejoin="round"/>
      <circle cy="-2.5" r="2" fill="#e0525a"/><circle cx="-7" cy="-2" r="1.4" fill="#6fb3dc"/><circle cx="7" cy="-2" r="1.4" fill="#6fb3dc"/>`,
  },
  {
    id: 'rainbow',
    label: 'Rainbow',
    slot: 'back',
    art: `<g fill="none" stroke-width="4.5" opacity=".6">${['#f28a9a', '#f6b26b', '#f7d24c', '#8fd18f', '#7fb8f0', '#b49af0']
      .map((c, i) => `<path d="M${12 + i * 4.5} 66a${48 - i * 4.5} ${48 - i * 4.5} 0 0 1 ${96 - i * 9} 0" stroke="${c}"/>`)
      .join('')}</g>`,
  },
];

export const accessoryById = (id: AccessoryId) => ACCESSORIES.find((a) => a.id === id)!;

/** The worn list made valid: known accessories only, and the last one wins in each slot. */
export function outfit(worn: AccessoryId[]): Accessory[] {
  const bySlot = new Map<Slot, Accessory>();
  for (const id of worn) {
    const a = ACCESSORIES.find((x) => x.id === id);
    if (a) bySlot.set(a.slot, a);
  }
  return [...bySlot.values()];
}

/** Wearing `id` takes off whatever else was in its slot. */
export function wear(worn: AccessoryId[], id: AccessoryId): AccessoryId[] {
  const slot = accessoryById(id).slot;
  return [...worn.filter((w) => ACCESSORIES.find((a) => a.id === w)?.slot !== slot), id];
}
