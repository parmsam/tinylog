/**
 * Companion characters. Each one is SVG markup in a 120×96 box that follows one contract, so the
 * shared states and reactions (see companion.ts) work on all of them:
 * - `.p-body` wraps the character (it squishes and hops); `.p-eyes` blink; `.p-closed` shows while asleep
 * - mouths: `.p-smile` (default), `.p-o` (sip / yawn / surprise), `.p-wince`; `.p-sweat` while fussy
 * - eyes sit near (47–73, 45–52) and the mouth near (60, 60), so shared props (bottle, hearts…) line up
 * Character-only parts use `c-` classes and are animated in styles.css under `[data-companion=…]`.
 */

export type CompanionId = 'puff' | 'sadie' | 'moon' | 'bunny' | 'duck';

export interface Character {
  id: CompanionId;
  label: string;
  /** How the status line greets you, e.g. "Hi from Sadie". */
  greeting: string;
  body: string;
}

const INK = '#2b2340';

const PUFF: Character = {
  id: 'puff',
  label: 'Puff',
  greeting: 'Hi from Puff',
  body: `<path class="p-fill" d="M30 70c-12 0-20-8-20-18s8-17 18-17c2-12 13-21 26-21 11 0 20 6 24 15 3-1 5-2 8-2 12 0 21 9 21 21 0 12-9 22-21 22H30Z"/>
    <ellipse class="p-cheek" cx="40" cy="58" rx="6" ry="3.5"/><ellipse class="p-cheek" cx="80" cy="58" rx="6" ry="3.5"/>
    <g class="p-eyes"><ellipse cx="47" cy="49" rx="3.6" ry="4.6"/><ellipse cx="73" cy="49" rx="3.6" ry="4.6"/>
      <circle class="p-glint" cx="48.4" cy="47.2" r="1.2"/><circle class="p-glint" cx="74.4" cy="47.2" r="1.2"/></g>
    <path class="p-closed" d="M42 50q5 4 10 0M68 50q5 4 10 0"/>
    <path class="p-mouth p-smile" d="M55 59q5 5 10 0"/>
    <ellipse class="p-mouth p-o" cx="60" cy="60" rx="3.2" ry="3.8"/>
    <path class="p-mouth p-wince" d="M53 60l3-2 4 2 4-2 3 2"/>
    <path class="p-sweat" d="M88 34c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8Z"/>`,
};

