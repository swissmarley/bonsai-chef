import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import type { Photo } from '../../shared/model';
import { requireUser } from './auth';
import { getDb, type Query } from './db';
import { HttpError, isUuid, json, type RouteContext } from './http';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 10_000;

const store = () => getStore({ name: 'photos', consistency: 'strong' });
const blobKey = (userId: string, photoId: string) => `${userId}/${photoId}`;

export type PhotoOwnerColumn = 'bonsai_id' | 'tool_id';
const OWNER_TABLE: Record<PhotoOwnerColumn, string> = { bonsai_id: 'bonsai', tool_id: 'tools' };

/** Detects the real image type from its first bytes (never trust the client's Content-Type alone). */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function dimension(value: string | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_DIMENSION ? n : null;
}

export async function uploadPhoto({ req, url }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (Number(req.headers.get('Content-Length')) > MAX_BYTES) {
    throw new HttpError(413, 'Immagine troppo grande (massimo 4 MB).');
  }
  const buffer = await req.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!bytes.byteLength) throw new HttpError(400, 'Immagine vuota.');
  if (bytes.byteLength > MAX_BYTES) throw new HttpError(413, 'Immagine troppo grande (massimo 4 MB).');
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new HttpError(415, 'Formato immagine non supportato. Usa JPEG, PNG o WebP.');

  const photo: Photo = {
    id: randomUUID(),
    width: dimension(url.searchParams.get('w')),
    height: dimension(url.searchParams.get('h')),
  };
  await store().set(blobKey(user.id, photo.id), buffer, { metadata: { contentType } });
  const db = await getDb();
  await db.query(
    'INSERT INTO photos (id, user_id, content_type, byte_size, width, height) VALUES ($1, $2, $3, $4, $5, $6)',
    [photo.id, user.id, contentType, bytes.byteLength, photo.width, photo.height],
  );
  return json({ photo }, { status: 201 });
}

export async function servePhoto({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Foto non trovata.');
  const db = await getDb();
  const [row] = await db.query<{ content_type: string }>(
    'SELECT content_type FROM photos WHERE id = $1 AND user_id = $2',
    [params.id, user.id],
  );
  const data = row && (await store().get(blobKey(user.id, params.id), { type: 'arrayBuffer' }));
  if (!data) throw new HttpError(404, 'Foto non trovata.');
  return new Response(data, {
    headers: {
      'Content-Type': row.content_type,
      'Content-Length': String(data.byteLength),
      // Photo ids are never reused, so the image can be cached forever (privately).
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Photos of the user's records of one kind (or of one record), grouped by record id, in display order.
 * Photos of diary entries are left out: they belong to their entry (see events.ts).
 */
export async function photosByOwner(userId: string, column: PhotoOwnerColumn, ownerId?: string): Promise<Map<string, Photo[]>> {
  const db = await getDb();
  const rows = await db.query<{ id: string; owner_id: string; width: number | null; height: number | null }>(
    `SELECT id, ${column} AS owner_id, width, height FROM photos
      WHERE user_id = $1 AND ${column} IS NOT NULL AND event_id IS NULL ${ownerId ? `AND ${column} = $2` : ''}
      ORDER BY position, created_at`,
    ownerId ? [userId, ownerId] : [userId],
  );
  const map = new Map<string, Photo[]>();
  for (const r of rows) {
    const list = map.get(r.owner_id) ?? [];
    list.push({ id: r.id, width: r.width, height: r.height });
    map.set(r.owner_id, list);
  }
  return map;
}

/**
 * Fails with 409 when some photos can no longer be attached, e.g. uploads purged because a form
 * stayed open for more than a day, instead of silently saving the record without them.
 */
export async function assertPhotosAvailable(userId: string, column: PhotoOwnerColumn, ownerId: string, photoIds: string[]) {
  const wanted = new Set(photoIds);
  if (!wanted.size) return;
  const db = await getDb();
  const [row] = await db.query<{ available: number }>(
    `SELECT count(*)::int AS available FROM photos
      WHERE user_id = $1 AND id = ANY($2::uuid[])
        AND ((bonsai_id IS NULL AND tool_id IS NULL) OR ${column} = $3)`,
    [userId, [...wanted], ownerId],
  );
  if (row.available < wanted.size) {
    throw new HttpError(409, 'Alcune foto non sono più disponibili: rimuovile e caricale di nuovo.');
  }
}

/**
 * Queries (for a transaction) that make `photoIds` the exact, ordered photo list of a record.
 * The first query returns the ids of photos that were removed; pass them to `purgePhotos`
 * once the transaction has committed. Only the user's own unattached photos (fresh uploads)
 * or photos already on this record can be attached.
 */
export function syncPhotosQueries(userId: string, column: PhotoOwnerColumn, ownerId: string, photoIds: string[]): Query[] {
  const table = OWNER_TABLE[column];
  // Photos of diary entries (event_id set) are never touched here: the bonsai form does not list
  // them, so leaving them out of `photoIds` must not detach (and then delete) them.
  return [
    {
      text: `UPDATE photos SET ${column} = NULL
              WHERE ${column} = $1 AND user_id = $2 AND event_id IS NULL AND NOT (id = ANY($3::uuid[]))
              RETURNING id`,
      params: [ownerId, userId, photoIds],
    },
    {
      text: `UPDATE photos SET ${column} = $1, position = array_position($3::uuid[], id) - 1
              WHERE user_id = $2 AND id = ANY($3::uuid[]) AND event_id IS NULL
                AND ((bonsai_id IS NULL AND tool_id IS NULL) OR ${column} = $1)
                AND EXISTS (SELECT 1 FROM ${table} WHERE id = $1 AND user_id = $2)`,
      params: [ownerId, userId, photoIds],
    },
  ];
}

/** Deletes unattached photos (blob first, then row, so a failure never leaves an untracked blob). */
export async function purgePhotos(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const rows = await db.query<{ id: string }>(
    'SELECT id FROM photos WHERE user_id = $1 AND id = ANY($2::uuid[]) AND bonsai_id IS NULL AND tool_id IS NULL',
    [userId, ids],
  );
  if (!rows.length) return;
  const blobs = store();
  await Promise.all(rows.map((r) => blobs.delete(blobKey(userId, r.id))));
  await db.query(
    'DELETE FROM photos WHERE user_id = $1 AND id = ANY($2::uuid[]) AND bonsai_id IS NULL AND tool_id IS NULL',
    [userId, rows.map((r) => r.id)],
  );
}

/** Removes uploads that were never saved to a record (e.g. a cancelled form) after a day. */
export async function purgeAbandonedPhotos(): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM photos
      WHERE bonsai_id IS NULL AND tool_id IS NULL AND created_at < now() - interval '1 day'
      LIMIT 200`,
  );
  const byUser = new Map<string, string[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.id]);
  for (const [userId, ids] of byUser) await purgePhotos(userId, ids);
  return rows.length;
}
