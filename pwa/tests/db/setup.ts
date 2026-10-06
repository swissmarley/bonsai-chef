import { inject, vi } from 'vitest';

process.env.DATABASE_URL = inject('databaseUrl');
process.env.NETLIFY_DEV = 'true'; // local development: e-mails are printed, not sent

// Netlify Blobs only exist on Netlify: an in-memory store per name, inspectable by the tests.
vi.mock('@netlify/blobs', () => {
  const stores = new Map<string, Map<string, unknown>>();
  (globalThis as { blobStores?: typeof stores }).blobStores = stores;
  return {
    getStore: ({ name }: { name: string }) => {
      const store = stores.get(name) ?? new Map<string, unknown>();
      stores.set(name, store);
      return {
        set: async (key: string, value: unknown) => void store.set(key, value),
        get: async (key: string) => store.get(key) ?? null,
        delete: async (key: string) => void store.delete(key),
      };
    },
  };
});