/** Sadie: a mini golden retriever pup, sitting: round face, fluffy wavy ears, a top-knot, red collar and a wagging tail. */
const SADIE: Character = {
  id: 'sadie',
  label: 'Sadie',
  greeting: 'Hi from Sadie',
  body: `<g class="c-tail"><path d="M76 80C88 80 98 72 99 59C100 53 96 49 92 51C95 57 91 67 78 71Z" fill="#e0a553"/>
      <path d="M96 55q3 1 3 4M97 62q3 1 2 4M93 69q2 2 0 5" fill="none" stroke="#f3c67e" stroke-width="1.6" stroke-linecap="round"/></g>
    <ellipse cx="60" cy="75" rx="20" ry="13.5" fill="#edb566"/>
    <path d="M49 69q2 4 0 8q3-2 4 2q2-3 4 1q2-3 4 0q2-3 4 1q2-4 4-1q1-4 4-2q-2-4 0-8Z" fill="#f8e2b8"/>
    <ellipse cx="50" cy="87" rx="6.5" ry="3.8" fill="#f6d9a6"/><ellipse cx="70" cy="87" rx="6.5" ry="3.8" fill="#f6d9a6"/>
    <rect x="45" y="63" width="30" height="5" rx="2.5" fill="#e0525a"/><circle cx="60" cy="70" r="3" fill="#f5cd6a"/>
    <circle cx="60" cy="46" r="21.5" fill="#edb566"/>
    <path class="c-topknot" d="M50 28q1-7 6-5q1-5 5-2q3-4 6 1q4-1 3 5q-5-3-10-1q-5-2-10 2Z" fill="#f3c67e"/>
    <g class="c-ears">
      <path class="c-ear-l" d="M41 34q-9 2-10 12q-2 4 0 8q-1 4 2 7q1 4 5 4q3 1 5-2q3-3 2-7q2-4 0-8q1-5-1-9q-1-4-3-5Z" fill="#d38f3f"/>
      <path class="c-ear-r" d="M79 34q9 2 10 12q2 4 0 8q1 4-2 7q-1 4-5 4q-3 1-5-2q-3-3-2-7q-2-4 0-8q-1-5 1-9q1-4 3-5Z" fill="#d38f3f"/>
    </g>
    <ellipse cx="60" cy="56.5" rx="11" ry="8" fill="#f8e2b8"/>
    <ellipse class="p-cheek" cx="45" cy="55" rx="4.2" ry="2.6"/><ellipse class="p-cheek" cx="75" cy="55" rx="4.2" ry="2.6"/>
    <g class="p-eyes"><ellipse cx="51" cy="45" rx="3.5" ry="4.2" fill="#2b1d16"/><ellipse cx="69" cy="45" rx="3.5" ry="4.2" fill="#2b1d16"/>
      <circle cx="52.3" cy="43.4" r="1.25" fill="#fff"/><circle cx="70.3" cy="43.4" r="1.25" fill="#fff"/></g>
    <path class="p-closed" d="M46 46q5 4 10 0M64 46q5 4 10 0" style="stroke:#2b1d16"/>
    <ellipse cx="60" cy="53" rx="4" ry="2.9" fill="#3a2a22"/><ellipse cx="58.8" cy="52.2" rx="1.2" ry=".7" fill="#fff" opacity=".6"/>
    <path class="p-mouth p-smile" d="M60 56v2.5M55 58.5q5 4 10 0" style="stroke:#3a2a22"/>
    <g class="p-mouth p-o"><ellipse cx="60" cy="60.5" rx="3.4" ry="3.6" fill="#3a2a22"/><ellipse cx="60" cy="63" rx="2.6" ry="2.4" fill="#f28a9a"/></g>
    <path class="p-mouth p-wince" d="M54 59.5l2-1.5 4 1.5 4-1.5 2 1.5" style="stroke:#3a2a22"/>
    <path class="p-sweat" d="M86 28c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8Z"/>`,
};

/** Moon: a sleepy moon in a nightcap. Rocks gently while the baby sleeps. */
const MOON: Character = {
  id: 'moon',
  label: 'Moon',
  greeting: 'Hi from Moon',
  body: `<defs><clipPath id="moon-clip"><circle cx="60" cy="52" r="28"/></clipPath></defs>
    <circle cx="60" cy="52" r="28" fill="#f7e7a6"/>
    <circle cx="74" cy="46" r="26" fill="#e8d07c" opacity=".45" clip-path="url(#moon-clip)"/>
    <circle cx="42" cy="62" r="3.5" fill="#e9d48a"/><circle cx="78" cy="66" r="2.5" fill="#e9d48a"/><circle cx="70" cy="34" r="2" fill="#e9d48a"/>
    <path d="M36 34 Q56 16 84 26 L100 8 Z" fill="#8b7cf0"/>
    <ellipse cx="60" cy="29" rx="25" ry="5" transform="rotate(-10 60 29)" fill="#f4f0ff"/>
    <circle cx="100" cy="8" r="5" fill="#f4f0ff"/>
    <ellipse class="p-cheek" cx="42" cy="58" rx="5" ry="3"/><ellipse class="p-cheek" cx="78" cy="58" rx="5" ry="3"/>
    <g class="p-eyes"><ellipse cx="50" cy="50" rx="3.2" ry="4.2" fill="${INK}"/><ellipse cx="70" cy="50" rx="3.2" ry="4.2" fill="${INK}"/>
      <circle cx="51.2" cy="48.4" r="1.1" fill="#fff"/><circle cx="71.2" cy="48.4" r="1.1" fill="#fff"/></g>
    <path class="p-closed" d="M45 51q5 4 10 0M65 51q5 4 10 0"/>
    <path class="p-mouth p-smile" d="M55 60q5 5 10 0"/>
    <ellipse class="p-mouth p-o" cx="60" cy="61" rx="3" ry="3.6"/>
    <path class="p-mouth p-wince" d="M53 61l3-2 4 2 4-2 3 2"/>
    <path class="p-sweat" d="M90 40c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8Z"/>`,
};

