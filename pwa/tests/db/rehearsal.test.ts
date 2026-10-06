import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../../scripts/migrate.mjs';
import { rehearseLocally } from '../../scripts/rehearse-migrations.mjs';

const silent = () => {};

describe('migration rehearsal', () => {
  it('passes: the new migrations leave production-format data untouched', async () => {
    await expect(rehearseLocally(undefined, silent)).resolves.toBeUndefined();
  });

  it('catches a migration that changes existing rows', async () => {
    const destructive = async (url: string, log: (line: string) => void) => {
      await runMigrations(url, log);
      const client = new pg.Client({ connectionString: url });
      await client.connect();
      await client.query("UPDATE bonsai SET pot = 'changed' WHERE name = 'Ficus'");
      await client.end();
    };
    await expect(rehearseLocally(undefined, silent, destructive)).rejects.toThrow(/bonsai: 3 → 3 rows/);
  });

  it('catches a migration that deletes rows', async () => {
    const destructive = async (url: string, log: (line: string) => void) => {
      await runMigrations(url, log);
      const client = new pg.Client({ connectionString: url });
      await client.connect();
      await client.query('DELETE FROM reminders WHERE sent_at IS NOT NULL');
      await client.end();
    };
    await expect(rehearseLocally(undefined, silent, destructive)).rejects.toThrow(/reminders: 3 → 2 rows/);
  });
});
