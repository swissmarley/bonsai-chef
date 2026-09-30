import { z } from 'zod';

z.config(z.locales.it());

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export const noContent = (headers?: ResponseInit['headers']) => new Response(null, { status: 204, headers });

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Richiesta non valida.');
  }
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  email: 'Email',
  code: 'Codice',
  message: 'Messaggio',
  remindAt: 'Data e ora',
};

/** Validates input with zod and turns the first problem into a readable Italian 400 error. */
export function parseInput<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.map(String).at(-1);
  const label = field && FIELD_LABELS[field];
  const message = issue.message.startsWith('!') ? issue.message.slice(1) : label ? `${label}: ${issue.message}` : issue.message;
  throw new HttpError(400, message);
}

/** Custom zod messages prefixed with "!" are shown verbatim (without the field label). */
export const msg = (text: string) => `!${text}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

export interface RouteContext {
  req: Request;
  url: URL;
  params: Record<string, string>;
  ip: string;
}

type Handler = (ctx: RouteContext) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  on(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const source = path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.routes.push({ method, pattern: new RegExp(`^${source}/?$`), keys, handler });
    return this;
  }

  async handle(req: Request, ip: string): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) assertSameOrigin(req, url);
      let pathMatched = false;
      for (const route of this.routes) {
        const match = route.pattern.exec(url.pathname);
        if (!match) continue;
        pathMatched = true;
        if (route.method !== req.method) continue;
        const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
        return await route.handler({ req, url, params, ip });
      }
      throw pathMatched ? new HttpError(405, 'Metodo non consentito.') : new HttpError(404, 'Risorsa non trovata.');
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
      console.error(`[api] ${req.method} ${url.pathname}`, err);
      return json({ error: 'Si è verificato un errore imprevisto. Riprova.' }, { status: 500 });
    }
  }
}

/** Defence in depth on top of SameSite cookies: reject cross-site state-changing requests. */
function assertSameOrigin(req: Request, url: URL) {
  const origin = req.headers.get('Origin');
  if (!origin) return;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Origine non consentita.');
  }
  const forwardedHost = req.headers.get('X-Forwarded-Host');
  if (host !== url.host && host !== forwardedHost) throw new HttpError(403, 'Origine non consentita.');
}