/** Bunny: ears perk up for feeds and flop down for naps; the nose twitches. */
const BUNNY: Character = {
  id: 'bunny',
  label: 'Bunny',
  greeting: 'Hi from Bunny',
  body: `<g class="c-ear-l"><ellipse cx="48" cy="22" rx="7" ry="20" transform="rotate(-8 48 22)" fill="#f7f2ef" stroke="#e3d8d3"/>
      <ellipse cx="48" cy="23" rx="3.4" ry="14" transform="rotate(-8 48 23)" fill="#f7b8c4"/></g>
    <g class="c-ear-r"><ellipse cx="72" cy="22" rx="7" ry="20" transform="rotate(8 72 22)" fill="#f7f2ef" stroke="#e3d8d3"/>
      <ellipse cx="72" cy="23" rx="3.4" ry="14" transform="rotate(8 72 23)" fill="#f7b8c4"/></g>
    <ellipse cx="60" cy="80" rx="19" ry="10" fill="#f7f2ef" stroke="#e3d8d3"/>
    <ellipse cx="60" cy="54" rx="24" ry="21" fill="#f7f2ef" stroke="#e3d8d3"/>
    <ellipse class="p-cheek" cx="44" cy="60" rx="5" ry="3"/><ellipse class="p-cheek" cx="76" cy="60" rx="5" ry="3"/>
    <g class="p-eyes"><ellipse cx="50" cy="51" rx="3.2" ry="4.2" fill="${INK}"/><ellipse cx="70" cy="51" rx="3.2" ry="4.2" fill="${INK}"/>
      <circle cx="51.2" cy="49.4" r="1.1" fill="#fff"/><circle cx="71.2" cy="49.4" r="1.1" fill="#fff"/></g>
    <path class="p-closed" d="M45 52q5 4 10 0M65 52q5 4 10 0"/>
    <path class="c-nose" d="M57 58h6l-3 3.2Z" fill="#f28a9a"/>
    <path d="M44 60h-9M44 63l-8 2M76 60h9M76 63l8 2" stroke="#cfc3be" stroke-width="1" stroke-linecap="round"/>
    <path class="p-mouth p-smile" d="M60 61.5v2M56 64q2 2 4 0q2 2 4 0"/>
    <ellipse class="p-mouth p-o" cx="60" cy="65" rx="2.6" ry="3"/>
    <path class="p-mouth p-wince" d="M55 65l2-1.5 3 1.5 3-1.5 2 1.5"/>
    <path class="p-sweat" d="M86 38c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8Z"/>`,
};

