import { randomUUID } from 'node:crypto';
import type { Photo, Tool, ToolType } from '../../shared/model';
import { requireUser } from './auth';
import { getDb, iso } from './db';
import { HttpError, isUuid, json, noContent, parseInput, readJson, type RouteContext } from './http';
import { assertPhotosAvailable, photosByOwner, purgePhotos, syncPhotosQueries } from './photos';
import { toolSchema } from './schemas';

interface ToolRow {
  id: string;
  name: string;
  type: ToolType;
  genre: string;
  seller: string;
  price: string;
  links: string;
  details: string;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = 'id, name, type, genre, seller, price, links, details, created_at, updated_at';

const toTool = (r: ToolRow, photos: Photo[]): Tool => ({
  id: r.id,
  name: r.name,
  type: r.type,
  genre: r.genre,
  seller: r.seller,
  price: r.price,
  links: r.links,
  details: r.details,
  photos,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

async function loadTool(userId: string, id: string): Promise<Tool> {
  const db = await getDb();
  const [[row], photos] = await Promise.all([
    db.query<ToolRow>(`SELECT ${COLUMNS} FROM tools WHERE id = $1 AND user_id = $2`, [id, userId]),
    photosByOwner(userId, 'tool_id', id),
  ]);
  if (!row) throw new HttpError(404, 'Strumento non trovato.');
  return toTool(row, photos.get(id) ?? []);
}

export async function listTools({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const db = await getDb();
  const [rows, photos] = await Promise.all([
    db.query<ToolRow>(`SELECT ${COLUMNS} FROM tools WHERE user_id = $1 ORDER BY created_at, id`, [user.id]),
    photosByOwner(user.id, 'tool_id'),
  ]);
  return json({ tools: rows.map((r) => toTool(r, photos.get(r.id) ?? [])) });
}

export async function createTool({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const input = parseInput(toolSchema, await readJson(req));
  const id = randomUUID();
  await assertPhotosAvailable(user.id, 'tool_id', id, input.photoIds);
  const db = await getDb();
  await db.transaction([
    {
      text: `INSERT INTO tools (id, user_id, name, type, genre, seller, price, links, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      params: [id, user.id, input.name, input.type, input.genre, input.seller, input.price, input.links, input.details],
    },
    ...syncPhotosQueries(user.id, 'tool_id', id, input.photoIds),
  ]);
  return json({ tool: await loadTool(user.id, id) }, { status: 201 });
}

export async function updateTool({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Strumento non trovato.');
  const input = parseInput(toolSchema, await readJson(req));
  await assertPhotosAvailable(user.id, 'tool_id', params.id, input.photoIds);
  const db = await getDb();
  const [updated, removed] = await db.transaction([
    {
      text: `UPDATE tools SET name = $3, type = $4, genre = $5, seller = $6, price = $7, links = $8, details = $9, updated_at = now()
              WHERE id = $1 AND user_id = $2 RETURNING id`,
      params: [params.id, user.id, input.name, input.type, input.genre, input.seller, input.price, input.links, input.details],
    },
    ...syncPhotosQueries(user.id, 'tool_id', params.id, input.photoIds),
  ]);
  if (!updated.length) throw new HttpError(404, 'Strumento non trovato.');
  await purgePhotos(user.id, removed.map((r) => String(r.id)));
  return json({ tool: await loadTool(user.id, params.id) });
}

export async function deleteTool({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Strumento non trovato.');
  const db = await getDb();
  const [detached, deleted] = await db.transaction([
    { text: 'UPDATE photos SET tool_id = NULL WHERE tool_id = $1 AND user_id = $2 RETURNING id', params: [params.id, user.id] },
    { text: 'DELETE FROM tools WHERE id = $1 AND user_id = $2 RETURNING id', params: [params.id, user.id] },
  ]);
  if (!deleted.length) throw new HttpError(404, 'Strumento non trovato.');
  await purgePhotos(user.id, detached.map((r) => String(r.id)));
  return noContent();
}
