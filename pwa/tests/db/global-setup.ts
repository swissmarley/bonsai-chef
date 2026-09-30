import type { TestProject } from 'vitest/node';
import { runMigrations } from '../../scripts/migrate.mjs';
import { startThrowawayPostgres } from '../../scripts/throwaway-db.mjs';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const db = await startThrowawayPostgres();
  await runMigrations(db.url, () => {});
  project.provide('databaseUrl', db.url);
  return () => db.stop();
}
