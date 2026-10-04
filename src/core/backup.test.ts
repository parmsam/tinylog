import { describe, expect, it } from 'vitest';
import { BackupError, parseBackup, toBackup } from './backup';
import { createEvent } from './events';

describe('backup', () => {
  const data = {
    events: [createEvent('feed', 1, { method: 'bottle', amount: 90 }, 1)],
    notes: [{ day: '2026-09-30', text: 'first smile', updatedAt: 2 }],
  };

  it('round-trips an export', () => {
    const parsed = parseBackup(JSON.stringify(toBackup(data, 3)));
    expect(parsed.events).toEqual(data.events);
    expect(parsed.notes).toEqual(data.notes);
    expect(parsed.skipped).toBe(0);
  });

  it('carries the baby name when there is one', () => {
    expect(toBackup(data, 3)).not.toHaveProperty('babyName');
    expect(toBackup(data, 3, '  ')).not.toHaveProperty('babyName');
    expect(toBackup(data, 3, ' Pip ').babyName).toBe('Pip');
    expect(parseBackup(JSON.stringify(toBackup(data, 3, 'Pip'))).babyName).toBe('Pip');
    expect(parseBackup(JSON.stringify(toBackup(data, 3)))).not.toHaveProperty('babyName');
    expect(parseBackup(JSON.stringify({ ...toBackup(data, 3), babyName: 42 }))).not.toHaveProperty('babyName');
  });

  it('rejects files that are not tinylog exports', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup('{"events":[]}')).toThrow(/isn't a tinylog export/);
    expect(() => parseBackup('{"app":"tinylog","version":2}')).toThrow(/newer version/);
  });

  it('skips malformed entries instead of failing', () => {
    const b = toBackup(data, 3) as unknown as Record<string, unknown[]>;
    b.events.push({ id: 'x', type: 'unicorn', at: 1, createdAt: 1, updatedAt: 1 }, { type: 'feed' });
    b.notes.push({ day: 'yesterday', text: 'x', updatedAt: 1 });
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.events).toHaveLength(1);
    expect(parsed.skipped).toBe(3);
  });
});
