import { cardFor } from '../core/cards';
import { clockTime, shortDate } from '../core/format';
import { deleteEvent, getEvent, revertTo, settings } from '../core/log';
import { confirmAction } from './confirm';
import { toast } from './toast';

/**
 * Deletes an entry (soft) with an Undo toast. Asks first unless Settings → Ask before deleting is off.
 * Shared by the sheet's Delete button and swiping a log row. Resolves whether it was deleted.
 */
export async function removeEntry(id: string, opts: { beforeToast?: () => void } = {}): Promise<boolean> {
  const ev = getEvent(id);
  const card = ev && cardFor(ev);
  if (!ev || !card) return false;
  if (settings.get().confirmDeletes) {
    const when = `${shortDate(ev.at)} · ${clockTime(ev.at, settings.get().clock)}`;
    const ok = await confirmAction({ title: 'Delete this entry?', body: `${card.emoji} ${card.label} · ${when}`, confirm: 'Delete', danger: true });
    if (!ok) return false;
  }
  const prev = getEvent(id) ?? ev;
  deleteEvent(id);
  // The sheet closes first, or the toast would be placed inside it and vanish with it.
  opts.beforeToast?.();
  toast(`${card.emoji} ${card.label} deleted`, { actions: [{ label: 'Undo', run: () => revertTo(prev), primary: true }] });
  return true;
}
