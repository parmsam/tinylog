import { CARDS, cardById, cardFor, type CardDef, type CardId } from '../core/cards';
import { createEvent } from '../core/events';
import { fromLocalInput, fromMl, toLocalInput, toMl } from '../core/format';
import { addEvent, deleteEvent, getEvent, revertTo, settings, updateEvent } from '../core/log';
import type { Detail, LogEvent } from '../core/types';
import { toast } from './toast';
import { companionReact } from './companion';
import { requestPersistence } from './persist';

export interface SheetOpts {
  /** Edit this event. */
  event?: LogEvent;
  /** Or start a new one from this card. */
  cardId?: CardId;
  at?: number;
  detail?: Detail;
  /** New timed entry that's still going (today). */
  ongoing?: boolean;
}

interface Draft {
  cardId: CardId;
  at: string;
  endAt: string;
  ongoing: boolean;
  detail: Detail;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function seg<T extends string>(name: string, options: [T, string][], value: T | undefined, legend: string) {
  return `<fieldset class="field"><legend>${legend}</legend><div class="seg">${options
    .map(
      ([v, label]) =>
        `<label><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''} /><span>${label}</span></label>`,
    )
    .join('')}</div></fieldset>`;
}

function amountField(ml: number | undefined, label: string) {
  const units = settings.get().units;
  const v = ml ? fromMl(ml, units) : '';
  return `<label class="field"><span class="field-label">${label} (${units})</span>
    <input type="number" name="amount" inputmode="decimal" min="0" step="${units === 'oz' ? 0.5 : 5}" value="${v}" placeholder="optional" /></label>`;
}

function fieldsFor(card: CardDef, d: Detail): string {
  switch (card.id) {
    case 'feed': {
      const method = d.method ?? 'breast';
      const parts = [seg('method', [['breast', 'Breast'], ['bottle', 'Bottle']], method, 'Feed')];
      if (method === 'breast') parts.push(seg('side', [['L', 'Left'], ['R', 'Right'], ['both', 'Both']], d.side, 'Side'));
      else {
        parts.push(`<div class="row">${amountField(d.amount, 'Amount')}${seg('milk', [['breast', 'Breast milk'], ['formula', 'Formula']], d.milk, 'Milk')}</div>`);
      }
      return parts.join('');
    }
    case 'wet':
    case 'dirty':
      return seg('diaper', [['wet', '💧 Wet'], ['dirty', '💩 Dirty'], ['both', 'Both']], d.diaper ?? card.preset?.diaper, 'Diaper');
    case 'nap':
    case 'night':
      return seg('sleep', [['nap', '😴 Nap'], ['night', '🌙 Night']], d.sleep ?? card.preset?.sleep, 'Sleep');
    case 'pump':
      return seg('side', [['L', 'Left'], ['R', 'Right'], ['both', 'Both']], d.side, 'Side') + amountField(d.amount, 'Volume');
    default:
      return '';
  }
}

function render(dialog: HTMLDialogElement, draft: Draft, existing: LogEvent | undefined, error = '') {
  const card = cardById(draft.cardId);
  const title = existing ? `${card.emoji} ${card.label}` : 'New entry';
  const picker = existing
    ? ''
    : seg(
        'card',
        CARDS.map((c) => [c.id, `${c.emoji} ${c.label}`] as [CardId, string]),
        draft.cardId,
        'What',
      );
  const timeLabel = card.timed ? 'Started' : card.id === 'doctor' ? 'When' : 'Time';
  const end = card.timed
    ? `<div class="field">
        <label class="field"><span class="field-label">Ended</span>
          <input type="datetime-local" name="endAt" value="${draft.endAt}" ${draft.ongoing ? 'disabled' : ''} /></label>
        <label class="check"><input type="checkbox" name="ongoing" ${draft.ongoing ? 'checked' : ''} /> Still going</label>
      </div>`
    : '';
  const notePh = card.id === 'doctor' ? 'What is the visit for? Weight, questions, vaccines…' : 'optional';

  dialog.innerHTML = `<form novalidate>
    <div class="sheet-head"><h2 id="sheet-title">${title}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    ${picker}
    ${fieldsFor(card, draft.detail)}
    <div class="${card.timed ? 'row' : ''}">
      <label class="field"><span class="field-label">${timeLabel}</span>
        <input type="datetime-local" name="at" value="${draft.at}" required /></label>
      ${end}
    </div>
    <label class="field"><span class="field-label">Note</span>
      <textarea name="note" rows="2" placeholder="${notePh}">${esc(draft.detail.note ?? '')}</textarea></label>
    ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
    <div class="actions">
      ${existing ? '<button type="button" class="btn danger" data-delete>Delete</button>' : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="submit" class="btn primary">Save</button>
    </div>
  </form>`;
}

