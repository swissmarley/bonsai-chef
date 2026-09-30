import { describe, expect, it } from 'vitest';
import { addFrequency, careHistory, emptyCare, formatFrequency, formatMonthRange, monthsInRange } from '../shared/model';
import { formatDate, linkify } from '../src/lib/format';

describe('monthsInRange', () => {
  it('returns nothing when no month is set', () => {
    expect(monthsInRange(null, null)).toEqual([]);
  });

  it('covers a simple range', () => {
    expect(monthsInRange(2, 4)).toEqual([2, 3, 4]);
  });

  it('wraps around the end of the year', () => {
    expect(monthsInRange(10, 1)).toEqual([10, 11, 0, 1]);
  });

  it('treats a single set month as a one-month period', () => {
    expect(monthsInRange(5, null)).toEqual([5]);
    expect(monthsInRange(null, 7)).toEqual([7]);
    expect(monthsInRange(3, 3)).toEqual([3]);
  });
});

describe('formatMonthRange', () => {
  it('uses Italian month names', () => {
    expect(formatMonthRange(2, 3)).toBe('Marzo – Aprile');
    expect(formatMonthRange(8, 8)).toBe('Settembre');
    expect(formatMonthRange(null, null)).toBe('');
  });
});

describe('emptyCare', () => {
  it('has the six iOS sections with their extra fields', () => {
    const care = emptyCare();
    expect(Object.keys(care)).toEqual(['repotting', 'pruning', 'shootCutting', 'wiring', 'defoliation', 'fertilizing']);
    expect(care.repotting).toHaveProperty('lastDate', null);
    expect(care.wiring).toHaveProperty('lastDate', null);
    expect(care.fertilizing).toHaveProperty('fertilizerType', '');
    expect(care.pruning).not.toHaveProperty('lastDate');
  });
});

describe('formatDate', () => {
  it('formats ISO dates in Italian without time-zone shifts', () => {
    expect(formatDate('2025-03-01')).toBe('1 marzo 2025');
    expect(formatDate(null)).toBe('');
  });
});

describe('linkify', () => {
  it('finds http(s) and www links and keeps the surrounding text', () => {
    const parts = linkify('Scheda: https://example.com/a-b.\nAltro www.example.org/x');
    expect(parts).toEqual([
      { type: 'text', value: 'Scheda: ' },
      { type: 'link', value: 'https://example.com/a-b', href: 'https://example.com/a-b' },
      { type: 'text', value: '.\nAltro ' },
      { type: 'link', value: 'www.example.org/x', href: 'https://www.example.org/x' },
    ]);
  });

  it('never produces javascript: links', () => {
    expect(linkify('javascript:alert(1)').every((p) => p.type === 'text')).toBe(true);
  });
});

describe('addFrequency', () => {
  it('adds days and weeks', () => {
    expect(addFrequency('2026-03-30', { every: 3, unit: 'settimane' })).toBe('2026-04-20');
    expect(addFrequency('2026-12-30', { every: 5, unit: 'giorni' })).toBe('2027-01-04');
  });

  it('adds months and years, clamping to the end of shorter months', () => {
    expect(addFrequency('2026-01-31', { every: 1, unit: 'mesi' })).toBe('2026-02-28');
    expect(addFrequency('2027-11-30', { every: 3, unit: 'mesi' })).toBe('2028-02-29');
    expect(addFrequency('2024-02-29', { every: 2, unit: 'anni' })).toBe('2026-02-28');
    expect(addFrequency('2026-03-15', { every: 2, unit: 'anni' })).toBe('2028-03-15');
  });
});

describe('formatFrequency', () => {
  it('reads naturally in Italian', () => {
    expect(formatFrequency({ every: 1, unit: 'settimane' })).toBe('ogni settimana');
    expect(formatFrequency({ every: 3, unit: 'settimane' })).toBe('ogni 3 settimane');
    expect(formatFrequency({ every: 1, unit: 'anni' })).toBe('ogni anno');
    expect(formatFrequency({ every: 2, unit: 'mesi' })).toBe('ogni 2 mesi');
  });
});

describe('careHistory', () => {
  const events = [
    { kind: 'repotting' as const, date: '2024-03-10' },
    { kind: 'fertilizing' as const, date: '2026-04-01' },
    { kind: 'repotting' as const, date: '2026-03-20' },
  ];

  it('summarises the diary of one task, newest first', () => {
    const h = careHistory(events, 'repotting', null, { every: 2, unit: 'anni', autoReminder: false });
    expect(h).toEqual({ dates: ['2026-03-20', '2024-03-10'], last: '2026-03-20', averageDays: 740, nextDue: '2028-03-20' });
  });

  it('counts the date saved in the card once, even if also in the diary', () => {
    expect(careHistory(events, 'repotting', '2024-03-10').dates).toEqual(['2026-03-20', '2024-03-10']);
    expect(careHistory([], 'wiring', '2025-10-01')).toEqual({ dates: ['2025-10-01'], last: '2025-10-01', averageDays: null, nextDue: null });
  });

  it('is empty when the task was never done', () => {
    expect(careHistory(events, 'pruning', null)).toEqual({ dates: [], last: null, averageDays: null, nextDue: null });
  });
});
