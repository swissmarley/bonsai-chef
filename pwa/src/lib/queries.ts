import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Bonsai, BonsaiInput, Reminder, Tool, ToolInput, User } from '../../shared/model';
import { api, ApiError } from './api';

export const keys = {
  me: ['me'] as const,
  bonsai: ['bonsai'] as const,
  tools: ['tools'] as const,
  reminders: ['reminders'] as const,
};

export function useMe() {
  return useQuery<User | null>({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });
}

export const useBonsaiList = () => useQuery({ queryKey: keys.bonsai, queryFn: api.listBonsai });
export const useToolList = () => useQuery({ queryKey: keys.tools, queryFn: api.listTools });
export const useReminders = () => useQuery({ queryKey: keys.reminders, queryFn: api.listReminders });

function upsert<T extends { id: string }>(list: T[] | undefined, item: T): T[] {
  if (!list) return [item];
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

export function useSaveBonsai() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: BonsaiInput }) => (id ? api.updateBonsai(id, input) : api.createBonsai(input)),
    onSuccess: (saved) => qc.setQueryData<Bonsai[]>(keys.bonsai, (list) => upsert(list, saved)),
  });
}

export function useDeleteBonsai() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteBonsai(id),
    onSuccess: (_, id) => {
      qc.setQueryData<Bonsai[]>(keys.bonsai, (list) => list?.filter((b) => b.id !== id));
      qc.setQueryData<Reminder[]>(keys.reminders, (list) => list?.filter((r) => r.bonsaiId !== id));
    },
  });
}

export function useSaveTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ToolInput }) => (id ? api.updateTool(id, input) : api.createTool(input)),
    onSuccess: (saved) => qc.setQueryData<Tool[]>(keys.tools, (list) => upsert(list, saved)),
  });
}

export function useDeleteTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTool(id),
    onSuccess: (_, id) => qc.setQueryData<Tool[]>(keys.tools, (list) => list?.filter((t) => t.id !== id)),
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createReminder,
    onSuccess: (reminder) =>
      qc.setQueryData<Reminder[]>(keys.reminders, (list) =>
        [...(list ?? []), reminder].sort((a, b) => a.remindAt.localeCompare(b.remindAt)),
      ),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReminder(id),
    onSuccess: (_, id) => qc.setQueryData<Reminder[]>(keys.reminders, (list) => list?.filter((r) => r.id !== id)),
  });
}

async function dropUserData(qc: QueryClient) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.me[0] });
  if ('caches' in window) {
    await Promise.all(['bc-data', 'bc-photos'].map((name) => caches.delete(name)));
  }
}

/** Sign out locally: forget everything about the user (memory + service-worker caches). */
export async function clearUserData(qc: QueryClient) {
  // Signing out first swaps the app for the login screen (clear() alone would not notify observers)…
  qc.setQueryData(keys.me, null);
  // …then everything else of the previous user is dropped.
  await dropUserData(qc);
}

/** After a successful login: never show data cached for a previous user of this device. */
export async function startSession(qc: QueryClient, user: User) {
  await dropUserData(qc);
  qc.setQueryData(keys.me, user);
}
