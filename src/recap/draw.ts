import { dayDate, dayRange, spanEnd } from '../core/days';
import { amount, clockTime, dayTitle, duration } from '../core/format';
import type { Recap } from '../core/recap';
import type { Settings } from '../core/types';
import { frac, TAU } from '../viz/geom';

/**
 * Draws the recap card with Canvas 2D (1080×1350, a portrait share size). Canvas instead of an
 * HTML screenshot: no library, and iOS Safari won't export SVG <foreignObject> to a PNG.
 */

export const W = 1080;
export const H = 1350;

type Prefs = Pick<Settings, 'units' | 'clock' | 'dayStartHour' | 'babyName'>;

/** Resolves any CSS color (vars, color-mix, oklab) to rgb() the canvas will accept everywhere. */
function resolver() {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);
  const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  return {
    get(css: string): string {
      probe.style.color = '';
      probe.style.color = css;
      px.clearRect(0, 0, 1, 1);
      px.fillStyle = '#000';
      px.fillStyle = getComputedStyle(probe).color;
      px.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = px.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
    },
    done: () => probe.remove(),
  };
}

function puffSvg(body: string, ink: string, cheek: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 96" width="240" height="192">
    <ellipse cx="60" cy="88" rx="36" ry="4" fill="${ink}" opacity=".15"/>
    <path d="M30 70c-12 0-20-8-20-18s8-17 18-17c2-12 13-21 26-21 11 0 20 6 24 15 3-1 5-2 8-2 12 0 21 9 21 21 0 12-9 22-21 22H30Z" fill="${body}" stroke="${ink}" stroke-opacity=".14" stroke-width="1.5"/>
    <ellipse cx="40" cy="58" rx="6" ry="3.5" fill="${cheek}" opacity=".6"/><ellipse cx="80" cy="58" rx="6" ry="3.5" fill="${cheek}" opacity=".6"/>
    <ellipse cx="47" cy="49" rx="3.6" ry="4.6" fill="${ink}"/><ellipse cx="73" cy="49" rx="3.6" ry="4.6" fill="${ink}"/>
    <circle cx="48.4" cy="47.2" r="1.2" fill="${body}"/><circle cx="74.4" cy="47.2" r="1.2" fill="${body}"/>
    <path d="M55 59q5 5 10 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;
}

