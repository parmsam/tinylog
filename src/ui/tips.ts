import { backupStatus } from '../core/backupReminder';
import { shortDate } from '../core/format';
import { app, settings } from '../core/log';
import { isIosBrowserTab } from './persist';
import { exportDownload } from './settingsView';

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

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem('tinylog:banner-dismissed') === '1';
  } catch {
    return false;
  }
}

function dismissForSession() {
  try {
    sessionStorage.setItem('tinylog:banner-dismissed', '1');
  } catch {
    /* ignore */
  }
}

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
    const { newSince, reason } = backupStatus(app.get().events, s, Date.now());
    // The weekly reminder waits for the next session after "Not now"; the count one returns at the next 50.
    if (reason === 'count' || (reason === 'time' && !dismissedThisSession())) {
      const when = s.lastBackupAt ? `since your last backup (${shortDate(s.lastBackupAt)})` : 'and no backup yet';
      const msg = reason === 'count' ? `💾 <b>${newSince} new entries</b> ${when}.` : `💾 It's been a while since your last backup.`;
      html = `<span>${msg}</span><span class="btn-row"><button type="button" class="chip" data-backup-later>Not now</button><button type="button" class="chip primary" data-backup>Export</button></span>`;
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
    else if (t.closest('[data-backup]')) exportDownload();
    else if (t.closest('[data-backup-later]')) {
      settings.set({ backupSnoozedAt: backupStatus(app.get().events, settings.get(), Date.now()).newSince });
      dismissForSession();
    } else return;
    banner.hidden = true;
    banner.innerHTML = banner.dataset.html = '';
  };
}

export function resetTips() {
  settings.set({ tipsSeen: [] });
  try {
    sessionStorage.removeItem('tinylog:banner-dismissed');
  } catch {
    /* ignore */
  }
  showBanner();
}
