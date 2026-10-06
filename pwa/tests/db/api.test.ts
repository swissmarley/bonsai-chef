import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyCare, type Bonsai, type BonsaiGroup, type CareEvent, type Reminder, type Tool } from '../../shared/model';
import { getDb } from '../../netlify/lib/db';
import { purgeAbandonedPhotos } from '../../netlify/lib/photos';
import { call, createUser, uploadPhoto, type TestUser } from './helpers';

const blobs = () => (globalThis as unknown as { blobStores: Map<string, Map<string, unknown>> }).blobStores.get('photos')!;
const hasBlob = (user: TestUser, photoId: string) => blobs().has(`${user.id}/${photoId}`);
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

/** The body the first release of the app sends when saving a bonsai (no groupId, no schedule). */
function legacyBody(b: Bonsai, photoIds = b.photos.map((p) => p.id)) {
  return { name: b.name, category: b.category, substrate: b.substrate, pot: b.pot, care: b.care, photoIds };
}

async function newBonsai(user: TestUser, extra: Record<string, unknown> = {}): Promise<Bonsai> {
  const res = await call<{ bonsai: Bonsai }>(user, 'POST', '/api/bonsai', { name: 'Pino', category: 'esterno', ...extra });
  expect(res.status).toBe(201);
  return res.data.bonsai;
}

async function newGroup(user: TestUser, name = 'Pini'): Promise<BonsaiGroup> {
  const res = await call<{ group: BonsaiGroup }>(user, 'POST', '/api/groups', { name });
  expect(res.status).toBe(201);
  return res.data.group;
}

async function newEvent(user: TestUser, body: Record<string, unknown>) {
  return call<{ events: CareEvent[]; reminders: Reminder[] }>(user, 'POST', '/api/events', {
    kind: 'fertilizing',
    date: today(),
    ...body,
  });
}

const eventsOf = async (user: TestUser, bonsaiId: string) =>
  (await call<{ events: CareEvent[] }>(user, 'GET', `/api/bonsai/${bonsaiId}/events`)).data.events;

const bonsaiOf = async (user: TestUser, id: string) =>
  (await call<{ bonsai: Bonsai[] }>(user, 'GET', '/api/bonsai')).data.bonsai.find((b) => b.id === id)!;

let user: TestUser;
beforeEach(async () => {
  user = await createUser();
});

describe('bonsai saved by an older app version', () => {
  it('keeps its group and frequencies', async () => {
    const group = await newGroup(user);
    const schedule = { fertilizing: { every: 3, unit: 'settimane', autoReminder: true } };
    const b = await newBonsai(user, { groupId: group.id, schedule });
    const res = await call<{ bonsai: Bonsai }>(user, 'PUT', `/api/bonsai/${b.id}`, { ...legacyBody(b), name: 'Pino nero' });
    expect(res.status).toBe(200);
    expect(res.data.bonsai).toMatchObject({ name: 'Pino nero', groupId: group.id, schedule });
  });

  it('can still be moved out of its group by this version', async () => {
    const group = await newGroup(user);
    const b = await newBonsai(user, { groupId: group.id });
    const res = await call<{ bonsai: Bonsai }>(user, 'PUT', `/api/bonsai/${b.id}`, { ...legacyBody(b), groupId: null, schedule: {} });
    expect(res.data.bonsai).toMatchObject({ groupId: null, schedule: {} });
  });

  it('never detaches (and so never deletes) the photos of diary entries', async () => {
    const gallery = await uploadPhoto(user);
    const b = await newBonsai(user, { photoIds: [gallery] });
    const entryPhoto = await uploadPhoto(user);
    const created = await newEvent(user, { bonsaiIds: [b.id], photoIds: [entryPhoto] });
    expect(created.status).toBe(201);

    // The tree's photos do not include the entry's; the entry has it.
    expect((await bonsaiOf(user, b.id)).photos.map((p) => p.id)).toEqual([gallery]);
    expect((await eventsOf(user, b.id))[0].photos.map((p) => p.id)).toEqual([entryPhoto]);

    // An older version removes every photo of the tree in its form.
    const res = await call(user, 'PUT', `/api/bonsai/${b.id}`, legacyBody(b, []));
    expect(res.status).toBe(200);
    expect(hasBlob(user, gallery)).toBe(false);
    expect(hasBlob(user, entryPhoto)).toBe(true);
    expect((await eventsOf(user, b.id))[0].photos.map((p) => p.id)).toEqual([entryPhoto]);

    // Entry photos keep bonsai_id too, so even the old code's cleanup sees them as attached.
    const db = await getDb();
    const [row] = await db.query<{ bonsai_id: string; event_id: string }>('SELECT bonsai_id, event_id FROM photos WHERE id = $1', [entryPhoto]);
    expect(row).toEqual({ bonsai_id: b.id, event_id: created.data.events[0].id });
  });

  it('gets no Concimi (it would crash on an unknown category)', async () => {
    await call(user, 'POST', '/api/tools', { name: 'Hanagokoro', type: 'concime' });
    await call(user, 'POST', '/api/tools', { name: 'Akadama', type: 'substrato' });
    const legacy = await call<{ tools: Tool[] }>(user, 'GET', '/api/tools');
    expect(legacy.data.tools.map((t) => t.name)).toEqual(['Akadama']);
    const current = await call<{ tools: Tool[] }>(user, 'GET', '/api/tools?types=all');
    expect(current.data.tools.map((t) => t.name).sort()).toEqual(['Akadama', 'Hanagokoro']);
  });
});