function loadImage(svg: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Seeded stars so the same day always draws the same sky. */
function stars(ctx: CanvasRenderingContext2D, seed: number, color: string) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  ctx.fillStyle = color;
  for (let i = 0; i < 90; i++) {
    const x = r() * W;
    const y = r() * H * 0.55;
    ctx.globalAlpha = 0.15 + r() * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + r() * 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  return lines;
}

export async function drawRecap(canvas: HTMLCanvasElement, r: Recap, prefs: Prefs, now: number): Promise<void> {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  await Promise.all(['800 80px Nunito', '700 40px Nunito', '600 32px Nunito'].map((f) => document.fonts?.load(f).catch(() => undefined)));
  const c = resolver();
  const col = {
    bg: c.get('var(--bg)'),
    bg2: c.get('var(--bg2)'),
    text: c.get('var(--text)'),
    muted: c.get('var(--muted)'),
    track: c.get('var(--v-track)'),
    surface: c.get('var(--surface-strong)'),
    border: c.get('var(--border)'),
    glow1: c.get('var(--glow1)'),
    glow2: c.get('var(--glow2)'),
    feed: c.get('var(--v-feed)'),
    sleep: c.get('var(--v-sleep)'),
    diaper: c.get('var(--v-diaper)'),
    tummy: c.get('var(--v-tummy)'),
    pump: c.get('var(--v-pump)'),
    fussy: c.get('var(--v-fussy)'),
    puff: c.get('var(--puff)'),
    puffInk: c.get('var(--puff-ink)'),
    puffCheek: c.get('var(--puff-cheek)'),
  };
  c.done();
  const font = (w: number, px: number) => `${w} ${px}px Nunito, ui-rounded, system-ui, sans-serif`;
  const dark = document.documentElement.dataset.theme !== 'day';

  // Background: the app's gradient, two soft glows, and (in the dark themes) a sprinkle of stars.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, col.bg2);
  g.addColorStop(1, col.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, rad, color] of [
    [120, 80, 520, col.glow1],
    [1000, 700, 560, col.glow2],
  ] as const) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, color.replace(/[\d.]+\)$/, '0.35)'));
    rg.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  if (dark) stars(ctx, Number(r.day.replace(/-/g, '')), col.text);

  // Title.
  const name = prefs.babyName.trim();
  ctx.fillStyle = col.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(800, 78);
  ctx.fillText(name ? `${name}'s day` : 'The day', 72, 140);
  ctx.fillStyle = col.muted;
  ctx.font = font(700, 36);
  ctx.fillText(`${dayTitle(dayDate(r.day))}${r.inProgress ? ' · so far' : ''}`, 72, 196);

  // The clock: same lanes as the app (sleep outside, then feeds, diapers, tummy, pump, fussy).
  const cx = W / 2;
  const cy = 560;
  const [start, end] = dayRange(r.day, prefs.dayStartHour);
  const ang = (ts: number) => frac(ts, start, end) * TAU - Math.PI / 2;
  const lane = { sleep: 290, feed: 244, diaper: 208, tummy: 178, pump: 156, fussy: 134 };
  ctx.lineCap = 'round';
  for (const [k, rad] of Object.entries(lane)) {
    ctx.strokeStyle = col.track;
    ctx.lineWidth = k === 'sleep' ? 40 : k === 'feed' || k === 'diaper' ? 24 : 14;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, TAU);
    ctx.stroke();
  }
  // Hour labels.
  ctx.fillStyle = col.muted;
  ctx.font = font(700, 26);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    const h = (prefs.dayStartHour + i * 6) % 24;
    const a = (i / 4) * TAU - Math.PI / 2;
    const label = new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric', hour12: prefs.clock === '24h' ? false : prefs.clock === '12h' ? true : undefined });
    ctx.fillText(label, cx + Math.cos(a) * 344, cy + Math.sin(a) * 344);
  }
  const arc = (rad: number, from: number, to: number, color: string, width: number) => {
    const a0 = ang(Math.max(from, start));
    let a1 = ang(Math.min(to, end));
    if (a1 - a0 < 0.02) a1 = a0 + 0.02;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, a0, a1);
    ctx.stroke();
  };
  const dot = (rad: number, ts: number, size: number, fill: string, hollow = false) => {
    const a = ang(ts);
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fillStyle = hollow ? col.bg : fill;
    ctx.fill();
    ctx.lineWidth = hollow ? 4 : 3;
    ctx.strokeStyle = hollow ? fill : col.bg;
    ctx.stroke();
  };
  for (const e of r.events) {
    const stop = spanEnd(e, now);
    if (e.type === 'sleep') arc(lane.sleep, e.at, stop, col.sleep, e.detail?.sleep === 'night' ? 40 : 28);
    else if (e.type === 'tummy') arc(lane.tummy, e.at, stop, col.tummy, 14);
    else if (e.type === 'pump') arc(lane.pump, e.at, stop, col.pump, 14);
    else if (e.type === 'fussy') arc(lane.fussy, e.at, stop, col.fussy, 14);
  }
  for (const e of r.events) {
    if (e.at < start || e.at >= end) continue;
    if (e.type === 'feed') dot(lane.feed, e.at, 12, col.feed);
    else if (e.type === 'diaper') dot(lane.diaper, e.at, 10, col.diaper, e.detail?.diaper === 'wet' || !e.detail?.diaper);
  }
  // Center.
  ctx.fillStyle = col.text;
  ctx.font = font(800, 64);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(r.totals.sleepMs ? duration(r.totals.sleepMs) : '—', cx, cy + 10);
  ctx.fillStyle = col.muted;
  ctx.font = font(700, 28);
  ctx.fillText('asleep', cx, cy + 52);

  // Stat tiles.
  const t = r.totals;
  const tiles: [string, string, string][] = [
    ['🍼', String(t.feeds), t.bottleMl ? `feeds · ${amount(t.bottleMl, prefs.units)}` : t.feeds === 1 ? 'feed' : 'feeds'],
    ['🧷', `${t.wet + t.dirty}`, `diapers · ${t.dirty} dirty`],
    ['😴', String(t.naps), t.napMs ? `naps · ${duration(t.napMs)}` : t.naps === 1 ? 'nap' : 'naps'],
    ['🤸', t.tummyMs ? duration(t.tummyMs) : '—', 'tummy time'],
  ];
  const tw = (W - 72 * 2 - 3 * 20) / 4;
  tiles.forEach(([emoji, value, label], i) => {
    const x = 72 + i * (tw + 20);
    const y = 930;
    ctx.fillStyle = col.surface.replace(/[\d.]+\)$/, '0.72)');
    ctx.strokeStyle = col.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, tw, 150, 28);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = font(700, 34);
    ctx.fillText(emoji, x + 24, y + 50);
    ctx.fillStyle = col.text;
    ctx.font = font(800, 44);
    ctx.fillText(value, x + 24, y + 104);
    ctx.fillStyle = col.muted;
    ctx.font = font(700, 20);
    ctx.fillText(wrap(ctx, label, tw - 40, 1)[0] ?? '', x + 24, y + 134);
  });

  // Highlights and the day note.
  let y = 1140;
  ctx.textAlign = 'left';
  if (r.longest) {
    ctx.fillStyle = col.text;
    ctx.font = font(700, 32);
    const when = `${clockTime(r.longest.from, prefs.clock)}–${clockTime(r.longest.to, prefs.clock)}`;
    ctx.fillText(`🌙 Longest stretch ${duration(r.longest.ms)} (${when})${r.longestOfWeek ? ' · longest this week ✨' : ''}`, 72, y, W - 144);
    y += 52;
  }
  if (r.note) {
    ctx.fillStyle = col.muted;
    ctx.font = font(600, 30);
    for (const line of wrap(ctx, `“${r.note}”`, W - 144 - 200, 2)) {
      ctx.fillText(line, 72, y);
      y += 42;
    }
  }

  // Puff and the footer.
  const puff = await loadImage(puffSvg(col.puff, col.puffInk, col.puffCheek));
  if (puff) ctx.drawImage(puff, W - 72 - 200, H - 210, 200, 160);
  ctx.fillStyle = col.muted;
  ctx.font = font(700, 24);
  ctx.textAlign = 'left';
  ctx.fillText('tinylog', 72, H - 60);
}
