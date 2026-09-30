import { animate, type AnimationParams } from 'animejs';

/**
 * Puff, a little cloud who keeps you company. States mirror what's going on (asleep while the baby
 * sleeps, a worried wobble during a fussy spell); reactions play once when something is logged.
 * Decoration only: Puff never looks sad about anything missed.
 */

export type CompanionState = 'idle' | 'sleeping' | 'fussy' | 'tummy' | 'pump';
export type Reaction = 'feed' | 'wet' | 'dirty' | 'sleep' | 'wake' | 'tummy' | 'pump' | 'fussy' | 'settled' | 'bath' | 'doctor' | 'undo';

const BODY =
  'M30 70c-12 0-20-8-20-18s8-17 18-17c2-12 13-21 26-21 11 0 20 6 24 15 3-1 5-2 8-2 12 0 21 9 21 21 0 12-9 22-21 22H30Z';

export const CLOUD_SVG = `<svg class="puff" viewBox="0 0 120 96" aria-hidden="true" data-state="idle">
  <ellipse class="p-shadow" cx="60" cy="88" rx="36" ry="4"/>
  <g class="p-bob">
    <g class="p-body">
      <path class="p-fill" d="${BODY}"/>
      <ellipse class="p-cheek" cx="40" cy="58" rx="6" ry="3.5"/><ellipse class="p-cheek" cx="80" cy="58" rx="6" ry="3.5"/>
      <g class="p-eyes"><ellipse cx="47" cy="49" rx="3.6" ry="4.6"/><ellipse cx="73" cy="49" rx="3.6" ry="4.6"/>
        <circle class="p-glint" cx="48.4" cy="47.2" r="1.2"/><circle class="p-glint" cx="74.4" cy="47.2" r="1.2"/></g>
      <path class="p-closed" d="M42 50q5 4 10 0M68 50q5 4 10 0"/>
      <path class="p-mouth p-smile" d="M55 59q5 5 10 0"/>
      <ellipse class="p-mouth p-o" cx="60" cy="60" rx="3.2" ry="3.8"/>
      <path class="p-mouth p-wince" d="M53 60l3-2 4 2 4-2 3 2"/>
      <path class="p-sweat" d="M88 34c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8Z"/>
    </g>
    <g class="p-prop p-bottle"><rect x="70" y="56" width="16" height="9" rx="4"/><rect x="84" y="58" width="6" height="5" rx="2" class="p-nipple"/></g>
    <g class="p-prop p-drop"><path d="M96 50c3 5 5 8 5 10a5 5 0 0 1-10 0c0-2 2-5 5-10Z"/></g>
    <g class="p-prop p-stink"><path d="M24 30q-4-5 0-10t0-10M34 26q-4-5 0-10"/></g>
    <g class="p-prop p-sparkles"><path d="M20 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM98 18l1.5 3.5 3.5 1.5-3.5 1.5L98 28l-1.5-3.5L93 23l3.5-1.5Z"/></g>
    <g class="p-prop p-hearts"><path d="M96 26c0-3 4-4 5-1 1-3 5-2 5 1 0 3-5 6-5 6s-5-3-5-6Z"/><path d="M18 36c0-2.4 3.2-3.2 4-.8.8-2.4 4-1.6 4 .8 0 2.4-4 4.8-4 4.8s-4-2.4-4-4.8Z"/></g>
    <g class="p-prop p-bubbles"><circle cx="22" cy="40" r="4"/><circle cx="30" cy="26" r="3"/><circle cx="98" cy="30" r="5"/><circle cx="92" cy="16" r="2.5"/></g>
    <g class="p-prop p-plus"><rect x="92" y="18" width="12" height="4" rx="1.5"/><rect x="96" y="14" width="4" height="12" rx="1.5"/></g>
  </g>
  <g class="p-zs"><text x="92" y="30">z</text><text x="100" y="20">z</text><text x="108" y="10">z</text></g>
</svg>`;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const quiet = () => reduced() || document.documentElement.dataset.theme === 'night';

