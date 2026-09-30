export interface ToastAction {
  label: string;
  run: () => void;
  /** Keep the toast open after running (e.g. the time-shift chips). */
  keepOpen?: boolean;
  primary?: boolean;
}

export interface ToastHandle {
  update(msg: string): void;
  close(): void;
}

let current: { el: HTMLElement; timer: number | undefined } | null = null;

/** Shows one toast at a time; a new one replaces the last, so Undo always refers to the latest action. */
export function toast(msg: string, opts: { actions?: ToastAction[]; duration?: number } = {}): ToastHandle {
  const host = document.getElementById('toasts')!;
  dismiss();
  const el = document.createElement('div');
  el.className = 'toast';
  const text = document.createElement('div');
  text.className = 'toast-msg';
  text.textContent = msg;
  const row = document.createElement('div');
  row.className = 'toast-actions';
  el.append(text, row);

  const duration = opts.duration ?? (opts.actions?.length ? 8000 : 3500);
  const entry = { el, timer: undefined as number | undefined };
  const arm = () => {
    clearTimeout(entry.timer);
    entry.timer = window.setTimeout(close, duration);
  };
  function close() {
    clearTimeout(entry.timer);
    if (current === entry) current = null;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  }

  for (const a of opts.actions ?? []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.primary ? 'chip primary' : 'chip';
    b.textContent = a.label;
    b.addEventListener('click', () => {
      a.run();
      if (a.keepOpen) arm();
      else close();
    });
    row.append(b);
  }

  // Don't vanish while someone is reaching for a button.
  el.addEventListener('pointerenter', () => clearTimeout(entry.timer));
  el.addEventListener('pointerleave', arm);

  host.append(el);
  current = entry;
  arm();
  return {
    update: (m) => {
      text.textContent = m;
    },
    close,
  };
}

export function dismiss() {
  if (!current) return;
  clearTimeout(current.timer);
  current.el.remove();
  current = null;
}
