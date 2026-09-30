import { createHash, randomBytes, randomUUID } from 'node:crypto';
import api from '../../netlify/functions/api';
import { getDb } from '../../netlify/lib/db';

const production = { deploy: { context: 'production', id: 'test', published: true }, ip: '127.0.0.1' } as never;

export interface TestUser {
  id: string;
  email: string;
  cookie: string;
}

/** A user with a valid session, as if they had logged in with an OTP code. */
export async function createUser(): Promise<TestUser> {
  const db = await getDb();
  const email = `${randomUUID()}@example.com`;
  const token = randomBytes(32).toString('base64url');
  const [user] = await db.query<{ id: string }>('INSERT INTO users (email) VALUES ($1) RETURNING id', [email]);
  await db.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '90 days')",
    [createHash('sha256').update(token).digest('hex'), user.id],
  );
  return { id: user.id, email, cookie: `bc_session=${token}` };
}

/** Calls the API function like the browser does (same origin, session cookie). */
export async function call<T = Record<string, unknown>>(
  user: TestUser | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { Origin: 'https://app.test' };
  if (user) headers.Cookie = user.cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await api(
    new Request(`https://app.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    production,
  );
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : null) as T };
}

/** Uploads a tiny JPEG and returns its id (an unattached photo, like a fresh upload in a form). */
export async function uploadPhoto(user: TestUser): Promise<string> {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const res = await api(
    new Request('https://app.test/api/photos?w=10&h=10', {
      method: 'POST',
      headers: { Origin: 'https://app.test', Cookie: user.cookie, 'Content-Type': 'image/jpeg' },
      body: jpeg,
    }),
    production,
  );
  const data = (await res.json()) as { photo: { id: string } };
  return data.photo.id;
}
