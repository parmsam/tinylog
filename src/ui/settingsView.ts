import { backupFilename, BackupError, parseBackup, toBackup } from '../core/backup';
import { coins, nextMilestone } from '../core/coins';
import { BACKUP_DAY_CHOICES, DEFAULT_SETTINGS } from '../core/settings';
import { shortDate } from '../core/format';
import { app, importData, settings, snapshot } from '../core/log';
import { CARDS } from '../core/cards';
import type { Settings } from '../core/types';
import { copyText, downloadText } from './clipboard';
import { storageStatus } from './persist';
import { canPromptInstall, installGuideHtml, isStandalone, onInstallChange, promptInstall } from './install';
import { isIos, isTouchDevice } from '../core/haptics';
import { PREVIEWS } from './scenePreviews';
import { BASE_IDS, CHARACTERS, characterSvg } from '../companion/characters';
import { unlockAt } from '../companion/rewards';
import { openRewards } from './rewardsView';
import { currentOutfit } from './companion';
import { resetTips } from './tips';
import type { Background } from '../core/types';

const BACKGROUNDS: [Background, string][] = [
  ['glow', 'Glow'],
  ['sky', 'Night sky'],
  ['fireflies', 'Fireflies'],
  ['bubbles', 'Bubbles'],
  ['mobile', 'Crib mobile'],
  ['snow', 'Snow'],
  ['none', 'Plain'],
];
/** The "Surprise me" companion tile: a question mark with a little sparkle. */
const SURPRISE_ART = `<svg class="surprise" viewBox="0 0 120 96" aria-hidden="true">
  <circle cx="60" cy="50" r="30" fill="currentColor" opacity=".12"/>
  <path d="M50 42a10 10 0 1 1 15 8.7c-3 1.7-5 3.6-5 7.3v2" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <circle cx="60" cy="70" r="3.6" fill="currentColor"/>
  <path d="M92 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="currentColor" opacity=".6"/>
</svg>`;
import { toast } from './toast';