export class Cloud {
  private root: SVGSVGElement;
  private faceTimer: number | undefined;

  constructor(host: HTMLElement) {
    host.innerHTML = CLOUD_SVG;
    this.root = host.querySelector('svg.puff')!;
  }

  setState(state: CompanionState) {
    if (this.root.dataset.state !== state) this.root.dataset.state = state;
  }

  private setFace(face: 'smile' | 'o' | 'wince', ms = 0) {
    this.root.dataset.face = face;
    clearTimeout(this.faceTimer);
    if (ms) this.faceTimer = window.setTimeout(() => this.setFace('smile'), ms);
  }

  /** Shows a prop for a moment (bottle, sparkles…), popping it in and out. */
  private prop(name: string, ms = 1400) {
    const el = this.root.querySelector<SVGGElement>(`.p-${name}`);
    if (!el) return;
    el.classList.add('show');
    if (!quiet()) {
      animate(el, { opacity: [0, 1], translateY: [6, 0], duration: 260, ease: 'outBack' });
      animate(el, { opacity: [1, 0], translateY: [0, -6], duration: 300, delay: ms, ease: 'inQuad', onComplete: () => el.classList.remove('show') });
    } else window.setTimeout(() => el.classList.remove('show'), ms);
  }

  private body(params: AnimationParams) {
    if (quiet()) return;
    animate(this.root.querySelector('.p-body')!, params);
  }

  react(r: Reaction) {
    switch (r) {
      case 'feed':
        this.setFace('o', 1500);
        this.prop('bottle', 1300);
        window.setTimeout(() => this.prop('hearts', 900), 700);
        this.body({ scaleY: [{ to: 0.94, duration: 160 }, { to: 1, duration: 500, ease: 'outElastic(1, .5)' }] });
        break;
      case 'wet':
        this.prop('drop', 900);
        this.body({ translateY: [{ to: -6, duration: 180, ease: 'outQuad' }, { to: 0, duration: 420, ease: 'outBounce' }] });
        break;
      case 'dirty':
        this.setFace('wince', 900);
        this.prop('stink', 800);
        window.setTimeout(() => this.prop('sparkles', 900), 900);
        this.body({ rotate: [{ to: -6, duration: 120 }, { to: 6, duration: 120 }, { to: 0, duration: 300, ease: 'outElastic(1, .6)' }] });
        break;
      case 'sleep':
        this.setFace('o', 900); // a yawn, then the state takes over
        this.body({ scaleY: [{ to: 1.06, duration: 500 }, { to: 1, duration: 600 }] });
        break;
      case 'wake':
        this.prop('sparkles', 900);
        this.body({ scaleY: [{ to: 1.12, duration: 260, ease: 'outQuad' }, { to: 1, duration: 520, ease: 'outElastic(1, .5)' }] });
        break;
      case 'tummy':
        this.body({ rotate: [{ to: -10, duration: 200 }, { to: 10, duration: 260 }, { to: 0, duration: 420, ease: 'outElastic(1, .6)' }] });
        break;
      case 'pump':
        this.prop('drop', 1100);
        break;
      case 'fussy':
        this.setFace('wince', 1200);
        this.body({ translateX: [{ to: -3, duration: 70 }, { to: 3, duration: 70 }, { to: -2, duration: 70 }, { to: 0, duration: 70 }] });
        break;
      case 'settled':
        this.prop('hearts', 1100);
        this.body({ scaleY: [{ to: 0.92, duration: 300 }, { to: 1, duration: 700, ease: 'outElastic(1, .5)' }] }); // a big sigh
        break;
      case 'bath':
        this.prop('bubbles', 1500);
        break;
      case 'doctor':
        this.prop('plus', 1200);
        this.prop('sparkles', 1200);
        break;
      case 'undo':
        this.setFace('o', 600);
        break;
    }
  }
}