describe('data written by the first release', () => {
  it('loads with no group and no frequencies, care untouched', async () => {
    const db = await getDb();
    const care = { ...emptyCare(), repotting: { startMonth: 1, endMonth: 2, notes: 'Akadama', lastDate: '2024-03-10' } };
    const [row] = await db.query<{ id: string }>(
      `INSERT INTO bonsai (user_id, name, category, substrate, pot, care) VALUES ($1, 'Acero', 'esterno', 'Kiryu', '', $2::jsonb) RETURNING id`,
      [user.id, JSON.stringify(care)],
    );
    const b = await bonsaiOf(user, row.id);
    expect(b).toMatchObject({ groupId: null, schedule: {}, substrate: 'Kiryu' });
    expect(b.care.repotting).toEqual(care.repotting);
  });

  it('the daily cleanup never deletes photos of diary entries', async () => {
    const b = await newBonsai(user);
    const photo = await uploadPhoto(user);
    await newEvent(user, { bonsaiIds: [b.id], photoIds: [photo] });
    const db = await getDb();
    await db.query("UPDATE photos SET created_at = now() - interval '3 days' WHERE id = $1", [photo]);
    await purgeAbandonedPhotos();
    expect(hasBlob(user, photo)).toBe(true);
  });
});

describe('groups', () => {
  it('deleting a group keeps its trees, without a group', async () => {
    const group = await newGroup(user);
    const b = await newBonsai(user, { groupId: group.id });
    expect((await call(user, 'DELETE', `/api/groups/${group.id}`)).status).toBe(204);
    expect(await bonsaiOf(user, b.id)).toMatchObject({ id: b.id, name: 'Pino', groupId: null });
  });

  it('rejects duplicate names and groups of other users', async () => {
    await newGroup(user, 'Aceri');
    expect((await call(user, 'POST', '/api/groups', { name: ' aceri ' })).status).toBe(409);
    const other = await createUser();
    const foreign = await newGroup(other, 'Ficus');
    expect((await call(user, 'POST', '/api/bonsai', { name: 'x', category: 'interno', groupId: foreign.id })).status).toBe(400);
    expect((await call(user, 'DELETE', `/api/groups/${foreign.id}`)).status).toBe(404);
  });

  it('keeps the chosen order', async () => {
    const a = await newGroup(user, 'A');
    const b = await newGroup(user, 'B');
    const c = await newGroup(user, 'C');
    const res = await call<{ groups: BonsaiGroup[] }>(user, 'PUT', '/api/groups/order', { ids: [c.id, a.id, b.id] });
    expect(res.data.groups.map((g) => g.name)).toEqual(['C', 'A', 'B']);
  });
});

