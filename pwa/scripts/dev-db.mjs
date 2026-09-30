// Starts a local PostgreSQL server for development (no Docker or Neon account needed)
// and applies the migrations. Data is kept in ./.dev-db between runs. Stop with Ctrl+C.
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';
import { runMigrations } from './migrate.mjs';

const PORT = 5433;
const DATABASE = 'bonsai_chef';
const DATA_DIR = new URL('../.dev-db', import.meta.url).pathname;
const url = `postgres://postgres:postgres@localhost:${PORT}/${DATABASE}`;

const server = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  onLog: () => {},
});

const firstRun = !existsSync(DATA_DIR);
if (firstRun) await server.initialise();
await server.start();
if (firstRun) await server.createDatabase(DATABASE);

await runMigrations(url);
console.log(`\nPostgres di sviluppo in ascolto: ${url}`);
console.log('Premi Ctrl+C per fermarlo.\n');

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
