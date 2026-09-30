// Guards that protect the testers' data: previews never touch the database, and every migration
// is additive (it can add tables, columns and constraints, never change or remove existing data).
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../netlify/functions/api';
import { canUseData, PREVIEW_MESSAGE } from '../netlify/lib/deploy';
import { migrationBlockedReason } from '../scripts/migrate.mjs';

const MIGRATIONS_DIR = new URL('../db/migrations/', import.meta.url);
const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(new URL(name, MIGRATIONS_DIR), 'utf8') }));

/**
 * Constraints that a migration may drop, because the same statement adds them back with a wider
 * rule. Each entry was reviewed by hand: existing rows keep satisfying the new constraint.
 */
const WIDENED_CONSTRAINTS = new Set(['tools_type_check']);

/** SQL without comments and string literals, split into statements. */
function statements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Why a statement could change or lose existing data, or null when it is purely additive. */
function destructiveReason(statement: string): string | null {
  const s = statement.toUpperCase().replace(/\bON (DELETE|UPDATE) (CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION)\b/g, '');
  for (const word of ['TRUNCATE', 'DELETE', 'UPDATE', 'INSERT', 'RENAME', 'ALTER COLUMN', 'DROP TABLE', 'DROP COLUMN', 'DROP SCHEMA', 'DROP TYPE']) {
    if (new RegExp(`\\b${word}\\b`).test(s)) return `contains ${word}`;
  }
  if (/^CREATE (TABLE|(UNIQUE )?INDEX)\b/.test(s)) return null;
  if (/^ALTER TABLE\b/.test(s)) {
    if (/\bON DELETE CASCADE\b/i.test(statement)) return 'a new column on an existing table must not cascade deletes into it';
    for (const [, name] of s.matchAll(/\bDROP CONSTRAINT (?:IF EXISTS )?(\w+)/g)) {
      if (!WIDENED_CONSTRAINTS.has(name.toLowerCase())) return `drops constraint ${name.toLowerCase()} (not a reviewed widening)`;
      if (!new RegExp(`\\bADD CONSTRAINT ${name}\\b`).test(s)) return `drops constraint ${name.toLowerCase()} without adding it back`;
    }
    if (/\bDROP\b/.test(s.replace(/\bDROP CONSTRAINT (IF EXISTS )?\w+/g, ''))) return 'contains DROP';
    for (const [column] of s.matchAll(/\bADD COLUMN [^,]*/g)) {
      if (/\bNOT NULL\b/.test(column) && !/\bDEFAULT\b/.test(column)) return `${column.trim()}: NOT NULL needs a DEFAULT`;
    }
    return null;
  }
  return 'only CREATE TABLE, CREATE INDEX and ALTER TABLE … ADD are allowed';
}

describe('migrations', () => {
  it.each(migrations)('$name only adds to the schema', ({ sql }) => {
    const problems = statements(sql)
      .map((s) => ({ statement: s.slice(0, 120), reason: destructiveReason(s) }))
      .filter((p) => p.reason);
    expect(problems).toEqual([]);
  });

  it('the guard catches destructive statements', () => {
    expect(destructiveReason('DELETE FROM bonsai')).toMatch(/DELETE/);
    expect(destructiveReason('UPDATE bonsai SET care = NULL')).toMatch(/UPDATE/);
    expect(destructiveReason('ALTER TABLE bonsai DROP COLUMN pot')).toMatch(/DROP/);
    expect(destructiveReason('ALTER TABLE bonsai RENAME COLUMN pot TO vaso')).toMatch(/RENAME/);
    expect(destructiveReason('ALTER TABLE bonsai ALTER COLUMN name TYPE varchar(10)')).toMatch(/ALTER COLUMN/);
    expect(destructiveReason('DROP TABLE tools')).toMatch(/DROP/);
    expect(destructiveReason('TRUNCATE photos')).toMatch(/TRUNCATE/);
    expect(destructiveReason('ALTER TABLE bonsai ADD COLUMN x int NOT NULL')).toMatch(/DEFAULT/);
    expect(destructiveReason('ALTER TABLE photos ADD COLUMN x uuid REFERENCES bonsai (id) ON DELETE CASCADE')).toMatch(/cascade/);
    expect(destructiveReason('ALTER TABLE bonsai DROP CONSTRAINT bonsai_category_check')).toMatch(/not a reviewed/);
    expect(destructiveReason('ALTER TABLE tools DROP CONSTRAINT tools_type_check')).toMatch(/without adding it back/);
  });

  it('the guard lets additive statements through', () => {
    expect(destructiveReason('CREATE TABLE x (id uuid PRIMARY KEY, b uuid REFERENCES bonsai (id) ON DELETE CASCADE)')).toBeNull();
    expect(destructiveReason('ALTER TABLE bonsai ADD COLUMN schedule jsonb NOT NULL DEFAULT {}')).toBeNull();
    expect(destructiveReason('ALTER TABLE bonsai ADD COLUMN g uuid REFERENCES bonsai_groups (id) ON DELETE SET NULL')).toBeNull();
    expect(
      destructiveReason("ALTER TABLE tools DROP CONSTRAINT tools_type_check, ADD CONSTRAINT tools_type_check CHECK (type IN ('a'))"),
    ).toBeNull();
  });
});

describe('build-time migrations', () => {
  it('run only in production builds on Netlify', () => {
    expect(migrationBlockedReason({ NETLIFY: 'true', CONTEXT: 'production' })).toBeNull();
    expect(migrationBlockedReason({ NETLIFY: 'true', CONTEXT: 'deploy-preview' })).toMatch(/deploy-preview/);
    expect(migrationBlockedReason({ NETLIFY: 'true', CONTEXT: 'branch-deploy' })).toMatch(/branch-deploy/);
    expect(migrationBlockedReason({ NETLIFY: 'true' })).toMatch(/unknown/);
  });

  it('run locally (never on Netlify)', () => {
    expect(migrationBlockedReason({})).toBeNull();
  });
});

describe('deploy previews', () => {
  afterEach(() => vi.unstubAllEnvs());
  const context = (name: string) => ({ deploy: { context: name, id: '1', published: false }, ip: '1.2.3.4' }) as never;

  it('only production and local development may use data', () => {
    vi.stubEnv('NETLIFY_DEV', '');
    vi.stubEnv('NETLIFY_LOCAL', '');
    expect(canUseData(context('production'))).toBe(true);
    expect(canUseData(context('deploy-preview'))).toBe(false);
    expect(canUseData(context('branch-deploy'))).toBe(false);
    expect(canUseData({ deploy: undefined } as never)).toBe(false);
    vi.stubEnv('NETLIFY_DEV', 'true');
    expect(canUseData(context('dev'))).toBe(true);
  });

  it('get a 503 before any database access', async () => {
    vi.stubEnv('NETLIFY_DEV', '');
    vi.stubEnv('NETLIFY_LOCAL', '');
    // Would fail loudly (500) if the request reached the database.
    vi.stubEnv('DATABASE_URL', 'postgres://must-not-be-used.invalid/db');
    for (const [method, path] of [
      ['GET', '/api/auth/me'],
      ['GET', '/api/bonsai'],
      ['DELETE', '/api/bonsai/6f1c1a2e-2c55-4c55-9a6e-0c1d7d9b1f00'],
      ['POST', '/api/auth/request-code'],
    ]) {
      const res = await api(new Request(`https://deploy-preview-1--site.netlify.app${path}`, { method }), context('deploy-preview'));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: PREVIEW_MESSAGE });
    }
  });
});
