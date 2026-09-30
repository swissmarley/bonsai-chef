import { neon } from '@neondatabase/serverless';

export type Row = Record<string, unknown>;

export interface Query {
  text: string;
  params?: unknown[];
}

export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs the queries atomically (non-interactive, like Neon's HTTP transactions). */
  transaction(queries: Query[]): Promise<Row[][]>;
}

let instance: Promise<Db> | undefined;

/**
 * Neon over HTTP in production. A plain local Postgres (from `npm run dev:db`)
 * is reached with node-postgres, since the HTTP protocol only exists on Neon.
 */
export function getDb(): Promise<Db> {
  instance ??= createDb().catch((err) => {
    instance = undefined;
    throw err;
  });
  return instance;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL non configurato');
  return isLocalUrl(url) ? createLocalDb(url) : createNeonDb(url);
}

function isLocalUrl(url: string): boolean {
  const host = new URL(url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function createNeonDb(url: string): Db {
  const sql = neon(url);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
    async transaction(queries) {
      return (await sql.transaction(queries.map((q) => sql.query(q.text, q.params ?? [])))) as Row[][];
    },
  };
}

async function createLocalDb(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pool.query(text, params)).rows as T[];
    },
    async transaction(queries) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const results: Row[][] = [];
        for (const q of queries) results.push((await client.query(q.text, q.params ?? [])).rows);
        await client.query('COMMIT');
        return results;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

export const iso = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value));
export const isoOrNull = (value: unknown): string | null => (value == null ? null : iso(value));