describe('diary', () => {
  it('records Rinvaso with mix, pot and linked substrati; keeps the name when the tool is deleted', async () => {
    const b = await newBonsai(user);
    const tool = (await call<{ tool: Tool }>(user, 'POST', '/api/tools', { name: 'Akadama', type: 'substrato' })).data.tool;
    const res = await newEvent(user, {
      bonsaiIds: [b.id],
      kind: 'repotting',
      date: '2026-03-15',
      notes: 'Radici sane',
      details: { mix: 'Akadama 70%, pomice 30%', pot: 'Tokoname 30 cm', product: 'ignored' },
      tools: [
        { toolId: tool.id, name: 'whatever' },
        { toolId: null, name: 'Pomice' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.data.events[0]).toMatchObject({
      kind: 'repotting',
      date: '2026-03-15',
      details: { mix: 'Akadama 70%, pomice 30%', pot: 'Tokoname 30 cm' },
      tools: [
        { toolId: tool.id, name: 'Akadama' },
        { toolId: null, name: 'Pomice' },
      ],
    });
    await call(user, 'DELETE', `/api/tools/${tool.id}`);
    expect((await eventsOf(user, b.id))[0].tools).toEqual([
      { toolId: null, name: 'Akadama' },
      { toolId: null, name: 'Pomice' },
    ]);
  });

  it('records one entry per tree for a whole group, without photos', async () => {
    const [a, b] = [await newBonsai(user), await newBonsai(user)];
    const res = await newEvent(user, { bonsaiIds: [a.id, b.id], details: { product: 'Seiki', form: 'liquido' } });
    expect(res.status).toBe(201);
    expect(res.data.events).toHaveLength(2);
    expect(res.data.events[0].batchId).toBeTruthy();
    expect(res.data.events[0].batchId).toBe(res.data.events[1].batchId);
    const photo = await uploadPhoto(user);
    expect((await newEvent(user, { bonsaiIds: [a.id, b.id], photoIds: [photo] })).status).toBe(400);
  });

  it('lists newest first and rejects future dates', async () => {
    const b = await newBonsai(user);
    await newEvent(user, { bonsaiIds: [b.id], date: '2025-04-01' });
    await newEvent(user, { bonsaiIds: [b.id], date: '2026-04-01' });
    expect((await eventsOf(user, b.id)).map((e) => e.date)).toEqual(['2026-04-01', '2025-04-01']);
    expect((await newEvent(user, { bonsaiIds: [b.id], date: inDays(5).slice(0, 10) })).status).toBe(400);
  });

  it('editing an entry: removed photos are deleted, kept ones stay', async () => {
    const b = await newBonsai(user);
    const [p1, p2] = [await uploadPhoto(user), await uploadPhoto(user)];
    const event = (await newEvent(user, { bonsaiIds: [b.id], photoIds: [p1, p2] })).data.events[0];
    const res = await call<{ event: CareEvent }>(user, 'PUT', `/api/events/${event.id}`, {
      kind: 'fertilizing',
      date: event.date,
      notes: 'Dose dimezzata',
      details: { product: 'Hanagokoro', form: 'solido' },
      photoIds: [p2],
    });
    expect(res.status).toBe(200);
    expect(res.data.event).toMatchObject({ notes: 'Dose dimezzata', details: { product: 'Hanagokoro', form: 'solido', dose: '' } });
    expect(res.data.event.photos.map((p) => p.id)).toEqual([p2]);
    expect(hasBlob(user, p1)).toBe(false);
    expect(hasBlob(user, p2)).toBe(true);
  });

  it('deleting an entry moves its photos to the tree', async () => {
    const b = await newBonsai(user);
    const photo = await uploadPhoto(user);
    const event = (await newEvent(user, { bonsaiIds: [b.id], photoIds: [photo] })).data.events[0];
    expect((await call(user, 'DELETE', `/api/events/${event.id}`)).status).toBe(204);
    expect((await bonsaiOf(user, b.id)).photos.map((p) => p.id)).toEqual([photo]);
    expect(hasBlob(user, photo)).toBe(true);
  });

  it('deleting the tree deletes its entries and all their photos', async () => {
    const gallery = await uploadPhoto(user);
    const b = await newBonsai(user, { photoIds: [gallery] });
    const photo = await uploadPhoto(user);
    await newEvent(user, { bonsaiIds: [b.id], photoIds: [photo] });
    expect((await call(user, 'DELETE', `/api/bonsai/${b.id}`)).status).toBe(204);
    expect(hasBlob(user, gallery)).toBe(false);
    expect(hasBlob(user, photo)).toBe(false);
    const db = await getDb();
    expect(await db.query('SELECT 1 FROM care_events WHERE bonsai_id = $1', [b.id])).toEqual([]);
  });

  it('is private to its owner', async () => {
    const b = await newBonsai(user);
    const event = (await newEvent(user, { bonsaiIds: [b.id] })).data.events[0];
    const other = await createUser();
    expect((await call(other, 'GET', `/api/bonsai/${b.id}/events`)).status).toBe(404);
    expect((await newEvent(other, { bonsaiIds: [b.id] })).status).toBe(404);
    expect((await call(other, 'PUT', `/api/events/${event.id}`, { kind: 'pruning', date: today() })).status).toBe(404);
    expect((await call(other, 'DELETE', `/api/events/${event.id}`)).status).toBe(404);
    const foreignPhoto = await uploadPhoto(other);
    expect((await newEvent(user, { bonsaiIds: [b.id], photoIds: [foreignPhoto] })).status).toBe(409);
  });

  it('suggests values used before, including the older cards', async () => {
    await newBonsai(user, { substrate: 'Kiryu', care: { fertilizing: { fertilizerType: 'Biogold' } } });
    const b = await newBonsai(user);
    await newEvent(user, { bonsaiIds: [b.id], details: { product: 'Seiki', dose: '5 ml/l' } });
    const res = await call<{ suggestions: Record<string, string[]> }>(user, 'GET', '/api/events/suggestions');
    expect(res.data.suggestions).toMatchObject({ mix: ['Kiryu'], product: ['Seiki', 'Biogold'], dose: ['5 ml/l'] });
  });
});

describe('automatic reminders', () => {
  it('replace the previous automatic one of the same task, never manual reminders', async () => {
    const b = await newBonsai(user);
    const manual = await call<{ reminder: Reminder }>(user, 'POST', '/api/reminders', { bonsaiId: b.id, message: 'Rinvaso', remindAt: inDays(10) });
    const first = await newEvent(user, { bonsaiIds: [b.id], nextReminders: [{ bonsaiId: b.id, remindAt: inDays(21), message: 'Concimazione' }] });
    expect(first.data.reminders).toMatchObject([{ careKind: 'fertilizing', message: 'Concimazione' }]);
    await newEvent(user, { bonsaiIds: [b.id], kind: 'pruning', nextReminders: [{ bonsaiId: b.id, remindAt: inDays(30), message: 'Potatura' }] });
    const later = inDays(42);
    await newEvent(user, { bonsaiIds: [b.id], nextReminders: [{ bonsaiId: b.id, remindAt: later, message: 'Concimazione' }] });

    const pending = (await call<{ reminders: Reminder[] }>(user, 'GET', '/api/reminders')).data.reminders;
    expect(pending.map((r) => [r.careKind, r.message])).toEqual([
      [null, 'Rinvaso'],
      ['pruning', 'Potatura'],
      ['fertilizing', 'Concimazione'],
    ]);
    expect(pending[0].id).toBe(manual.data.reminder.id);
    expect(pending[2].remindAt).toBe(later);
  });

  it('only for trees of the entry', async () => {
    const [a, b] = [await newBonsai(user), await newBonsai(user)];
    const res = await newEvent(user, { bonsaiIds: [a.id], nextReminders: [{ bonsaiId: b.id, remindAt: inDays(5), message: '' }] });
    expect(res.status).toBe(400);
  });
});

describe('contact form and announcements', () => {
  it('sends the message (printed in development) and limits it to 5 per hour', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    for (let i = 0; i < 5; i++) expect((await call(user, 'POST', '/api/feedback', { message: `Ciao ${i}` })).status).toBe(204);
    expect(log.mock.calls.some(([text]) => String(text).includes(`Rispondi a: ${user.email}`))).toBe(true);
    expect((await call(user, 'POST', '/api/feedback', { message: 'Ancora' })).status).toBe(429);
    expect((await call(user, 'POST', '/api/feedback', { message: '   ' })).status).toBe(400);
    log.mockRestore();
  });

  it('an announcement dismissed once stays dismissed', async () => {
    expect((await call<{ seen: string[] }>(user, 'GET', '/api/announcements')).data.seen).toEqual([]);
    expect((await call(user, 'POST', '/api/announcements/novita-v2/seen')).status).toBe(204);
    expect((await call(user, 'POST', '/api/announcements/novita-v2/seen')).status).toBe(204);
    expect((await call<{ seen: string[] }>(user, 'GET', '/api/announcements')).data.seen).toEqual(['novita-v2']);
    expect((await call(user, 'POST', '/api/announcements/NOT OK/seen')).status).toBe(404);
  });
});
