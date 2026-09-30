import { dayDate } from '../core/days';
import { amount, dayTitle, duration } from '../core/format';
import { app, settings } from '../core/log';
import { toMarkdown } from '../core/markdown';
import { recap } from '../core/recap';
import { drawRecap } from '../recap/draw';
import { copyText } from './clipboard';
import { companionElement } from './companion';
import { toast } from './toast';

const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'display', 'font-size', 'font-weight', 'font-family'];

/**
 * A self-contained copy of the live companion: every element gets its computed colors inlined,
 * so it draws the same inside an <img> (which can't see the page's CSS). Moving parts are left at rest.
 */
function companionSnapshot(): string | null {
  const svg = companionElement();
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll('*')];
  const to = [clone, ...clone.querySelectorAll('*')];
  from.forEach((el, i) => {
    const cs = getComputedStyle(el);
    (to[i] as SVGElement).setAttribute('style', STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  });
  clone.querySelectorAll('.p-prop').forEach((el) => el.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '240');
  clone.setAttribute('height', '192');
  return new XMLSerializer().serializeToString(clone);
}

/** The day recap: a shareable card for the selected day, as PNG, plus the day as Markdown. */
export async function openRecap() {
  const dialog = document.getElementById('recap') as HTMLDialogElement;
  const now = Date.now();
  const s = app.get();
  const prefs = settings.get();
  const r = recap(s.events, s.notes, s.day, prefs.dayStartHour, now);
  const name = prefs.babyName.trim();
  const title = `${name ? `${name}'s day` : 'The day'} · ${dayTitle(dayDate(s.day))}`;
  const t = r.totals;
  const alt = [
    title,
    t.sleepMs ? `asleep ${duration(t.sleepMs)}` : '',
    `${t.feeds} feeds${t.bottleMl ? ` (${amount(t.bottleMl, prefs.units)} by bottle)` : ''}`,
    `${t.wet + t.dirty} diapers`,
    r.longest ? `longest stretch ${duration(r.longest.ms)}` : '',
    r.note ? `note: ${r.note}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  dialog.innerHTML = `<div class="recap">
    <div class="sheet-head"><h2 id="recap-title">Day recap</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="recap-frame"><img class="recap-img" alt="${alt.replace(/"/g, '&quot;')}" /></div>
    <div class="btn-row recap-actions">
      <button type="button" class="btn primary" data-share hidden>Share</button>
      <button type="button" class="btn" data-download>Save image</button>
      <button type="button" class="btn" data-md>Copy as Markdown</button>
    </div>
  </div>`;
  if (!dialog.open) dialog.showModal();

  const canvas = document.createElement('canvas');
  await drawRecap(canvas, r, prefs, now, companionSnapshot());
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) {
    toast("Couldn't draw the recap on this device.");
    return;
  }
  const file = new File([blob], `tinylog-${s.day}.png`, { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const img = dialog.querySelector<HTMLImageElement>('.recap-img')!;
  img.src = url;
  const share = dialog.querySelector<HTMLButtonElement>('[data-share]')!;
  share.hidden = !navigator.canShare?.({ files: [file] });

  dialog.onclick = async (e) => {
    const el = e.target as HTMLElement;
    if (el === dialog || el.closest('[data-close]')) dialog.close();
    else if (el.closest('[data-download]')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
    } else if (el.closest('[data-share]')) {
      try {
        await navigator.share({ files: [file], title });
      } catch {
        /* cancelled */
      }
    } else if (el.closest('[data-md]')) {
      const ok = await copyText(toMarkdown(s.events, s.notes, s.day, s.day, prefs, now));
      toast(ok ? 'Copied the day as Markdown' : "Couldn't copy");
    }
  };
  dialog.onclose = () => URL.revokeObjectURL(url);
}