/** Duckling: splashes at bath time, flaps for tummy time. */
const DUCK: Character = {
  id: 'duck',
  label: 'Duckling',
  greeting: 'Hi from Duckling',
  body: `<ellipse cx="62" cy="73" rx="27" ry="16" fill="#f7d24c"/>
    <path d="M87 70q8-6 6-14q-4 8-10 8Z" fill="#f7d24c"/>
    <ellipse class="c-wing" cx="72" cy="73" rx="11" ry="7" fill="#eebd2e"/>
    <ellipse cx="54" cy="87" rx="6" ry="2.5" fill="#f39a3c"/><ellipse cx="70" cy="87" rx="6" ry="2.5" fill="#f39a3c"/>
    <circle cx="56" cy="47" r="21" fill="#f7d24c"/>
    <path d="M54 26q2-8 8-6q-4 1-3 6q3-5 7-2q-5 1-5 4Z" fill="#f2c233"/>
    <ellipse class="p-cheek" cx="40" cy="54" rx="4.5" ry="2.8"/><ellipse class="p-cheek" cx="72" cy="54" rx="4.5" ry="2.8"/>
    <g class="p-eyes"><ellipse cx="47" cy="46" rx="3" ry="4" fill="${INK}"/><ellipse cx="65" cy="46" rx="3" ry="4" fill="${INK}"/>
      <circle cx="48.1" cy="44.4" r="1.1" fill="#fff"/><circle cx="66.1" cy="44.4" r="1.1" fill="#fff"/></g>
    <path class="p-closed" d="M42 47q5 4 10 0M60 47q5 4 10 0"/>
    <ellipse cx="56" cy="58" rx="10" ry="4.8" fill="#f39a3c"/>
    <path class="p-mouth p-smile" d="M47 58q9 3 18 0" style="stroke:#c9702a"/>
    <ellipse class="p-mouth p-o" cx="56" cy="59" rx="4.5" ry="3" fill="#b35a1e"/>
    <path class="p-mouth p-wince" d="M48 58l3-1.5 5 1.5 5-1.5 3 1.5" style="stroke:#c9702a"/>
    <path class="p-sweat" d="M84 30c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8Z"/>`,
};

export const CHARACTERS: Character[] = [PUFF, SADIE, MOON, BUNNY, DUCK];

export const characterById = (id: CompanionId) => CHARACTERS.find((c) => c.id === id) ?? PUFF;

/** Shared reaction props, drawn over any character. */
export const PROPS = `<g class="p-prop p-bottle"><rect x="70" y="56" width="16" height="9" rx="4"/><rect x="84" y="58" width="6" height="5" rx="2" class="p-nipple"/></g>
    <g class="p-prop p-drop"><path d="M96 50c3 5 5 8 5 10a5 5 0 0 1-10 0c0-2 2-5 5-10Z"/></g>
    <g class="p-prop p-stink"><path d="M24 30q-4-5 0-10t0-10M34 26q-4-5 0-10"/></g>
    <g class="p-prop p-sparkles"><path d="M20 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM98 18l1.5 3.5 3.5 1.5-3.5 1.5L98 28l-1.5-3.5L93 23l3.5-1.5Z"/></g>
    <g class="p-prop p-hearts"><path d="M96 26c0-3 4-4 5-1 1-3 5-2 5 1 0 3-5 6-5 6s-5-3-5-6Z"/><path d="M18 36c0-2.4 3.2-3.2 4-.8.8-2.4 4-1.6 4 .8 0 2.4-4 4.8-4 4.8s-4-2.4-4-4.8Z"/></g>
    <g class="p-prop p-bubbles"><circle cx="22" cy="40" r="4"/><circle cx="30" cy="26" r="3"/><circle cx="98" cy="30" r="5"/><circle cx="92" cy="16" r="2.5"/></g>
    <g class="p-prop p-plus"><rect x="92" y="18" width="12" height="4" rx="1.5"/><rect x="96" y="14" width="4" height="12" rx="1.5"/></g>`;

/** Full SVG for a character. `preview` renders a still, smaller version for pickers. */
export function characterSvg(id: CompanionId, opts: { preview?: boolean } = {}): string {
  const c = characterById(id);
  const cls = opts.preview ? 'buddy preview' : 'buddy';
  return `<svg class="${cls}" viewBox="0 0 120 96" aria-hidden="true" data-companion="${c.id}" data-state="idle">
    <ellipse class="p-shadow" cx="60" cy="90" rx="34" ry="4"/>
    <g class="p-bob"><g class="p-body">${c.body}</g>${opts.preview ? '' : PROPS}</g>
    <g class="p-zs"><text x="92" y="30">z</text><text x="100" y="20">z</text><text x="108" y="10">z</text></g>
  </svg>`;
}
