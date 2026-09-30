// Applies db/migrations/*.sql in order, once each, tracked in `schema_migrations`.
//
//   node scripts/migrate.mjs                 # fails if no database is configured
//   node scripts/migrate.mjs --if-configured # used by `npm run build`: skips quietly without a database
//
// On Netlify, only production builds migrate: deploy previews and branch deploys share the
// production database (per-context variables need a paid plan), so they must never change it.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const LOCK_ID = 7_281_945; // arbitrary, shared by every migration run

export function migrationUrl(env = process.env) {
  // Prefer a direct (unpooled) connection for DDL when one is provided.
  return (
    env.DATABASE_URL_UNPOOLED ||
    env.NETLIFY_DATABASE_URL_UNPOOLED ||
    env.DATABASE_URL ||
    env.NETLIFY_DATABASE_URL ||
    ''
  );
}

/** Why migrations must not run in this environment, or null when they may. */
export function migrationBlockedReason(env = process.env) {
  if (env.NETLIFY === 'true' && env.CONTEXT !== 'production') {
    return `Netlify build in context "${env.CONTEXT || 'unknown'}": only production builds migrate the database.`;
  }
  return null;
}

/** `until`: last migration file to apply (inclusive), e.g. to rebuild an older schema for a rehearsal. */
export async function runMigrations(connectionString, log = console.log, { until } = {}) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql') && (!until || f <= until))
      .sort();
    let applied = 0;
    for (const file of files) {
      await client.query('BEGIN');
      try {
        // Transaction-scoped lock: safe even through a transaction-mode connection pooler.
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
        const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
        if (rowCount) {
          await client.query('ROLLBACK');
          continue;
        }
        await client.query(await readFile(path.join(MIGRATIONS_DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied++;
        log(`  ✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    log(applied ? `Database migrated (${applied} new).` : 'Database schema is up to date.');
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // no .env file: rely on the real environment (e.g. Netlify build)
  }
  const blocked = migrationBlockedReason();
  if (blocked) {
    console.log(`Skipping database migrations. ${blocked}`);
    process.exit(0);
  }
  const url = migrationUrl();
  if (!url) {
    if (process.argv.includes('--if-configured')) {
      console.log('No DATABASE_URL set: skipping database migrations.');
      process.exit(0);
    }
    console.error('Set DATABASE_URL (or NETLIFY_DATABASE_URL) to run migrations.');
    process.exit(1);
  }
  runMigrations(url).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
