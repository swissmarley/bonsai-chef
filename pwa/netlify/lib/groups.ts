import type { BonsaiGroup } from '../../shared/model';
import { requireUser } from './auth';
import { getDb } from './db';
import { HttpError, isUuid, json, noContent, parseInput, readJson, type RouteContext } from './http';
import { groupOrderSchema, groupSchema } from './schemas';

const COLUMNS = 'id, name, position';

async function listFor(userId: string): Promise<BonsaiGroup[]> {
  const db = await getDb();
  return db.query<BonsaiGroup>(`SELECT ${COLUMNS} FROM bonsai_groups WHERE user_id = $1 ORDER BY position, created_at, id`, [userId]);
}

async function assertNameFree(userId: string, name: string, exceptId?: string) {
  const db = await getDb();
  const rows = await db.query(
    'SELECT 1 FROM bonsai_groups WHERE user_id = $1 AND lower(name) = lower($2) AND id IS DISTINCT FROM $3::uuid',
    [userId, name, exceptId ?? null],
  );
  if (rows.length) throw new HttpError(409, `Esiste già un gruppo «${name}».`);
}

export async function listGroups({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  return json({ groups: await listFor(user.id) });
}

export async function createGroup({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const { name } = parseInput(groupSchema, await readJson(req));
  await assertNameFree(user.id, name);
  const db = await getDb();
  const [group] = await db.query<BonsaiGroup>(
    `INSERT INTO bonsai_groups (user_id, name, position)
     SELECT $1, $2, coalesce(max(position) + 1, 0) FROM bonsai_groups WHERE user_id = $1
     RETURNING ${COLUMNS}`,
    [user.id, name],
  );
  return json({ group }, { status: 201 });
}

export async function renameGroup({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Gruppo non trovato.');
  const { name } = parseInput(groupSchema, await readJson(req));
  await assertNameFree(user.id, name, params.id);
  const db = await getDb();
  const [group] = await db.query<BonsaiGroup>(
    `UPDATE bonsai_groups SET name = $3, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [params.id, user.id, name],
  );
  if (!group) throw new HttpError(404, 'Gruppo non trovato.');
  return json({ group });
}

/** Saves the order of the groups (as shown in the lists). */
export async function reorderGroups({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const { ids } = parseInput(groupOrderSchema, await readJson(req));
  const db = await getDb();
  await db.query(
    `UPDATE bonsai_groups SET position = array_position($2::uuid[], id) - 1, updated_at = now()
      WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [user.id, ids],
  );
  return json({ groups: await listFor(user.id) });
}

/** Deletes the group only: its trees stay, without a group. */
export async function deleteGroup({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Gruppo non trovato.');
  const db = await getDb();
  const rows = await db.query('DELETE FROM bonsai_groups WHERE id = $1 AND user_id = $2 RETURNING id', [params.id, user.id]);
  if (!rows.length) throw new HttpError(404, 'Gruppo non trovato.');
  return noContent();
}
