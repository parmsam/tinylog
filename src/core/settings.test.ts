import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY } from './settings';

beforeEach(() => localStorage.clear());

describe('settings', () => {
  it('defaults when nothing is saved or the JSON is broken', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_KEY, '{nope');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates the old install-tip flag into tipsSeen', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ babyName: 'Pip', installTipSeen: true }));
    const s = loadSettings();
    expect(s.tipsSeen).toEqual(['install']);
    expect(s).not.toHaveProperty('installTipSeen');
    expect(s.babyName).toBe('Pip');
  });

  it('repairs invalid values', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ gridMarks: 'stars', tipsSeen: 'x', dayStartHour: 30, backupEveryDays: 5, backupLaterAt: -1 }));
    expect(loadSettings()).toMatchObject({ gridMarks: 'dots', tipsSeen: [], dayStartHour: 0, backupEveryDays: 4, backupLaterAt: 0 });
  });

  it('keeps a chosen backup reminder interval, including off', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ backupEveryDays: 0 }));
    expect(loadSettings().backupEveryDays).toBe(0);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ backupEveryDays: 14 }));
    expect(loadSettings().backupEveryDays).toBe(14);
  });
});

describe('companion setting', () => {
  it('migrates the old on/off boolean', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ companion: true }));
    expect(loadSettings().companion).toBe('puff');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ companion: false }));
    expect(loadSettings().companion).toBe('off');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ companion: 'sadie' }));
    expect(loadSettings().companion).toBe('sadie');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ companion: 'dragon' }));
    expect(loadSettings().companion).toBe('puff');
  });
});
