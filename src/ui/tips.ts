import { backupStatus } from '../core/backupReminder';
import { shortDate } from '../core/format';
import { app, settings } from '../core/log';
import { isIosBrowserTab } from './persist';
import { backUpNow } from './settingsView';

/** One-time tips, shown one at a time in the banner. "Show tips again" in Settings clears `tipsSeen`. */
interface Tip {
  id: string;
  when: () => boolean;
  html: string;
}

const TIPS: Tip[] = [
  {
    id: 'welcome',
    when: () => true,
    html: `<span>👋 <b>Tap a card</b> to log it now. <b>Hold</b> a card to add details first. Logged it late? Use <b>−5m / −15m</b> on the note that pops up.</span>`,
  },
  {
    id: 'install',
    when: isIosBrowserTab,
    html: `<span>📲 <b>Add to Home Screen</b> (Share → Add to Home Screen). Safari can clear data for sites that aren't installed.</span>`,
  },
  {
    id: 'partner',
    when: () => app.get().events.filter((e) => !e.deleted).length >= 10,
    html: `<span>👥 Two phones? <b>Settings → Share with partner</b> sends your log; importing it on the other phone merges the two.</span>`,
  },
];

export const TIP_IDS = TIPS.map((t) => t.id);

/** Shows the first unseen tip; otherwise the backup reminder when it's due. Safe to call often. */
export function showBanner() {
  const banner = document.getElementById('banner')!;
  const s = settings.get();
  const seen = new Set(s.tipsSeen);
  const tip = TIPS.find((t) => !seen.has(t.id) && t.when());
  let html = '';
  if (tip) {
    html = `${tip.html}<button type="button" class="chip" data-tip-done="${tip.id}">Got it</button>`;
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
    if (done) settings.set({ tipsSeen: [...settings.get().tipsSeen, done.dataset.tipDone!] });
    else if (t.closest('[data-backup]')) void backUpNow().then(showBanner);
    else if (t.closest('[data-backup-later]')) {
      // The count reminder returns at the next 50; the every-few-days one tomorrow.
      settings.set({ backupSnoozedAt: backupStatus(app.get().events, settings.get(), Date.now()).newSince, backupLaterAt: Date.now() });
    } else return;
    banner.hidden = true;
    banner.innerHTML = banner.dataset.html = '';
  };
}

export function resetTips() {
  settings.set({ tipsSeen: [] });
  showBanner();
}
