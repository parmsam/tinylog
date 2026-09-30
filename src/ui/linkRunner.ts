import { parseLinkAction, stripLinkAction } from '../core/linkActions';
import { app, today } from '../core/log';
import { logCard, startCard, stopCard, toggleCard } from '../core/ops';
import { present } from './actions';
import { requestPersistence } from './persist';
import { toast } from './toast';

const RECENT_KEY = 'tinylog:last-link';

/** iOS sometimes opens the same shortcut link twice; don't log it twice. */
function isRepeat(search: string, now: number): boolean {
  try {
    const last = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? 'null') as { q: string; at: number } | null;
    sessionStorage.setItem(RECENT_KEY, JSON.stringify({ q: search, at: now }));
    return !!last && last.q === search && now - last.at < 8000;
  } catch {
    return false;
  }
}

/** Runs a `?do=` link action once the log has loaded, then removes it from the URL. */
export function runLinkAction(now = Date.now()) {
  const search = location.search;
  const action = parseLinkAction(search, now);
  if (!action) return;
  history.replaceState(history.state, '', stripLinkAction(location.href));
  if (action.kind === 'invalid') {
    toast(`That link didn't log anything: ${action.reason}.`, { duration: 7000 });
    return;
  }
  if (isRepeat(search, now)) return;
  if (app.get().day !== today(now)) app.set({ day: today(now) });
  requestPersistence();
  const opts = { at: now - action.minutesAgo * 60_000, detail: Object.keys(action.detail).length ? action.detail : undefined };
  const op = { log: logCard, start: startCard, stop: stopCard, toggle: toggleCard }[action.kind];
  present(op(action.card, opts), { prefix: 'Via shortcut: ' });
}
