import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  Bonsai,
  BonsaiGroup,
  BonsaiInput,
  CareEvent,
  CareEventCreateInput,
  CareEventFields,
  Reminder,
  Tool,
  ToolInput,
  User,
} from '../../shared/model';
import { api, ApiError } from './api';

export const keys = {
  me: ['me'] as const,
  bonsai: ['bonsai'] as const,
  tools: ['tools'] as const,
  reminders: ['reminders'] as const,
  groups: ['groups'] as const,
  events: (bonsaiId: string) => ['events', bonsaiId] as const,
  suggestions: ['event-suggestions'] as const,
  announcements: ['announcements'] as const,
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
export const useGroups = () => useQuery({ queryKey: keys.groups, queryFn: api.listGroups });
export const useEvents = (bonsaiId: string | undefined) =>
  useQuery({ queryKey: keys.events(bonsaiId ?? ''), queryFn: () => api.listEvents(bonsaiId!), enabled: !!bonsaiId });
export const useEventSuggestions = () => useQuery({ queryKey: keys.suggestions, queryFn: api.eventSuggestions, staleTime: 5 * 60_000 });
export const useSeenAnnouncements = () => useQuery({ queryKey: keys.announcements, queryFn: api.seenAnnouncements, staleTime: Infinity });

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
      qc.removeQueries({ queryKey: keys.events(id) });
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
    onSuccess: (_, id) => {
      qc.setQueryData<Tool[]>(keys.tools, (list) => list?.filter((t) => t.id !== id));
      // Diary entries keep the name of the deleted item, without the link.
      void qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

const byPosition = (a: BonsaiGroup, b: BonsaiGroup) => a.position - b.position;

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createGroup,
    onSuccess: (group) => qc.setQueryData<BonsaiGroup[]>(keys.groups, (list) => upsert(list, group).sort(byPosition)),
  });
}

export function useRenameGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameGroup(id, name),
    onSuccess: (group) => qc.setQueryData<BonsaiGroup[]>(keys.groups, (list) => upsert(list, group)),
  });
}

export function useReorderGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.reorderGroups,
    onMutate: (ids) => {
      // Move rows right away; the server's answer confirms the order.
      qc.setQueryData<BonsaiGroup[]>(keys.groups, (list) =>
        list?.map((g) => ({ ...g, position: ids.indexOf(g.id) })).sort(byPosition),
      );
    },
    onSuccess: (groups) => qc.setQueryData(keys.groups, groups),
    onError: () => void qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteGroup(id),
    onSuccess: (_, id) => {
      qc.setQueryData<BonsaiGroup[]>(keys.groups, (list) => list?.filter((g) => g.id !== id));
      // Its trees stay, without a group.
      qc.setQueryData<Bonsai[]>(keys.bonsai, (list) => list?.map((b) => (b.groupId === id ? { ...b, groupId: null } : b)));
    },
  });
}

const newestFirst = (a: CareEvent, b: CareEvent) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function useCreateEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CareEventCreateInput) => api.createEvents(input),
    onSuccess: ({ events, reminders }, input) => {
      for (const event of events) {
        qc.setQueryData<CareEvent[]>(keys.events(event.bonsaiId), (list) => (list ? [...list, event].sort(newestFirst) : undefined));
      }
      if (reminders.length) {
        // The server replaced the pending automatic reminder of this task on these trees.
        const replaced = (r: Reminder) => r.careKind === input.kind && reminders.some((n) => n.bonsaiId === r.bonsaiId);
        qc.setQueryData<Reminder[]>(keys.reminders, (list) =>
          [...(list ?? []).filter((r) => !replaced(r)), ...reminders].sort((a, b) => a.remindAt.localeCompare(b.remindAt)),
        );
      }
      void qc.invalidateQueries({ queryKey: keys.suggestions });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CareEventFields }) => api.updateEvent(id, input),
    onSuccess: (event) => {
      qc.setQueryData<CareEvent[]>(keys.events(event.bonsaiId), (list) => list && upsert(list, event).sort(newestFirst));
      void qc.invalidateQueries({ queryKey: keys.suggestions });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (event: CareEvent) => api.deleteEvent(event.id),
    onSuccess: (_, event) => {
      qc.setQueryData<CareEvent[]>(keys.events(event.bonsaiId), (list) => list?.filter((e) => e.id !== event.id));
      // Its photos moved to the tree's own photos.
      if (event.photos.length) void qc.invalidateQueries({ queryKey: keys.bonsai });
    },
  });
}

export function useMarkAnnouncementSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.markAnnouncementSeen(key),
    onMutate: (key) => qc.setQueryData<string[]>(keys.announcements, (seen) => [...(seen ?? []), key]),
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
