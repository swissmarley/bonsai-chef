import { describe, expect, it } from 'vitest';
import { HttpError, json, parseInput, Router } from '../netlify/lib/http';
import { bonsaiSchema, normalizeCare, reminderSchema, toolSchema } from '../netlify/lib/schemas';

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err as HttpError;
  }
  throw new Error('expected an error');
};

describe('bonsaiSchema', () => {
  it('fills defaults and trims text', () => {
    const input = parseInput(bonsaiSchema, { name: '  Acero  ', category: 'interno' });
    expect(input.name).toBe('Acero');
    expect(input.substrate).toBe('');
    expect(input.photoIds).toEqual([]);
    expect(normalizeCare(input.care).pruning).toEqual({ startMonth: null, endMonth: null, notes: '' });
  });

  it('rejects a missing name with an Italian message', () => {
    const err = errorOf(() => parseInput(bonsaiSchema, { name: ' ', category: 'esterno' }));
    expect(err.status).toBe(400);
    expect(err.message).toBe('Il nome è obbligatorio.');
  });

  it('rejects unknown categories and out-of-range months', () => {
    expect(errorOf(() => parseInput(bonsaiSchema, { name: 'x', category: 'giardino' })).message).toBe('Scegli una categoria valida.');
    expect(errorOf(() => parseInput(bonsaiSchema, { name: 'x', category: 'esterno', care: { pruning: { startMonth: 12 } } })).status).toBe(400);
  });

  it('rejects invalid dates', () => {
    const err = errorOf(() => parseInput(bonsaiSchema, { name: 'x', category: 'esterno', care: { repotting: { lastDate: '2025-13-45' } } }));
    expect(err.message).toBe('Data non valida.');
  });
});

describe('normalizeCare', () => {
  it('keeps only the fields each section supports', () => {
    const care = normalizeCare({
      pruning: { startMonth: 1, endMonth: 2, notes: 'x', lastDate: '2025-01-01', fertilizerType: 'no' },
      fertilizing: { fertilizerType: 'Biogold' },
    });
    expect(care.pruning).toEqual({ startMonth: 1, endMonth: 2, notes: 'x' });
    expect(care.fertilizing).toEqual({ startMonth: null, endMonth: null, notes: '', fertilizerType: 'Biogold' });
    expect(care.repotting.lastDate).toBeNull();
  });

  it('survives missing or malformed stored data', () => {
    expect(normalizeCare(null).wiring).toEqual({ startMonth: null, endMonth: null, notes: '', lastDate: null });
  });
});

describe('toolSchema', () => {
  it('accepts the three tool types only', () => {
    expect(parseInput(toolSchema, { name: 'Akadama', type: 'substrato' }).type).toBe('substrato');
    expect(errorOf(() => parseInput(toolSchema, { name: 'x', type: 'Bonsai Tools' })).message).toBe('Scegli una tipologia valida.');
  });
});

describe('reminderSchema', () => {
  const bonsaiId = '6f1c1a2e-2c55-4c55-9a6e-0c1d7d9b1f00';

  it('requires a future date', () => {
    const err = errorOf(() => parseInput(reminderSchema, { bonsaiId, remindAt: '2020-01-01T09:00:00Z' }));
    expect(err.message).toBe('La data del promemoria deve essere nel futuro.');
  });

  it('accepts ISO dates with a time zone', () => {
    const remindAt = new Date(Date.now() + 86_400_000).toISOString();
    expect(parseInput(reminderSchema, { bonsaiId, remindAt }).message).toBe('');
  });
});

describe('Router', () => {
  const router = new Router()
    .on('GET', '/api/items/:id', async ({ params }) => json({ id: params.id }))
    .on('POST', '/api/items', async () => {
      throw new HttpError(409, 'Conflitto');
    });

  it('matches path parameters', async () => {
    const res = await router.handle(new Request('https://app.test/api/items/42'), '1.2.3.4');
    expect(await res.json()).toEqual({ id: '42' });
  });

  it('turns HttpErrors into JSON responses', async () => {
    const res = await router.handle(new Request('https://app.test/api/items', { method: 'POST' }), '1.2.3.4');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Conflitto' });
  });

  it('answers 404 and 405', async () => {
    expect((await router.handle(new Request('https://app.test/api/nope'), '')).status).toBe(404);
    expect((await router.handle(new Request('https://app.test/api/items/1', { method: 'DELETE' }), '')).status).toBe(405);
  });

  it('rejects cross-site writes', async () => {
    const req = new Request('https://app.test/api/items', { method: 'POST', headers: { Origin: 'https://evil.test' } });
    expect((await router.handle(req, '')).status).toBe(403);
  });
});
