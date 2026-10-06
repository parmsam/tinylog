import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showSplash, SPLASH_MAX_MS, SPLASH_MIN_MS } from './splash';

const splash = () => document.querySelector('.splash');

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('splash', () => {
  it('stays for the minimum time, then leaves once loaded', async () => {
    showSplash(Promise.resolve(), { enabled: true, search: '' });
    expect(splash()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS - 50);
    expect(splash()!.classList.contains('leaving')).toBe(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(splash()!.classList.contains('leaving')).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    expect(splash()).toBeNull();
  });

  it('never waits longer than the cap on a slow load', async () => {
    showSplash(new Promise(() => {}), { enabled: true, search: '' });
    await vi.advanceTimersByTimeAsync(SPLASH_MAX_MS);
    expect(splash()?.classList.contains('leaving') ?? true).toBe(true);
  });

  it('leaves on a tap or key, and swallows the key', async () => {
    showSplash(new Promise(() => {}), { enabled: true, search: '' });
    splash()!.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    expect(splash()!.classList.contains('leaving')).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    expect(splash()).toBeNull();

    showSplash(new Promise(() => {}), { enabled: true, search: '' });
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    expect(splash()!.classList.contains('leaving')).toBe(true);
    // Only the first key is eaten; after that the app hears keys again.
    expect(seen).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', seen);
  });

  it('is skipped when turned off or opened from a logging link', () => {
    showSplash(Promise.resolve(), { enabled: false, search: '' });
    expect(splash()).toBeNull();
    showSplash(Promise.resolve(), { enabled: true, search: '?do=wet' });
    expect(splash()).toBeNull();
  });
});
