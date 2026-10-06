// Storico interventi: the diary of care tasks done on each tree.
import { randomUUID } from 'node:crypto';
import type { CareEvent, CareEventDetails, CareEventSuggestions, CareEventTool, EventKind, Photo } from '../../shared/model';
import { requireUser } from './auth';
import { getDb, iso, type Query } from './db';
import { HttpError, isUuid, json, noContent, parseInput, readJson, type RouteContext } from './http';
import { purgePhotos } from './photos';
import { refreshNextDue, REMINDER_COLUMNS, toReminder, type ReminderRow } from './reminders';
import { eventCreateSchema, eventUpdateSchema, normalizeDetails } from './schemas';

interface EventRow {
  id: string;
  bonsai_id: string;
  kind: EventKind;
  date: string;
  notes: string;
  details: CareEventDetails | null;
  batch_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// `date::text`: a DATE must stay a calendar day, never become a time-zone dependent timestamp.
const COLUMNS = 'id, bonsai_id, kind, date::text AS date, notes, details, batch_id, created_at, updated_at';

async function loadEvents(userId: string, filter: { bonsaiId: string } | { ids: string[] }): Promise<CareEvent[]> {
  const db = await getDb();
  const rows = await db.query<EventRow>(
    `SELECT ${COLUMNS} FROM care_events
      WHERE user_id = $1 AND ${'bonsaiId' in filter ? 'bonsai_id = $2' : 'id = ANY($2::uuid[])'}
      ORDER BY date DESC, created_at DESC, id`,
    [userId, 'bonsaiId' in filter ? filter.bonsaiId : filter.ids],
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [toolRows, photoRows] = await Promise.all([
    db.query<{ event_id: string; tool_id: string | null; name: string }>(
      'SELECT event_id, tool_id, name FROM care_event_tools WHERE event_id = ANY($1::uuid[]) ORDER BY position',
      [ids],
    ),
    db.query<{ id: string; event_id: string; width: number | null; height: number | null }>(
      'SELECT id, event_id, width, height FROM photos WHERE user_id = $1 AND event_id = ANY($2::uuid[]) ORDER BY position, created_at',
      [userId, ids],
    ),
  ]);
  const tools = new Map<string, CareEventTool[]>();
  for (const t of toolRows) tools.set(t.event_id, [...(tools.get(t.event_id) ?? []), { toolId: t.tool_id, name: t.name }]);
  const photos = new Map<string, Photo[]>();
  for (const p of photoRows) photos.set(p.event_id, [...(photos.get(p.event_id) ?? []), { id: p.id, width: p.width, height: p.height }]);
  return rows.map((r) => ({
    id: r.id,
    bonsaiId: r.bonsai_id,
    kind: r.kind,
    date: r.date,
    notes: r.notes,
    details: normalizeDetails(r.kind, r.details),
    tools: tools.get(r.id) ?? [],
    photos: photos.get(r.id) ?? [],
    batchId: r.batch_id,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }));
}

/** Linked Strumenti must be the user's own; their current name is stored with the entry. */
async function resolveTools(userId: string, tools: CareEventTool[]): Promise<CareEventTool[]> {
  const ids = [...new Set(tools.map((t) => t.toolId).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const db = await getDb();
    const rows = await db.query<{ id: string; name: string }>('SELECT id, name FROM tools WHERE user_id = $1 AND id = ANY($2::uuid[])', [
      userId,
      ids,
    ]);
    for (const r of rows) names.set(r.id, r.name);
  }
  return tools.map((t) => {
    if (!t.toolId) return { toolId: null, name: t.name };
    const name = names.get(t.toolId);
    if (name === undefined) throw new HttpError(400, 'Uno degli strumenti scelti non esiste più. Toglilo e riprova.');
    return { toolId: t.toolId, name };
  });
}

function insertToolsQuery(eventIds: string[], tools: CareEventTool[]): Query {
  return {
    text: `INSERT INTO care_event_tools (event_id, position, tool_id, name)
           SELECT e.id, t.position, t.tool_id, t.name
             FROM unnest($1::uuid[]) AS e(id)
            CROSS JOIN unnest($2::int[], $3::uuid[], $4::text[]) AS t(position, tool_id, name)`,
    params: [eventIds, tools.map((_, i) => i), tools.map((t) => t.toolId), tools.map((t) => t.name)],
  };
}

/** Only fresh uploads, or photos already on this entry, can be attached to it. */
async function assertEventPhotos(userId: string, photoIds: string[], eventId: string | null) {
  if (!photoIds.length) return;
  const db = await getDb();
  const [row] = await db.query<{ available: number }>(
    `SELECT count(*)::int AS available FROM photos
      WHERE user_id = $1 AND id = ANY($2::uuid[])
        AND ((bonsai_id IS NULL AND tool_id IS NULL) OR event_id = $3::uuid)`,
    [userId, [...new Set(photoIds)], eventId],
  );
  if (row.available < new Set(photoIds).size) {
    throw new HttpError(409, 'Alcune foto non sono più disponibili: rimuovile e caricale di nuovo.');
  }
}

/**
 * Makes `photoIds` the exact, ordered photo list of an entry. Entry photos also carry the tree's
 * `bonsai_id` (so every app version sees them as attached). The first query returns the photos
 * taken off the entry, to purge once the transaction has committed.
 */
function syncEventPhotosQueries(userId: string, eventId: string, bonsaiId: string, photoIds: string[]): Query[] {
  return [
    {
      text: `UPDATE photos SET event_id = NULL, bonsai_id = NULL
              WHERE event_id = $1 AND user_id = $2 AND NOT (id = ANY($3::uuid[]))
              RETURNING id`,
      params: [eventId, userId, photoIds],
    },
    {
      text: `UPDATE photos SET bonsai_id = $4, event_id = $1, position = array_position($3::uuid[], id) - 1
              WHERE user_id = $2 AND id = ANY($3::uuid[])
                AND ((bonsai_id IS NULL AND tool_id IS NULL) OR event_id = $1)
                AND EXISTS (SELECT 1 FROM care_events WHERE id = $1 AND user_id = $2)`,
      params: [eventId, userId, photoIds, bonsaiId],
    },
  ];
}

export async function listEvents({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Bonsai non trovato.');
  const db = await getDb();
  const owned = await db.query('SELECT 1 FROM bonsai WHERE id = $1 AND user_id = $2', [params.id, user.id]);
  if (!owned.length) throw new HttpError(404, 'Bonsai non trovato.');
  return json({ events: await loadEvents(user.id, { bonsaiId: params.id }) });
}

/**
 * Records a care task on one tree, or on several at once (a whole group, without photos).
 * `nextReminders` replace the pending automatic reminder of the same task on those trees;
 * reminders set by hand are never touched.
 */
export async function createEvents({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const input = parseInput(eventCreateSchema, await readJson(req));
  const db = await getDb();
  const owned = await db.query('SELECT id FROM bonsai WHERE user_id = $1 AND id = ANY($2::uuid[])', [user.id, input.bonsaiIds]);
  if (owned.length !== input.bonsaiIds.length) throw new HttpError(404, 'Bonsai non trovato.');
  const [tools] = await Promise.all([resolveTools(user.id, input.tools), assertEventPhotos(user.id, input.photoIds, null)]);

  const ids = input.bonsaiIds.map(() => randomUUID());
  const queries: Query[] = [
    {
      text: `INSERT INTO care_events (id, user_id, bonsai_id, kind, date, notes, details, batch_id)
             SELECT e.id, $1, e.bonsai_id, $4, $5::date, $6, $7::jsonb, $8::uuid
               FROM unnest($2::uuid[], $3::uuid[]) AS e(id, bonsai_id)`,
      params: [
        user.id,
        ids,
        input.bonsaiIds,
        input.kind,
        input.date,
        input.notes,
        JSON.stringify(normalizeDetails(input.kind, input.details)),
        ids.length > 1 ? randomUUID() : null,
      ],
    },
  ];
  if (tools.length) queries.push(insertToolsQuery(ids, tools));
  if (input.photoIds.length) queries.push(syncEventPhotosQueries(user.id, ids[0], input.bonsaiIds[0], input.photoIds)[1]);
  const reminders = input.nextReminders;
  if (reminders.length) {
    queries.push(
      {
        text: `DELETE FROM reminders
                WHERE user_id = $1 AND care_kind = $2 AND sent_at IS NULL AND bonsai_id = ANY($3::uuid[])`,
        params: [user.id, input.kind, reminders.map((r) => r.bonsaiId)],
      },
      {
        text: `INSERT INTO reminders (user_id, bonsai_id, message, remind_at, care_kind)
               SELECT $1, r.bonsai_id, r.message, r.remind_at, $2
                 FROM unnest($3::uuid[], $4::text[], $5::timestamptz[]) AS r(bonsai_id, message, remind_at)
               RETURNING ${REMINDER_COLUMNS}`,
        params: [user.id, input.kind, reminders.map((r) => r.bonsaiId), reminders.map((r) => r.message), reminders.map((r) => r.remindAt)],
      },
    );
  }
  const results = await db.transaction(queries);
  if (reminders.length) {
    // Wake the scheduler up; if this fails, the hourly check still finds the reminders.
    await refreshNextDue().catch((err) => console.error('[reminders] cannot update next due time', err));
  }
  return json(
    {
      events: await loadEvents(user.id, { ids }),
      reminders: reminders.length ? (results.at(-1) as unknown as ReminderRow[]).map(toReminder) : [],
    },
    { status: 201 },
  );
}

export async function updateEvent({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Intervento non trovato.');
  const input = parseInput(eventUpdateSchema, await readJson(req));
  const db = await getDb();
  const [existing] = await db.query<{ bonsai_id: string }>('SELECT bonsai_id FROM care_events WHERE id = $1 AND user_id = $2', [
    params.id,
    user.id,
  ]);
  if (!existing) throw new HttpError(404, 'Intervento non trovato.');
  const [tools] = await Promise.all([resolveTools(user.id, input.tools), assertEventPhotos(user.id, input.photoIds, params.id)]);

  const photoQueries = syncEventPhotosQueries(user.id, params.id, existing.bonsai_id, input.photoIds);
  const results = await db.transaction([
    {
      text: `UPDATE care_events SET kind = $3, date = $4::date, notes = $5, details = $6::jsonb, updated_at = now()
              WHERE id = $1 AND user_id = $2 RETURNING id`,
      params: [params.id, user.id, input.kind, input.date, input.notes, JSON.stringify(normalizeDetails(input.kind, input.details))],
    },
    { text: 'DELETE FROM care_event_tools WHERE event_id = $1', params: [params.id] },
    ...(tools.length ? [insertToolsQuery([params.id], tools)] : []),
    ...photoQueries,
  ]);
  if (!results[0].length) throw new HttpError(404, 'Intervento non trovato.');
  const removed = results[results.length - photoQueries.length];
  await purgePhotos(user.id, removed.map((r) => String(r.id)));
  const [event] = await loadEvents(user.id, { ids: [params.id] });
  return json({ event });
}

/** Deletes one entry; its photos stay among the tree's photos. */
export async function deleteEvent({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Intervento non trovato.');
  const db = await getDb();
  const rows = await db.query('DELETE FROM care_events WHERE id = $1 AND user_id = $2 RETURNING id', [params.id, user.id]);
  if (!rows.length) throw new HttpError(404, 'Intervento non trovato.');
  return noContent();
}

/** Values used before (most recent first), to suggest while typing: also the older cards' substrato/vaso/concime. */
export async function eventSuggestions({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const db = await getDb();
  const [fromEvents, fromCards] = await Promise.all([
    db.query<{ key: keyof CareEventSuggestions; value: string }>(
      `SELECT d.key, d.value
         FROM care_events e CROSS JOIN LATERAL jsonb_each_text(e.details) AS d(key, value)
        WHERE e.user_id = $1 AND d.key IN ('mix', 'pot', 'product', 'dose') AND btrim(d.value) <> ''
        GROUP BY d.key, d.value
        ORDER BY max(e.date) DESC, max(e.created_at) DESC
        LIMIT 400`,
      [user.id],
    ),
    db.query<{ substrate: string; pot: string; fertilizer: string }>(
      `SELECT substrate, pot, coalesce(care -> 'fertilizing' ->> 'fertilizerType', '') AS fertilizer
         FROM bonsai WHERE user_id = $1 ORDER BY updated_at DESC`,
      [user.id],
    ),
  ]);
  const suggestions: CareEventSuggestions = { mix: [], pot: [], product: [], dose: [] };
  const add = (key: keyof CareEventSuggestions, raw: string) => {
    const value = raw.trim();
    const list = suggestions[key];
    if (value && list.length < 20 && !list.some((v) => v.toLowerCase() === value.toLowerCase())) list.push(value);
  };
  for (const r of fromEvents) add(r.key, r.value);
  for (const r of fromCards) {
    add('mix', r.substrate);
    add('pot', r.pot);
    add('product', r.fertilizer);
  }
  return json({ suggestions });
}
