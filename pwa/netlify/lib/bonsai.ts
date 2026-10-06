import { randomUUID } from 'node:crypto';
import type { Bonsai, BonsaiCategory, Photo } from '../../shared/model';
import { requireUser } from './auth';
import { getDb, iso } from './db';
import { HttpError, isUuid, json, noContent, parseInput, readJson, type RouteContext } from './http';
import { assertPhotosAvailable, photosByOwner, purgePhotos, syncPhotosQueries } from './photos';
import { bonsaiSchema, normalizeCare, normalizeSchedule } from './schemas';

interface BonsaiRow {
  id: string;
  name: string;
  category: BonsaiCategory;
  substrate: string;
  pot: string;
  care: unknown;
  group_id: string | null;
  schedule: unknown;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = 'id, name, category, substrate, pot, care, group_id, schedule, created_at, updated_at';

const toBonsai = (r: BonsaiRow, photos: Photo[]): Bonsai => ({
  id: r.id,
  name: r.name,
  category: r.category,
  substrate: r.substrate,
  pot: r.pot,
  care: normalizeCare(r.care as Parameters<typeof normalizeCare>[0]),
  groupId: r.group_id,
  schedule: normalizeSchedule(r.schedule),
  photos,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

async function loadBonsai(userId: string, id: string): Promise<Bonsai> {
  const db = await getDb();
  const [[row], photos] = await Promise.all([
    db.query<BonsaiRow>(`SELECT ${COLUMNS} FROM bonsai WHERE id = $1 AND user_id = $2`, [id, userId]),
    photosByOwner(userId, 'bonsai_id', id),
  ]);
  if (!row) throw new HttpError(404, 'Bonsai non trovato.');
  return toBonsai(row, photos.get(id) ?? []);
}

export async function listBonsai({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const db = await getDb();
  const [rows, photos] = await Promise.all([
    db.query<BonsaiRow>(`SELECT ${COLUMNS} FROM bonsai WHERE user_id = $1 ORDER BY created_at, id`, [user.id]),
    photosByOwner(user.id, 'bonsai_id'),
  ]);
  return json({ bonsai: rows.map((r) => toBonsai(r, photos.get(r.id) ?? [])) });
}

/** A bonsai can only be put in one of the user's own groups. */
async function assertGroup(userId: string, groupId: string | null | undefined) {
  if (!groupId) return;
  const db = await getDb();
  const rows = await db.query('SELECT 1 FROM bonsai_groups WHERE id = $1 AND user_id = $2', [groupId, userId]);
  if (!rows.length) throw new HttpError(400, 'Il gruppo scelto non esiste più. Scegline un altro.');
}

export async function createBonsai({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const input = parseInput(bonsaiSchema, await readJson(req));
  const id = randomUUID();
  await Promise.all([assertPhotosAvailable(user.id, 'bonsai_id', id, input.photoIds), assertGroup(user.id, input.groupId)]);
  const db = await getDb();
  await db.transaction([
    {
      text: `INSERT INTO bonsai (id, user_id, name, category, substrate, pot, care, group_id, schedule)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb)`,
      params: [
        id,
        user.id,
        input.name,
        input.category,
        input.substrate,
        input.pot,
        JSON.stringify(normalizeCare(input.care)),
        input.groupId ?? null,
        JSON.stringify(input.schedule ?? {}),
      ],
    },
    ...syncPhotosQueries(user.id, 'bonsai_id', id, input.photoIds),
  ]);
  return json({ bonsai: await loadBonsai(user.id, id) }, { status: 201 });
}

export async function updateBonsai({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Bonsai non trovato.');
  const input = parseInput(bonsaiSchema, await readJson(req));
  await Promise.all([assertPhotosAvailable(user.id, 'bonsai_id', params.id, input.photoIds), assertGroup(user.id, input.groupId)]);
  const db = await getDb();
  // Group and schedule are only changed when sent: older app versions (still cached on some
  // devices) do not know them, and saving from there must not remove a tree from its group.
  const [updated, removed] = await db.transaction([
    {
      text: `UPDATE bonsai SET name = $3, category = $4, substrate = $5, pot = $6, care = $7::jsonb,
                    group_id = CASE WHEN $8 THEN $9::uuid ELSE group_id END,
                    schedule = CASE WHEN $10 THEN $11::jsonb ELSE schedule END,
                    updated_at = now()
              WHERE id = $1 AND user_id = $2 RETURNING id`,
      params: [
        params.id,
        user.id,
        input.name,
        input.category,
        input.substrate,
        input.pot,
        JSON.stringify(normalizeCare(input.care)),
        input.groupId !== undefined,
        input.groupId ?? null,
        input.schedule !== undefined,
        JSON.stringify(input.schedule ?? {}),
      ],
    },
    ...syncPhotosQueries(user.id, 'bonsai_id', params.id, input.photoIds),
  ]);
  if (!updated.length) throw new HttpError(404, 'Bonsai non trovato.');
  await purgePhotos(user.id, removed.map((r) => String(r.id)));
  return json({ bonsai: await loadBonsai(user.id, params.id) });
}

export async function deleteBonsai({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Bonsai non trovato.');
  const db = await getDb();
  const [detached, deleted] = await db.transaction([
    { text: 'UPDATE photos SET bonsai_id = NULL WHERE bonsai_id = $1 AND user_id = $2 RETURNING id', params: [params.id, user.id] },
    { text: 'DELETE FROM bonsai WHERE id = $1 AND user_id = $2 RETURNING id', params: [params.id, user.id] },
  ]);
  if (!deleted.length) throw new HttpError(404, 'Bonsai non trovato.');
  await purgePhotos(user.id, detached.map((r) => String(r.id)));
  return noContent();
}
