import { backupStatus } from '../core/backupReminder';
import { shortDate } from '../core/format';
import { app, settings } from '../core/log';
import { isAndroid, isPhoneBrowserTab } from './install';
import { isIosBrowserTab } from './persist';
import { backUpNow } from './settingsView';

/**
 * One-time tips, shown one at a time in the banner when they become useful (`when`). "Next tip"
 * steps through all of them (the ones that apply on this device), so nobody has to wait to learn
 * more; browsing doesn't mark them seen, "Got it" does. "Show tips again" in Settings clears `tipsSeen`.
 */
interface Tip {
  id: string;
  when: () => boolean;
  /** Only on some devices (never shown, even when browsing, elsewhere). */
  applies?: () => boolean;
  html: string;
}

const entries = () => app.get().events.filter((e) => !e.deleted).length;

const TIPS: Tip[] = [
  {
    id: 'welcome',
    when: () => true,
    html: `<span>👋 <b>Tap a card</b> to log it now. <b>Hold</b> a card to add details first. Logged it late? Use <b>−5m / −15m</b> on the note that pops up.</span>`,
  },
  {
    id: 'install',
    when: () => true,
    applies: isIosBrowserTab,
    html: `<span>📲 <b>Add to Home Screen</b> (Share → Add to Home Screen). Safari can clear data for sites that aren't installed. Steps: <b>Settings → Install the app</b>.</span>`,
  },
  {
    id: 'install-android',
    when: () => true,
    applies: () => isAndroid() && isPhoneBrowserTab(),
    html: `<span>📲 <b>Install tinylog</b> (⋮ menu → Add to Home screen) for a full-screen app that works offline. Steps: <b>Settings → Install the app</b>.</span>`,
  },
  {
    id: 'partner',
    when: () => entries() >= 10,
    html: `<span>👥 Two phones? <b>Settings → Share with partner</b> sends your log; importing it on the other phone merges the two.</span>`,
  },
  {
    id: 'edit',
    when: () => entries() >= 3,
    html: `<span>✏️ <b>Tap any entry</b> in the log to fix its time, add details or delete it.</span>`,
  },
  {
    id: 'coins',
    when: () => entries() >= 5,
    html: `<span>🪙 Every entry earns a coin. <b>Tap the coins</b> by the companion for medals and unlocks: hats, bow ties and new friends.</span>`,
  },
  {
    id: 'recap',
    when: () => entries() >= 15,
    html: `<span>✨ <b>Recap</b>, under the clock, turns the day into a picture you can share.</span>`,
  },
  {
    id: 'trends',
    when: () => entries() >= 30,
    html: `<span>📈 <b>Trends</b> (top right) shows patterns across days: sleep, feeds and diapers.</span>`,
  },
  {
    id: 'bedside',
    when: () => entries() >= 40,
    html: `<span>🌙 <b>Bedside display</b> (top right) is a dim, glanceable screen for night feeds.</span>`,
  },
  {
    id: 'siri',
    when: () => entries() >= 60,
    html: `<span>🗣️ Log by voice or a Home Screen tap: <b>Settings → Shortcuts &amp; Siri</b> has ready-made links.</span>`,
  },
];

export const TIP_IDS = TIPS.map((t) => t.id);

/** The tip being browsed with "Next tip" (undefined: the banner shows whatever is due). */
let browsing: string | undefined;

const applicable = () => TIPS.filter((t) => !t.applies || t.applies());

/** The tip after `id` when browsing, round and round. */
export function nextTipId(id: string, ids = applicable().map((t) => t.id)): string {
  return ids[(ids.indexOf(id) + 1) % ids.length];
}

/** Shows the first unseen tip that's due (or the one being browsed); otherwise the backup reminder when it's due. Safe to call often. */
export function showBanner() {
  const banner = document.getElementById('banner')!;
  const s = settings.get();
  const seen = new Set(s.tipsSeen);
  const tips = applicable();
  const tip = tips.find((t) => t.id === browsing) ?? tips.find((t) => !seen.has(t.id) && t.when());
  let html = '';
  if (tip) {
    const more = tips.length > 1 ? `<span class="tip-count" aria-label="Tip ${tips.indexOf(tip) + 1} of ${tips.length}">${tips.indexOf(tip) + 1}/${tips.length}</span><button type="button" class="chip" data-tip-next="${tip.id}" aria-label="Next tip">Next ›</button>` : '';
    html = `${tip.html}<span class="btn-row tip-actions">${more}<button type="button" class="chip" data-tip-done="${tip.id}">Got it</button></span>`;
  } else {
    const { newSince, reason, days } = backupStatus(app.get().events, s, Date.now());
    if (reason) {
      const last = s.lastBackupAt ? `your last backup (${shortDate(s.lastBackupAt)})` : '';
      const msg =
        reason === 'count'
          ? `💾 <b>${newSince} new entries</b> ${last ? `since ${last}` : 'and no backup yet'}.`
          : last
            ? `💾 <b>${days} days</b> since ${last}. Save a copy so nothing gets lost.`
            : `💾 <b>No backup yet.</b> Save a copy so nothing gets lost.`;
      html = `<span>${msg}</span><span class="btn-row"><button type="button" class="chip" data-backup-later>Not now</button><button type="button" class="chip primary" data-backup>Back up now</button></span>`;
    }
  }
  // Only touch the DOM when the banner actually changes (this runs on every new entry).
  if (banner.dataset.html === html) return;
  banner.dataset.html = html;
  banner.hidden = !html;
  banner.innerHTML = html;
  banner.onclick = (e) => {
    const t = e.target as HTMLElement;
    const done = t.closest<HTMLElement>('[data-tip-done]');
    const next = t.closest<HTMLElement>('[data-tip-next]');
    if (next) {
      browsing = nextTipId(next.dataset.tipNext!);
      showBanner();
      banner.querySelector<HTMLElement>('[data-tip-next]')?.focus();
      return;
    }
    if (done) {
      browsing = undefined;
      const id = done.dataset.tipDone!;
      if (!settings.get().tipsSeen.includes(id)) settings.set({ tipsSeen: [...settings.get().tipsSeen, id] });
    } else if (t.closest('[data-backup]')) void backUpNow().then(showBanner);
    else if (t.closest('[data-backup-later]')) {
      // The count reminder returns at the next 50; the every-few-days one tomorrow.
      settings.set({ backupSnoozedAt: backupStatus(app.get().events, settings.get(), Date.now()).newSince, backupLaterAt: Date.now() });
    } else return;
    banner.hidden = true;
    banner.innerHTML = banner.dataset.html = '';
  };
}

export function resetTips() {
  browsing = undefined;
  settings.set({ tipsSeen: [] });
  showBanner();
}
