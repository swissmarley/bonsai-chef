import { describe, expect, it } from 'vitest';
import { emptyCare, formatMonthRange, monthsInRange } from '../shared/model';
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
