import type { Bonsai, BonsaiInput, Photo, Reminder, Tool, ToolInput, User } from '../../shared/model';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body instanceof Blob ? { 'Content-Type': body.type } : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body instanceof Blob ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      navigator.onLine ? 'Impossibile contattare il server. Riprova tra poco.' : 'Sei offline. Controlla la connessione e riprova.',
    );
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Errore imprevisto (${res.status}).`);
  return data as T;
}

export const photoUrl = (id: string) => `/api/photos/${id}`;

export const api = {
  me: () => request<{ user: User }>('GET', '/api/auth/me').then((r) => r.user),
  requestCode: (email: string) =>
    request<{ expiresInMinutes: number; resendAfterSeconds: number }>('POST', '/api/auth/request-code', { email }),
  verifyCode: (email: string, code: string) =>
    request<{ user: User }>('POST', '/api/auth/verify-code', { email, code }).then((r) => r.user),
  logout: () => request<void>('POST', '/api/auth/logout'),

  listBonsai: () => request<{ bonsai: Bonsai[] }>('GET', '/api/bonsai').then((r) => r.bonsai),
  createBonsai: (input: BonsaiInput) => request<{ bonsai: Bonsai }>('POST', '/api/bonsai', input).then((r) => r.bonsai),
  updateBonsai: (id: string, input: BonsaiInput) =>
    request<{ bonsai: Bonsai }>('PUT', `/api/bonsai/${id}`, input).then((r) => r.bonsai),
  deleteBonsai: (id: string) => request<void>('DELETE', `/api/bonsai/${id}`),

  listTools: () => request<{ tools: Tool[] }>('GET', '/api/tools').then((r) => r.tools),
  createTool: (input: ToolInput) => request<{ tool: Tool }>('POST', '/api/tools', input).then((r) => r.tool),
  updateTool: (id: string, input: ToolInput) => request<{ tool: Tool }>('PUT', `/api/tools/${id}`, input).then((r) => r.tool),
  deleteTool: (id: string) => request<void>('DELETE', `/api/tools/${id}`),

  uploadPhoto: (blob: Blob, width: number, height: number) =>
    request<{ photo: Photo }>('POST', `/api/photos?w=${width}&h=${height}`, blob).then((r) => r.photo),

  listReminders: () => request<{ reminders: Reminder[] }>('GET', '/api/reminders').then((r) => r.reminders),
  createReminder: (input: { bonsaiId: string; message: string; remindAt: string }) =>
    request<{ reminder: Reminder }>('POST', '/api/reminders', input).then((r) => r.reminder),
  deleteReminder: (id: string) => request<void>('DELETE', `/api/reminders/${id}`),

  pushPublicKey: () => request<{ publicKey: string }>('GET', '/api/push/public-key').then((r) => r.publicKey),
  pushSubscribe: (subscription: PushSubscriptionJSON) => request<void>('POST', '/api/push/subscribe', subscription),
  pushUnsubscribe: (endpoint: string) => request<void>('POST', '/api/push/unsubscribe', { endpoint }),
  pushTest: () => request<{ delivered: number }>('POST', '/api/push/test'),
};
