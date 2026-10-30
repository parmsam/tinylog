export interface ConfirmOpts {
  title: string;
  /** One line under the title, e.g. which entry. Plain text. */
  body?: string;
  /** Label of the confirming button. */
  confirm: string;
  danger?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A small "are you sure?" sheet. Resolves true only when the confirm button is pressed. */
export function confirmAction(opts: ConfirmOpts): Promise<boolean> {
  const dialog = document.getElementById('confirm') as HTMLDialogElement;
  dialog.innerHTML = `<form method="dialog">
    <div class="sheet-head"><h2 id="confirm-title">${esc(opts.title)}</h2></div>
    ${opts.body ? `<p class="confirm-body">${esc(opts.body)}</p>` : ''}
    <div class="actions">
      <button type="submit" class="btn" value="cancel" data-cancel>Cancel</button>
      <button type="submit" class="btn ${opts.danger ? 'danger' : 'primary'}" value="ok">${esc(opts.confirm)}</button>
    </div>
  </form>`;
  dialog.returnValue = '';
  return new Promise((resolve) => {
    dialog.onclick = (e) => {
      if (e.target === dialog) dialog.close();
    };
    // Escape, a backdrop tap and Cancel all land here with something other than 'ok'.
    dialog.onclose = () => {
      dialog.onclose = null;
      resolve(dialog.returnValue === 'ok');
    };
    dialog.showModal();
    // Cancel gets focus, so Enter right after a swipe doesn't delete.
    dialog.querySelector<HTMLElement>('[data-cancel]')?.focus();
  });
}
