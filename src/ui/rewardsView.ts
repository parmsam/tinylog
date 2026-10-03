import { coins, nextMilestone } from '../core/coins';
import { app, settings } from '../core/log';
import { accessoryById, wear } from '../companion/accessories';
import { characterById, characterSvg } from '../companion/characters';
import { REWARDS, type Reward, type Tier } from '../companion/rewards';
import { currentCompanion } from './companion';

/**
 * Coins & rewards (tap the coin chip): today's and all-time coins, the way to the next milestone,
 * a medal for every milestone, and what each one unlocks. Unlocked accessories can be put on and
 * taken off here, and unlocked companions picked. Everything comes from the all-time coin total.
 */
const TIER: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

function medalSvg(r: Reward, earned: boolean): string {
  return `<svg class="medal-art" viewBox="0 0 40 48" aria-hidden="true" data-tier="${earned ? r.tier : 'locked'}">
    <path class="medal-ribbon" d="M12 0h7l-3 18h-7ZM21 0h7l3 18h-7Z"/>
    <circle class="medal-disc" cx="20" cy="30" r="15"/><circle class="medal-rim" cx="20" cy="30" r="11.5"/>
    <text x="20" y="34.5" text-anchor="middle">${r.at >= 1000 ? `${r.at / 1000}k` : r.at}</text></svg>`;
}

function unlockLabel(r: Reward): string {
  if (!r.unlock) return '';
  return r.unlock.kind === 'accessory' ? accessoryById(r.unlock.id).label : characterById(r.unlock.id).label;
}

function unlockTile(r: Reward, total: number): string {
  const u = r.unlock!;
  const earned = total >= r.at;
  const s = settings.get();
  const name = unlockLabel(r);
  const togo = `${r.at.toLocaleString()} coins<br>${(r.at - total).toLocaleString()} to go`;
  if (u.kind === 'accessory') {
    const art = characterSvg(currentCompanion(), { preview: true, wearing: [u.id] });
    const on = s.accessories.includes(u.id);
    const state = earned ? (on ? 'Wearing' : 'Tap to wear') : togo;
    return `<li><button type="button" class="unlock-tile" data-wear="${u.id}" aria-pressed="${on}" ${earned ? '' : 'disabled'}>
      ${art}<b>${name}</b><span>${state}</span></button></li>`;
  }
  const chosen = s.companion === u.id;
  const state = earned ? (chosen ? 'Your companion' : 'Tap to choose') : togo;
  return `<li><button type="button" class="unlock-tile" data-buddy="${u.id}" aria-pressed="${chosen}" ${earned ? '' : 'disabled'}>
    ${characterSvg(u.id, { preview: true })}<b>${name}</b><span>${state}</span></button></li>`;
}

function render(dialog: HTMLDialogElement) {
  const { today, total } = coins(app.get().events, Date.now(), settings.get().dayStartHour);
  const next = nextMilestone(total);
  const prev = [...REWARDS].reverse().find((r) => r.at <= total)?.at ?? 0;
  const nextReward = REWARDS.find((r) => r.at === next);
  const earned = REWARDS.filter((r) => r.at <= total).length;
  const pct = next ? Math.round(((total - prev) / (next - prev)) * 100) : 100;
  dialog.innerHTML = `<div class="rewards"><div class="sheet-head"><h2 id="rewards-title">Coins &amp; rewards</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <p class="coin-summary"><span class="coin big" aria-hidden="true"></span>
      <span><b>${today.toLocaleString()}</b> today · <b>${total.toLocaleString()}</b> all time</span></p>
    ${
      next
        ? `<div class="coin-next"><p>Next: <b>${next.toLocaleString()}</b> coins${nextReward?.unlock ? ` · ${unlockLabel(nextReward)}` : ''} · ${(next - total).toLocaleString()} to go</p>
          <div class="coin-meter" role="progressbar" aria-label="Progress to ${next.toLocaleString()} coins" aria-valuemin="${prev}" aria-valuemax="${next}" aria-valuenow="${total}"><span style="width:${pct}%"></span></div></div>`
        : '<p class="coin-next">Every reward unlocked. Wow.</p>'
    }
    <p class="hint">One coin for every entry. Rewards follow the all-time total, so nothing is ever spent or lost.</p>
    <h3>Medals <span class="muted">${earned} of ${REWARDS.length}</span></h3>
    <ul class="medals">${REWARDS.map((r) => {
      const got = r.at <= total;
      return `<li class="${got ? 'earned' : 'locked'}" aria-label="${r.at.toLocaleString()} coins: ${TIER[r.tier].toLowerCase()} medal, ${got ? 'earned' : 'not yet'}" data-tip="${r.at.toLocaleString()} coins">${medalSvg(r, got)}</li>`;
    }).join('')}</ul>
    <h3>Unlocks</h3>
    <ul class="unlocks">${REWARDS.filter((r) => r.unlock).map((r) => unlockTile(r, total)).join('')}</ul>
    <p class="hint">Moon keeps its nightcap and Unicorn its horn, so those two skip hats.</p></div>`;
}

export function openRewards() {
  const dialog = document.getElementById('rewards') as HTMLDialogElement;
  render(dialog);
  dialog.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t === dialog || t.closest('[data-close]')) return dialog.close();
    const tile = t.closest<HTMLButtonElement>('.unlock-tile');
    if (!tile || tile.disabled) return;
    const s = settings.get();
    if (tile.dataset.wear) {
      const id = tile.dataset.wear as (typeof s.accessories)[number];
      settings.set({ accessories: s.accessories.includes(id) ? s.accessories.filter((a) => a !== id) : wear(s.accessories, id) });
    } else if (tile.dataset.buddy) settings.set({ companion: tile.dataset.buddy as typeof s.companion });
    render(dialog);
    dialog.querySelector<HTMLButtonElement>(`.unlock-tile[data-wear="${tile.dataset.wear ?? ''}"], .unlock-tile[data-buddy="${tile.dataset.buddy ?? ''}"]`)?.focus();
  };
  if (!dialog.open) dialog.showModal();
}
