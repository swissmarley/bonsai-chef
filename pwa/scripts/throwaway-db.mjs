// A temporary local PostgreSQL (deleted when stopped), for migration rehearsals and database tests.
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export async function startThrowawayPostgres(database = 'bonsai_chef_test') {
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: await mkdtemp(path.join(tmpdir(), 'bonsai-chef-pg-')),
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    onLog: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase(database);
  return {
    url: `postgres://postgres:postgres@localhost:${port}/${database}`,
    stop: () => server.stop(),
  };
}
