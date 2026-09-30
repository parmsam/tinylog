/**
 * One floating tooltip for every chart. Marks carry `data-tip`; hover shows it on desktop,
 * a tap shows it on touch (and a tap elsewhere hides it).
 */
let tip: HTMLDivElement | null = null;

function el(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'viz-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.append(tip);
  }
  return tip;
}

function show(text: string, x: number, y: number) {
  const t = el();
  t.textContent = text;
  t.hidden = false;
  const { width, height } = t.getBoundingClientRect();
  const left = Math.min(Math.max(8, x - width / 2), window.innerWidth - width - 8);
  const top = y - height - 14 < 8 ? y + 18 : y - height - 14;
  t.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

export function hideTip() {
  if (tip) tip.hidden = true;
}

export function attachTips(root: HTMLElement | SVGElement) {
  if ((root as HTMLElement).dataset.tips) return;
  (root as HTMLElement).dataset.tips = '1';
  const target = (e: Event) => (e.target as Element).closest<SVGElement | HTMLElement>('[data-tip]');
  root.addEventListener('pointermove', (e) => {
    const pe = e as PointerEvent;
    if (pe.pointerType === 'touch') return;
    const m = target(e);
    if (m) show(m.dataset.tip!, pe.clientX, pe.clientY);
    else hideTip();
  });
  root.addEventListener('pointerleave', hideTip);
  root.addEventListener('click', (e) => {
    const m = target(e);
    const pe = e as PointerEvent;
    if (m) show(m.dataset.tip!, pe.clientX, pe.clientY);
    else hideTip();
  });
  // Keyboard: focusable marks show their tip under themselves.
  root.addEventListener('focusin', (e) => {
    const m = target(e);
    if (!m) return;
    const r = m.getBoundingClientRect();
    show(m.dataset.tip!, r.left + r.width / 2, r.top);
  });
  root.addEventListener('focusout', hideTip);
}

document.addEventListener('scroll', hideTip, { passive: true, capture: true });
document.addEventListener('pointerdown', (e) => {
  if (!(e.target as Element).closest?.('[data-tip]')) hideTip();
});
