import { isIos } from '../core/haptics';

/**
 * Installing to the Home Screen: an installed app opens full screen, works offline and, on iPhone,
 * keeps its data (Safari can clear data for sites that aren't installed). Chrome on Android (and
 * desktop) offers its own install prompt; we keep it for an "Install" button instead of letting it pop up.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

/** Called when the install prompt becomes available or goes away. */
export function onInstallChange(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

export const canPromptInstall = () => deferred !== null;

/** Shows the browser's own install dialog. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  listeners.forEach((f) => f());
  return outcome === 'accepted';
}

export function isStandalone(): boolean {
  return (navigator as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
}

export const isAndroid = () => /Android/.test(navigator.userAgent);

/** A phone browser tab that could be installed. */
export const isPhoneBrowserTab = () => (isIos() || isAndroid()) && !isStandalone();

/** Step-by-step, for the Settings guide. The current device's steps come first. */
export function installGuideHtml(): string {
  const ios = `<li><b>iPhone / iPad (Safari):</b> tap <b>Share</b> (the square with an arrow) → scroll down → <b>Add to Home Screen</b> → <b>Add</b>. No Share button? Tap <b>⋯</b> first. In Chrome on iPhone, the Share button is in the address bar.</li>`;
  const android = `<li><b>Android (Chrome):</b> tap the <b>⋮</b> menu → <b>Add to Home screen</b> (or <b>Install app</b>) → <b>Install</b>. Samsung Internet: <b>≡</b> menu → <b>Add page to</b> → <b>Home screen</b>.</li>`;
  return `<ol class="install-steps">${isAndroid() ? android + ios : ios + android}</ol>`;
}
