import { CARDS } from '../core/cards';

/** Everything the keyboard can do. The cheat sheet and the README table both come from here. */
export const SHORTCUTS: [keys: string, what: string][] = [
  ...CARDS.map((c) => [c.key.toUpperCase(), `${c.emoji} ${c.timed ? `Start / stop ${c.label.toLowerCase()}` : c.sheetFirst ? `Add ${c.label.toLowerCase()} visit` : `Log ${c.label.toLowerCase()}`}`] as [string, string]),
  ['U', 'Undo the last action'],
  ['← / →', 'Previous / next day'],
  ['.', 'Back to today'],
  ['G', 'Trends'],
  ['A', 'Bedside display'],
  ['M', 'Copy today as Markdown'],
  [',', 'Settings'],
  ['?', 'This list'],
];

export function openShortcuts() {
  const dialog = document.getElementById('shortcuts') as HTMLDialogElement;
  dialog.innerHTML = `<form method="dialog">
    <div class="sheet-head"><h2 id="shortcuts-title">Keyboard shortcuts</h2>
      <button class="icon-btn" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <dl class="keys">${SHORTCUTS.map(([k, w]) => `<div><dt>${k.split(' / ').map((x) => `<kbd>${x}</kbd>`).join(' ')}</dt><dd>${w}</dd></div>`).join('')}</dl>
    <p class="hint">On a phone: tap a card to log, hold it for details.</p>
  </form>`;
  dialog.onclick = (e) => {
    if (e.target === dialog) dialog.close();
  };
  if (!dialog.open) dialog.showModal();
}