/** Reads the form into the draft (so re-rendering after a change keeps what was typed). */
function read(form: HTMLFormElement, draft: Draft): Draft {
  const f = new FormData(form);
  const str = (k: string) => (f.get(k) as string | null) ?? undefined;
  const cardId = (str('card') as CardId | undefined) ?? draft.cardId;
  const detail: Detail = { note: str('note') };
  const method = str('method') as Detail['method'];
  if (method) detail.method = method;
  const side = str('side') as Detail['side'];
  if (side) detail.side = side;
  const milk = str('milk') as Detail['milk'];
  if (milk) detail.milk = milk;
  const diaper = str('diaper') as Detail['diaper'];
  if (diaper) detail.diaper = diaper;
  const sleep = str('sleep') as Detail['sleep'];
  if (sleep) detail.sleep = sleep;
  const amount = parseFloat(str('amount') ?? '');
  if (amount > 0) detail.amount = toMl(amount, settings.get().units);
  // Switching cards in the picker resets card-specific choices to that card's preset.
  const next = cardId !== draft.cardId ? { note: detail.note, ...cardById(cardId).preset } : detail;
  return {
    cardId,
    at: str('at') ?? draft.at,
    endAt: str('endAt') ?? draft.endAt,
    ongoing: f.get('ongoing') === 'on',
    detail: next,
  };
}

/** Only the fields that apply to the chosen card are saved. */
function detailFor(card: CardDef, d: Detail): Detail {
  const out: Detail = { note: d.note };
  switch (card.id) {
    case 'feed':
      out.method = d.method ?? 'breast';
      if (out.method === 'breast') out.side = d.side;
      else Object.assign(out, { amount: d.amount, milk: d.milk });
      break;
    case 'wet':
    case 'dirty':
      out.diaper = d.diaper ?? card.preset?.diaper;
      break;
    case 'nap':
    case 'night':
      out.sleep = d.sleep ?? card.preset?.sleep;
      break;
    case 'pump':
      Object.assign(out, { side: d.side, amount: d.amount });
      break;
  }
  return out;
}

/**
 * A timed entry that isn't still going always shows an end time: an empty date field on iPhone
 * displays a placeholder date that looks like a real (and wrong) value.
 */
function withEnd(d: Draft): Draft {
  if (!cardById(d.cardId).timed || d.ongoing || d.endAt) return d;
  const at = fromLocalInput(d.at) ?? Date.now();
  const end = Math.max(at, Math.min(at + 30 * 60_000, Math.max(Date.now(), at)));
  return { ...d, endAt: toLocalInput(end) };
}

export function openSheet(opts: SheetOpts) {
  const dialog = document.getElementById('sheet') as HTMLDialogElement;
  const existing = opts.event;
  const card = existing ? cardFor(existing)! : cardById(opts.cardId ?? 'feed');
  const now = Date.now();
  let draft: Draft = {
    cardId: card.id,
    at: toLocalInput(existing?.at ?? opts.at ?? now),
    endAt: existing?.endAt !== undefined ? toLocalInput(existing.endAt) : '',
    ongoing: existing ? existing.endAt === undefined : !!opts.ongoing,
    detail: { ...card.preset, ...(existing?.detail ?? opts.detail) },
  };
  draft = withEnd(draft);
  render(dialog, draft, existing);

  const form = () => dialog.querySelector('form')!;

  dialog.onchange = (e) => {
    const t = e.target as HTMLInputElement;
    if (['card', 'method', 'ongoing'].includes(t.name)) {
      draft = withEnd(read(form(), draft));
      render(dialog, draft, existing);
      form().querySelector<HTMLElement>(`[name="${t.name}"]:checked, [name="${t.name}"]`)?.focus();
    }
  };

  dialog.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t === dialog || t.closest('[data-close]')) dialog.close();
    else if (t.closest('[data-delete]') && existing) {
      const prev = getEvent(existing.id) ?? existing;
      deleteEvent(existing.id);
      dialog.close();
      toast(`${card.emoji} ${card.label} deleted`, { actions: [{ label: 'Undo', run: () => revertTo(prev), primary: true }] });
    }
  };

  dialog.onsubmit = (e) => {
    e.preventDefault();
    draft = read(form(), draft);
    const chosen = cardById(draft.cardId);
    const at = fromLocalInput(draft.at);
    const endAt = chosen.timed && !draft.ongoing ? fromLocalInput(draft.endAt) : undefined;
    const fail = (msg: string) => render(dialog, draft, existing, msg);
    if (at === undefined) return fail('Pick a time.');
    if (chosen.timed && !draft.ongoing) {
      if (endAt === undefined) return fail('Pick an end time, or tick "Still going".');
      if (endAt < at) return fail('The end is before the start.');
    }
    if (chosen.timed && draft.ongoing && at > Date.now()) return fail("Something still going can't start in the future.");

    const detail = detailFor(chosen, draft.detail);
    if (existing) {
      const prev = getEvent(existing.id) ?? existing;
      updateEvent(existing.id, { at, endAt, detail });
      toast(`${chosen.emoji} ${chosen.label} updated`, { actions: [{ label: 'Undo', run: () => revertTo(prev), primary: true }] });
    } else {
      const ev = createEvent(chosen.type, at, detail, Date.now());
      if (endAt !== undefined) ev.endAt = endAt;
      addEvent(ev);
      requestPersistence();
      companionReact(chosen.id, ev.endAt === undefined && chosen.timed ? 'start' : 'log');
      toast(`${chosen.emoji} ${chosen.label} added`, {
        actions: [{ label: 'Undo', run: () => deleteEvent(ev.id), primary: true }],
      });
    }
    dialog.close();
  };

  if (!dialog.open) dialog.showModal();
  // Don't pop the keyboard open on phones: focus the dialog, not the first field.
  dialog.querySelector<HTMLElement>('.sheet-head h2')?.setAttribute('tabindex', '-1');
  dialog.querySelector<HTMLElement>('.sheet-head h2')?.focus();
}
