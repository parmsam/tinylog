import { backupFilename, BackupError, parseBackup, toBackup } from '../core/backup';
import { shortDate } from '../core/format';
import { app, importData, settings, snapshot } from '../core/log';
import type { Settings } from '../core/types';
import { copyText, downloadText } from './clipboard';
import { storageStatus } from './persist';
import { isIos, isTouchDevice } from '../core/haptics';
import { PREVIEWS } from './scenePreviews';
import { CHARACTERS, characterSvg } from '../companion/characters';
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

export function exportFile(): File {
  const now = Date.now();
  const text = JSON.stringify(toBackup(snapshot(), now), null, 1);
  return new File([text], backupFilename(now), { type: 'application/json' });
}

function markBackedUp() {
  settings.set({ lastBackupAt: Date.now(), backupSnoozedAt: 0 });
}

export function exportDownload() {
  const f = exportFile();
  void f.text().then((t) => downloadText(f.name, t, 'application/json'));
  markBackedUp();
  toast('Exported. Keep the file somewhere safe (Files, iCloud Drive…)');
}

/** Sends the export through the share sheet (AirDrop, Messages…) so the other phone can import it. */
async function shareWithPartner() {
  const file = exportFile();
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'tinylog export', text: 'Open in tinylog → Settings → Import to merge.' });
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

export function openSettings() {
  const dialog = document.getElementById('settings') as HTMLDialogElement;
  const s = settings.get();
  const canShare = typeof navigator.canShare === 'function';
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
    <fieldset class="field"><legend>Background</legend><div class="scene-picker">${BACKGROUNDS.map(
      ([id, label]) =>
        `<label class="scene-tile"><input type="radio" name="background" value="${id}" ${id === s.background ? 'checked' : ''} />${PREVIEWS[id]}<span>${label}</span></label>`,
    ).join('')}</div></fieldset>
    <fieldset class="field"><legend>Companion</legend><div class="scene-picker buddy-picker">${[...CHARACTERS.map((c) => [c.id, c.label, characterSvg(c.id, { preview: true })]), ['off', 'Off', '<svg viewBox="0 0 120 96" aria-hidden="true"></svg>']]
      .map(([id, label, art]) => `<label class="scene-tile"><input type="radio" name="companion" value="${id}" ${id === s.companion ? 'checked' : ''} />${art}<span>${label}</span></label>`)
      .join('')}</div></fieldset>
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
        <label class="btn" role="button" tabindex="0">Import…<input type="file" accept="application/json,.json" data-import hidden /></label>
      </div>
      <p class="hint">Two phones? Share an export and import it on the other phone. Importing merges: nothing is lost, the newest edit wins, and importing the same file twice is safe.</p>
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
    const name = t.name as keyof Settings;
    if (!name || t.type === 'file') return;
    if (t.type === 'radio' && !t.checked) return;
    const value = name === 'dayStartHour' ? Number(t.value) : t.type === 'checkbox' ? t.checked : t.value;
    settings.set({ [name]: value } as Partial<Settings>);
  };
  dialog.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t === dialog || t.closest('[data-close]')) dialog.close();
    else if (t.closest('[data-export]')) {
      exportDownload();
      void refreshStatus(dialog);
    } else if (t.closest('[data-share]')) void shareWithPartner().then(() => refreshStatus(dialog));
    else if (t.closest('[data-copy-link]')) {
      const q = t.closest<HTMLElement>('[data-copy-link]')!.dataset.copyLink!;
      void copyText(new URL(q, location.origin + import.meta.env.BASE_URL).href).then((ok) => toast(ok ? 'Link copied' : "Couldn't copy"));
    } else if (t.closest('[data-tips-reset]')) {
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
