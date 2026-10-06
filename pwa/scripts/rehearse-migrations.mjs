// Rehearses the pending migrations and proves they leave every existing row untouched.
//
//   npm run db:rehearse -- --local
//       Throwaway local Postgres: builds the production schema (migrations up to --from, default
//       PRODUCTION_BASELINE), fills it with sample data in that format, then rehearses.
//   REHEARSAL_DATABASE_URL=postgres://… npm run db:rehearse
//       A Neon *branch* (copy) of production, created in the Neon console. Never production itself.
//
// For every table that exists before migrating, all rows are fingerprinted (count + md5 of the
// existing columns); after migrating, the same columns must give exactly the same fingerprints.
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runMigrations } from './migrate.mjs';
import { startThrowawayPostgres } from './throwaway-db.mjs';

/** The last migration applied in production before this release. */
const PRODUCTION_BASELINE = '002_reminder_delivery.sql';

const quote = (name) => `"${name.replaceAll('"', '""')}"`;

async function existingTables(client) {
  const { rows } = await client.query(
    `SELECT table_name AS name, array_agg(column_name::text ORDER BY ordinal_position) AS columns
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> 'schema_migrations'
      GROUP BY table_name ORDER BY table_name`,
  );
  return rows;
}

async function fingerprint(client, tables) {
  const result = {};
  for (const { name, columns } of tables) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS rows, coalesce(md5(string_agg(r, E'\\n' ORDER BY r)), '-') AS hash
         FROM (SELECT ROW(${columns.map(quote).join(', ')})::text AS r FROM ${quote(name)}) t`,
    );
    result[name] = rows[0];
  }
  return result;
}

/** `migrate` is replaceable so tests can prove that a change to existing data is caught. */
export async function rehearse(url, log = console.log, migrate = runMigrations) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const tables = await existingTables(client);
    const before = await fingerprint(client, tables);
    await migrate(url, (line) => log(`  ${line}`));
    const after = await fingerprint(client, tables);

    const problems = [];
    log('\n  table                 rows   unchanged');
    for (const { name } of tables) {
      const same = before[name].rows === after[name].rows && before[name].hash === after[name].hash;
      if (!same) problems.push(`${name}: ${before[name].rows} → ${after[name].rows} rows, hash ${before[name].hash} → ${after[name].hash}`);
      log(`  ${name.padEnd(20)} ${String(after[name].rows).padStart(5)}   ${same ? '✓' : '✗ CHANGED'}`);
    }
    if (problems.length) throw new Error(`Existing data changed:\n${problems.join('\n')}`);
    log('\nRehearsal passed: every existing row is identical after migrating.');
  } finally {
    await client.end();
  }
}

/** Sample data in the format production has at PRODUCTION_BASELINE (as written by the current app). */
export async function seedBaseline(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const care = (extra = {}) =>
    JSON.stringify({
      repotting: { startMonth: 1, endMonth: 2, notes: 'Akadama 70% pomice 30%', lastDate: '2024-03-10' },
      pruning: { startMonth: 5, endMonth: 8, notes: '' },
      shootCutting: { startMonth: null, endMonth: null, notes: '' },
      wiring: { startMonth: 9, endMonth: 1, notes: 'Filo di rame', lastDate: null },
      defoliation: { startMonth: 5, endMonth: 5, notes: '' },
      fertilizing: { startMonth: 2, endMonth: 9, notes: 'Ogni 3 settimane', fertilizerType: 'Hanagokoro' },
      ...extra,
    });
  try {
    await client.query(`
      INSERT INTO users (id, email, last_login_at) VALUES
        ('00000000-0000-4000-8000-000000000001', 'tester1@example.com', now()),
        ('00000000-0000-4000-8000-000000000002', 'tester2@example.com', NULL);
      INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES
        ('hash-1', '00000000-0000-4000-8000-000000000001', now() + interval '90 days', 'Safari');
      INSERT INTO login_codes (email, code_hash, ip, attempts, expires_at) VALUES
        ('tester2@example.com', 'code-hash', '1.2.3.4', 1, now() + interval '5 minutes');
      INSERT INTO tools (id, user_id, name, type, genre, seller, price, links, details) VALUES
        ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Akadama', 'substrato', 'Hard', 'Negozio', '25 €', 'https://example.com', ''),
        ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Forbici', 'attrezzo', '', '', '', '', 'Concave'),
        ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000002', 'Tavolo', 'accessorio', '', '', '', '', '');`);
    await client.query(
      `INSERT INTO bonsai (id, user_id, name, category, substrate, pot, care) VALUES
        ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Pino nero', 'esterno', 'Akadama', 'Tokoname', $1::jsonb),
        ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Acero «Deshojo»', 'esterno', '', '', $2::jsonb),
        ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000002', 'Ficus', 'interno', 'Kiryu', '', '{}'::jsonb)`,
      [care(), care({ repotting: { startMonth: null, endMonth: null, notes: '', lastDate: '2025-02-28' } })],
    );
    await client.query(`
      INSERT INTO photos (id, user_id, bonsai_id, tool_id, position, content_type, byte_size, width, height) VALUES
        ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', NULL, 0, 'image/jpeg', 1000, 1600, 1200),
        ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', NULL, 1, 'image/jpeg', 1000, 1200, 1600),
        ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', NULL, '00000000-0000-4000-8000-000000000101', 0, 'image/png', 500, NULL, NULL),
        ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000002', NULL, NULL, 0, 'image/webp', 700, 800, 600);
      INSERT INTO reminders (user_id, bonsai_id, message, remind_at, sent_at, claimed_at, attempts) VALUES
        ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Concimare', now() + interval '3 days', NULL, NULL, 0),
        ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', '', now() - interval '3 days', now() - interval '3 days', NULL, 1),
        ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000203', 'Rinvaso', now() - interval '1 minute', NULL, now(), 2);
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES
        ('00000000-0000-4000-8000-000000000001', 'https://push.example.com/1', 'key', 'auth');`);
  } finally {
    await client.end();
  }
}

export async function rehearseLocally(from = PRODUCTION_BASELINE, log = console.log, migrate = runMigrations) {
  const db = await startThrowawayPostgres('rehearsal');
  try {
    log(`Throwaway database with the schema up to ${from} and sample data:`);
    await runMigrations(db.url, (line) => log(`  ${line}`), { until: from });
    await seedBaseline(db.url);
    log('\nApplying the new migrations:');
    await rehearse(db.url, log, migrate);
  } finally {
    await db.stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fromIndex = args.indexOf('--from');
  const run = args.includes('--local')
    ? rehearseLocally(fromIndex >= 0 ? args[fromIndex + 1] : undefined)
    : (() => {
        const url = process.env.REHEARSAL_DATABASE_URL;
        if (!url) throw new Error('Set REHEARSAL_DATABASE_URL to a Neon branch (copy) of production, or use --local.');
        console.log(`Rehearsal on ${new URL(url).hostname}:`);
        return rehearse(url);
      })();
  run.catch((err) => {
    console.error(`\n✗ ${err.message}`);
    process.exit(1);
  });
}