/** Ready-made link actions for the Shortcuts & Siri section (relative to the app's own URL). */
const LINKS = (units: Settings['units']): [string, string][] => [
  ['💧 Wet diaper', '?do=log&what=wet'],
  ['💩 Dirty diaper', '?do=log&what=dirty'],
  ['🍼 Feed (the other breast)', '?do=log&what=feed'],
  ['🍼 Bottle', units === 'oz' ? '?do=log&what=bottle&oz=3' : '?do=log&what=bottle&ml=90'],
  ['😴 Sleep (start / stop)', '?do=toggle&what=sleep'],
  ['🤸 Tummy time (start / stop)', '?do=toggle&what=tummy'],
];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function seg(name: keyof Settings, options: [string, string][], value: string, legend: string) {
  return `<fieldset class="field"><legend>${legend}</legend><div class="seg">${options
    .map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''} /><span>${l}</span></label>`)
    .join('')}</div></fieldset>`;
}

function hourLabel(h: number) {
  return new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
}

export function exportFile(type = 'application/json'): File {
  const now = Date.now();
  const text = JSON.stringify(toBackup(snapshot(), now), null, 1);
  const name = backupFilename(now);
  return new File([text], type === 'text/plain' ? name.replace(/\.json$/, '.txt') : name, { type });
}

function markBackedUp() {
  settings.set({ lastBackupAt: Date.now(), backupSnoozedAt: 0, backupLaterAt: 0 });
}

export function exportDownload() {
  const f = exportFile();
  void f.text().then((t) => downloadText(f.name, t, 'application/json'));
  markBackedUp();
  toast('Exported. Keep the file somewhere safe (Files, iCloud Drive…)');
}

/**
 * The export as a file the share sheet will take. iPhone shares the .json as is; Android Chrome
 * only shares allowlisted types (no JSON), so there it goes as plain text with a .txt name.
 */
function shareableExport(): File | null {
  for (const type of ['application/json', 'text/plain']) {
    const file = exportFile(type);
    if (navigator.canShare?.({ files: [file] })) return file;
  }
  return null;
}

/** Sends the export through the share sheet (AirDrop, Messages…) so the other phone can import it. */
function shareWithPartner() {
  return shareExport('tinylog export', 'Open in tinylog → Settings → Import to merge.');
}

/**
 * A backup from the reminder: on phones, the share sheet (Save to Files, iCloud Drive, Google
 * Drive…), which is where a phone keeps files; elsewhere a download.
 */
export function backUpNow() {
  if (isTouchDevice() || isIos()) return shareExport('tinylog backup', 'A tinylog backup. To restore: tinylog → Settings → Import.');
  exportDownload();
  return Promise.resolve();
}

async function shareExport(title: string, text: string) {
  const file = shareableExport();
  if (file) {
    try {
      await navigator.share({ files: [file], title, text });
      markBackedUp();
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') toast("Couldn't open the share sheet. Downloading instead.");
      else return;
      exportDownload();
    }
  } else exportDownload();
}

async function importFile(file: File) {
  try {
    const parsed = parseBackup(await file.text());
    const { added, updated } = await importData(parsed);
    const bits = [`${added} new`, `${updated} updated`];
    if (parsed.skipped) bits.push(`${parsed.skipped} skipped`);
    toast(added || updated ? `Merged: ${bits.join(', ')}` : 'Already up to date. Nothing new in that file.');
  } catch (err) {
    toast(err instanceof BackupError ? err.message : "Couldn't read that file.");
  }
}

function backupChoiceLabel(days: number): string {
  if (!days) return 'Only every 50 entries';
  const label = days === 7 ? 'Every week' : days === 14 ? 'Every 2 weeks' : `Every ${days} days`;
  return days === DEFAULT_SETTINGS.backupEveryDays ? `${label} (default)` : label;
}

export function openSettings() {
  const dialog = document.getElementById('settings') as HTMLDialogElement;
  const s = settings.get();
  const canShare = typeof navigator.canShare === 'function';
  const purse = coins(app.get().events, Date.now(), s.dayStartHour);
  const next = nextMilestone(purse.total);
  dialog.innerHTML = `<form novalidate>
    <div class="sheet-head"><h2 id="settings-title">Settings</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <label class="field"><span class="field-label">Baby's name</span>
      <input type="text" name="babyName" value="${esc(s.babyName)}" placeholder="Shown at the top. Stays on this device." autocomplete="off" /></label>
    ${seg('units', [['ml', 'ml'], ['oz', 'oz']], s.units, 'Volume')}
    ${seg('clock', [['auto', 'Auto'], ['12h', '12-hour'], ['24h', '24-hour']], s.clock, 'Clock')}
    ${seg('theme', [['auto', 'Auto'], ['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night']], s.theme, 'Theme')}
    <p class="hint">Auto switches to the dim, warm night theme from 9 PM to 6 AM.</p>
    ${seg('gridMarks', [['dots', '● Dots'], ['checks', '✓ Checks'], ['crosses', '✕ Crosses']], s.gridMarks, 'Grid marks (feeds and diapers)')}
    <fieldset class="field"><legend>Buttons</legend><div class="seg card-toggles">${CARDS.map(
      (c) => `<label><input type="checkbox" data-card-toggle value="${c.id}" ${s.hiddenCards.includes(c.id) ? '' : 'checked'} /><span>${c.emoji} ${c.label}</span></label>`,
    ).join('')}</div>
      <p class="hint">Pick the buttons you use. Turned-off ones leave the home screen, but past entries, links and keys still work.</p></fieldset>
    <fieldset class="field"><legend>Background</legend><div class="scene-picker">${BACKGROUNDS.map(
      ([id, label]) =>
        `<label class="scene-tile"><input type="radio" name="background" value="${id}" ${id === s.background ? 'checked' : ''} />${PREVIEWS[id]}<span>${label}</span></label>`,
    ).join('')}</div></fieldset>
    <fieldset class="field"><legend>Companion</legend><div class="scene-picker buddy-picker">${[
      ...CHARACTERS.map((c) => [c.id, c.label, characterSvg(c.id, { preview: true, wearing: currentOutfit(purse.total) })]),
      ['random', 'Surprise me', SURPRISE_ART],
      ['off', 'Off', '<svg viewBox="0 0 120 96" aria-hidden="true"></svg>'],
    ]
      .map(([id, label, art]) => {
        const at = BASE_IDS.includes(id as never) ? undefined : unlockAt('companion', id);
        const locked = at !== undefined && purse.total < at;
        return `<label class="scene-tile${locked ? ' locked' : ''}"><input type="radio" name="companion" value="${id}" ${id === s.companion ? 'checked' : ''} ${locked ? 'disabled' : ''} />${art}<span>${label}${locked ? `<small>🔒 ${at!.toLocaleString()} coins</small>` : ''}</span></label>`;
      })
      .join('')}</div>
      <p class="hint">Surprise me brings a different companion each day.</p>
      <p class="hint coin-total"><span class="coin" aria-hidden="true"></span> <b>${purse.total.toLocaleString()}</b> ${purse.total === 1 ? 'coin' : 'coins'} all time · ${purse.today} today. One for every entry, shown next to the companion.${next ? ` Next milestone: ${next.toLocaleString()}.` : ''}</p>
      <div class="btn-row"><button type="button" class="btn" data-rewards>Medals &amp; unlocks</button></div></fieldset>
    ${isTouchDevice() || isIos() ? `<label class="check"><input type="checkbox" name="haptics" ${s.haptics ? 'checked' : ''} /> Haptic taps</label>` : ''}
    <label class="field"><span class="field-label">A day starts at</span>
      <select name="dayStartHour">${Array.from({ length: 13 }, (_, h) => `<option value="${h}" ${h === s.dayStartHour ? 'selected' : ''}>${h === 0 ? 'Midnight' : hourLabel(h)}</option>`).join('')}</select></label>

    <section class="settings-section" aria-labelledby="data-h">
      <h3 id="data-h">Your data</h3>
      <p class="status-line" id="data-status">…</p>
      <p class="status-line" id="storage-status"></p>
      <div class="btn-row">
        ${canShare ? '<button type="button" class="btn primary" data-share>Share with partner</button>' : ''}
        <button type="button" class="btn" data-export>Export backup</button>
        <label class="btn" role="button" tabindex="0">Import…<input type="file" accept="application/json,.json,text/plain,.txt" data-import hidden /></label>
      </div>
      <p class="hint">Two phones? Share an export and import it on the other phone. Importing merges: nothing is lost, the newest edit wins, and importing the same file twice is safe.</p>
      <label class="field"><span class="field-label">Remind me to back up</span>
        <select name="backupEveryDays">${BACKUP_DAY_CHOICES.map((d) => `<option value="${d}" ${d === s.backupEveryDays ? 'selected' : ''}>${backupChoiceLabel(d)}</option>`).join('')}</select></label>
      <p class="hint">The reminder has a <b>Back up now</b> button. It also comes every 50 new entries.</p>
    </section>

    <section class="settings-section" aria-labelledby="install-h">
      <h3 id="install-h">Install the app</h3>
      ${
        isStandalone()
          ? '<p class="status-line">✓ Running as an installed app.</p>'
          : `<p class="hint">Add tinylog to your Home Screen: it opens full screen like an app, works offline, and on iPhone keeps your log safe (Safari can clear data for sites that aren't installed). On iPhone the installed app starts with its own, empty log: if you've already logged in Safari, <b>Export backup</b> here and import it there.</p>
      <div class="btn-row" data-install-row ${canPromptInstall() ? '' : 'hidden'}><button type="button" class="btn primary" data-install>Install tinylog</button></div>
      ${installGuideHtml()}`
      }
    </section>

    <section class="settings-section" aria-labelledby="links-h">
      <h3 id="links-h">Shortcuts &amp; Siri</h3>
      <p class="hint">Each link logs something when opened. In the iPhone <b>Shortcuts</b> app: New Shortcut → <b>Open URLs</b> → paste a link → name it (say, “Wet diaper”). Then: “Hey Siri, wet diaper.” Add <code>&amp;ago=15</code> to log it 15 minutes ago.</p>
      <ul class="link-list">${LINKS(s.units)
        .map(([label, q]) => `<li><span>${label}</span><code>${esc(q)}</code><button type="button" class="chip" data-copy-link="${esc(q)}">Copy</button></li>`)
        .join('')}</ul>
      <p class="hint"><b>iPhone note:</b> links open in Safari, and iOS keeps a Home Screen app's data separate from Safari's. If you log with Siri, use tinylog in Safari for that phone (and back up), or merge the two with Share with partner.</p>
    </section>

    <section class="settings-section">
      <h3>Tips</h3>
      <div class="btn-row"><button type="button" class="btn" data-tips-reset>Show tips again</button></div>
    </section>

    <section class="settings-section">
      <h3>About</h3>
      <p class="hint">tinylog v${__APP_VERSION__}. Everything stays in this browser: no accounts, no servers, no tracking. Patterns are descriptions of your log, not medical advice. <a href="https://github.com/parmsam/tinylog" target="_blank" rel="noopener">Source on GitHub</a>.</p>
    </section>
  </form>`;

  void refreshStatus(dialog);

  dialog.oninput = dialog.onchange = (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-card-toggle]')) {
      if (e.type !== 'change') return;
      const boxes = [...dialog.querySelectorAll<HTMLInputElement>('[data-card-toggle]')];
      if (!boxes.some((b) => b.checked)) {
        t.checked = true;
        toast('Keep at least one button');
        return;
      }
      settings.set({ hiddenCards: boxes.filter((b) => !b.checked).map((b) => b.value) });
      return;
    }
    const name = t.name as keyof Settings;
    if (!name || t.type === 'file') return;
    if (t.type === 'radio' && !t.checked) return;
    const value = name === 'dayStartHour' || name === 'backupEveryDays' ? Number(t.value) : t.type === 'checkbox' ? t.checked : t.value;
    settings.set({ [name]: value } as Partial<Settings>);
  };
  dialog.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t === dialog || t.closest('[data-close]')) dialog.close();
    else if (t.closest('[data-rewards]')) {
      dialog.close();
      openRewards();
    }
    else if (t.closest('[data-export]')) {
      exportDownload();
      void refreshStatus(dialog);
    } else if (t.closest('[data-share]')) void shareWithPartner().then(() => refreshStatus(dialog));
    else if (t.closest('[data-copy-link]')) {
      const q = t.closest<HTMLElement>('[data-copy-link]')!.dataset.copyLink!;
      void copyText(new URL(q, location.origin + import.meta.env.BASE_URL).href).then((ok) => toast(ok ? 'Link copied' : "Couldn't copy"));
    } else if (t.closest('[data-install]')) void promptInstall().then((ok) => ok && toast('Installing tinylog. Open it from your Home Screen.'));
    else if (t.closest('[data-tips-reset]')) {
      resetTips();
      dialog.close();
      toast('Tips will show again, starting now');
    }
  };
  dialog.querySelector<HTMLInputElement>('[data-import]')!.onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      await importFile(file);
      void refreshStatus(dialog);
    }
  };
  dialog.querySelector<HTMLElement>('label[role="button"]')!.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dialog.querySelector<HTMLInputElement>('[data-import]')!.click();
    }
  };
  dialog.onsubmit = (e) => e.preventDefault();
  const stop = onInstallChange(() => {
    const row = dialog.querySelector<HTMLElement>('[data-install-row]');
    if (row) row.hidden = !canPromptInstall();
  });
  dialog.addEventListener('close', () => stop(), { once: true });

  if (!dialog.open) dialog.showModal();
}

async function refreshStatus(dialog: HTMLDialogElement) {
  const s = app.get();
  const count = s.events.filter((e) => !e.deleted).length;
  const last = settings.get().lastBackupAt;
  const data = dialog.querySelector('#data-status');
  if (data) data.textContent = `${count} entries · last backup: ${last ? shortDate(last) : 'never'}`;
  const st = await storageStatus();
  const el = dialog.querySelector('#storage-status');
  if (!el) return;
  const problems: string[] = [];
  if (!s.idbOk) problems.push('IndexedDB is unavailable, so only the backup copy is saving');
  if (!s.mirrorOk) problems.push("the backup copy couldn't be saved");
  if (problems.length) {
    el.textContent = `⚠︎ ${problems.join('; ')}. Export a backup now.`;
    el.classList.add('warn');
  } else {
    el.classList.remove('warn');
    const kb = st.usage ? ` · ${Math.max(1, Math.round(st.usage / 1024))} KB used` : '';
    el.textContent = `Saved on this device${st.persisted ? ' (protected from clean-up)' : ''}${kb}.`;
  }
}
