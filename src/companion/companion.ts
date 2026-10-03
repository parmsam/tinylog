import { animate, type AnimationParams } from 'animejs';
import { characterSvg, type CompanionId } from './characters';
import type { TimeOfDay } from './mood';
import type { AccessoryId } from '../core/types';

/**
 * A little companion who keeps you company. States mirror what's going on (asleep while the baby
 * sleeps, a worried wobble during a fussy spell); reactions play once when something is logged.
 * Every character shares these (see the contract in characters.ts) and adds its own touches in CSS.
 * Decoration only: a companion never looks sad about anything missed.
 */

export type CompanionState = 'idle' | 'sleeping' | 'fussy' | 'tummy' | 'pump';
export type Reaction =
  | 'feed'
  | 'wet'
  | 'dirty'
  | 'sleep'
  | 'wake'
  | 'tummy'
  | 'pump'
  | 'fussy'
  | 'settled'
  | 'bath'
  | 'doctor'
  | 'undo'
  // Moments of the day (see mood.ts)
  | 'morning'
  | 'goodnight'
  | 'proud'
  | 'cheer'
  // Idle bits, by time of day (and taps)
  | 'giggle'
  | 'stretch'
  | 'look'
  | 'yawn';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const quiet = () => reduced() || document.documentElement.dataset.theme === 'night';

export class Companion {
  private root!: SVGSVGElement;
  private faceTimer: number | undefined;
  private excitedTimer: number | undefined;
  id: CompanionId;
  private wearing: AccessoryId[] = [];

  constructor(
    private host: HTMLElement,
    id: CompanionId,
  ) {
    this.id = id;
    this.draw();
  }

  private draw() {
    const { state = 'idle', time } = this.root?.dataset ?? {};
    this.host.innerHTML = characterSvg(this.id, { wearing: this.wearing });
    this.root = this.host.querySelector('svg.buddy')!;
    this.root.dataset.state = state;
    if (time) this.root.dataset.time = time;
  }

  setCharacter(id: CompanionId) {
    if (id === this.id) return;
    this.id = id;
    this.draw();
  }

  /** What it's wearing (already filtered to what's unlocked). */
  setOutfit(wearing: AccessoryId[]) {
    if (wearing.join() === this.wearing.join()) return;
    this.wearing = [...wearing];
    this.draw();
  }

  setState(state: CompanionState) {
    if (this.root.dataset.state !== state) this.root.dataset.state = state;
  }

  private setFace(face: 'smile' | 'o' | 'wince', ms = 0) {
    this.root.dataset.face = face;
    clearTimeout(this.faceTimer);
    if (ms) this.faceTimer = window.setTimeout(() => this.setFace('smile'), ms);
  }

  /** A moment of excitement each character shows its own way (Sadie wags faster, Bunny's ears perk up). */
  private excite(ms = 1600) {
    this.root.dataset.excited = '';
    clearTimeout(this.excitedTimer);
    this.excitedTimer = window.setTimeout(() => delete this.root.dataset.excited, ms);
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
        this.excite();
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
        this.excite();
        this.prop('sparkles', 900);
        this.body({ scaleY: [{ to: 1.12, duration: 260, ease: 'outQuad' }, { to: 1, duration: 520, ease: 'outElastic(1, .5)' }] });
        break;
      case 'tummy':
        this.excite(1200);
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
        this.excite(1500);
        this.prop('bubbles', 1500);
        break;
      case 'doctor':
        this.prop('plus', 1200);
        this.prop('sparkles', 1200);
        break;
      case 'undo':
        this.setFace('o', 600);
        break;
      case 'morning': // a big yawn and stretch, then sparkles
        this.setFace('o', 1100);
        this.body({ scaleY: [{ to: 1.14, duration: 700, ease: 'outQuad' }, { to: 1, duration: 700, ease: 'outElastic(1, .5)' }] });
        window.setTimeout(() => {
          this.excite(1400);
          this.prop('sparkles', 1100);
        }, 1100);
        break;
      case 'goodnight':
        this.setFace('o', 1300);
        this.prop('hearts', 1500);
        this.body({ scaleY: [{ to: 1.06, duration: 700 }, { to: 0.94, duration: 600 }, { to: 1, duration: 800 }] });
        break;
      case 'proud':
        this.excite(2400);
        this.prop('sparkles', 1600);
        window.setTimeout(() => this.prop('hearts', 1200), 800);
        this.body({ translateY: [{ to: -9, duration: 200, ease: 'outQuad' }, { to: 0, duration: 260, ease: 'inQuad' }, { to: -6, duration: 180, ease: 'outQuad' }, { to: 0, duration: 420, ease: 'outBounce' }] });
        break;
      case 'cheer':
        this.excite(1600);
        this.prop('hearts', 1200);
        this.body({ translateY: [{ to: -7, duration: 200, ease: 'outQuad' }, { to: 0, duration: 460, ease: 'outBounce' }] });
        break;
      case 'giggle':
        this.setFace('o', 700);
        this.excite(1000);
        this.body({ rotate: [{ to: -7, duration: 90 }, { to: 7, duration: 90 }, { to: -5, duration: 90 }, { to: 4, duration: 90 }, { to: 0, duration: 320, ease: 'outElastic(1, .6)' }] });
        break;
      case 'stretch':
        this.body({ scaleY: [{ to: 1.08, duration: 600, ease: 'outQuad' }, { to: 1, duration: 600, ease: 'outElastic(1, .6)' }] });
        break;
      case 'look':
        this.body({ rotate: [{ to: -5, duration: 500 }, { to: 0, duration: 400, delay: 600 }, { to: 5, duration: 500 }, { to: 0, duration: 400, delay: 600 }] });
        break;
      case 'yawn':
        this.setFace('o', 1200);
        this.body({ scaleY: [{ to: 1.05, duration: 600 }, { to: 1, duration: 700 }] });
        break;
    }
  }

  /** Time of day, for the drowsier look in the evening and at night (CSS under `[data-time]`). */
  setTime(tod: TimeOfDay) {
    if (this.root.dataset.time !== tod) this.root.dataset.time = tod;
  }
}
