import { registerSW } from 'virtual:pwa-register';
import { toast } from './toast';

/** Registers the service worker (offline + installable). New versions wait for the user: never reload mid-entry. */
export function setupPwa() {
  if (!('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    onNeedRefresh() {
      toast('A new version of tinylog is ready', {
        duration: 60_000,
        actions: [{ label: 'Reload', primary: true, run: () => void updateSW(true) }],
      });
    },
    onOfflineReady() {
      toast('tinylog now works offline', { duration: 4000 });
    },
  });
}
