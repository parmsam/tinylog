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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ gridMarks: 'stars', tipsSeen: 'x', dayStartHour: 30 }));
    expect(loadSettings()).toMatchObject({ gridMarks: 'dots', tipsSeen: [], dayStartHour: 0 });
  });
});
