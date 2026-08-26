import { getIdToken } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, where, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { List, ListItem, ListType, ListWithItemCount, Project, ProjectWithCount, ShoppingCategory, Task, TaskStatus } from './types';
import {
  cacheTask,
  cacheTasks,
  deleteCachedTask,
  getCachedTask,
  getCachedTasks,
  cacheProjects,
  getCachedProjects,
  cacheList,
  cacheLists,
  getCachedLists,
  deleteCachedList,
  cacheListItem,
  cacheListItems,
  getCachedListItems,
  deleteCachedListItem,
} from './db';
import { syncWithRetry } from './syncQueue';

const API_URL = import.meta.env.VITE_API_URL as string;

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await getIdToken(user, false);

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

export async function listTasks(): Promise<Task[]> {
  if (!navigator.onLine) return getCachedTasks();

  try {
    const res = await apiFetch('/tasks');
    if (!res.ok) throw new Error(`listTasks failed: ${res.status}`);
    const data = await res.json() as { tasks: Task[] };
    await cacheTasks(data.tasks);
    return data.tasks;
  } catch (err) {
    const cached = await getCachedTasks();
    if (cached.length > 0) return cached;
    throw err;
  }
}

// Live-syncs the signed-in user's tasks across devices: any create/update
// made through the REST API (here or elsewhere) writes to this same
// Firestore collection, so this listener picks it up almost immediately.
export function subscribeToTasks(
  onChange: (tasks: Task[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const tasksQuery = query(
    collection(db, 'users', user.uid, 'tasks'),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(
    tasksQuery,
    (snapshot) => {
      const tasks = snapshot.docs.map((doc) => doc.data() as Task);
      cacheTasks(tasks);
      onChange(tasks);
    },
    onError,
  );
}

export async function getTask(id: string): Promise<Task> {
  if (!navigator.onLine) {
    const cached = await getCachedTask(id);
    if (cached) return cached;
    throw new Error('getTask failed: offline and not cached');
  }

  try {
    const res = await apiFetch(`/tasks/${id}`);
    if (!res.ok) throw new Error(`getTask failed: ${res.status}`);
    const task = await res.json() as Task;
    await cacheTask(task);
    return task;
  } catch (err) {
    const cached = await getCachedTask(id);
    if (cached) return cached;
    throw err;
  }
}

export async function createTask(title: string, notes?: string, projectId?: string | null): Promise<Task> {
  const res = await apiFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, notes, projectId }),
  });
  if (!res.ok) throw new Error(`createTask failed: ${res.status}`);
  const task = await res.json() as Task;
  await cacheTask(task);
  return task;
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes' | 'projectId' | 'listId'>>,
): Promise<Task> {
  const res = await apiFetch(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`updateTask failed: ${res.status}`);
  const task = await res.json() as Task;
  await cacheTask(task);
  return task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteTask failed: ${res.status}`);
  await deleteCachedTask(id);
}

// Below: "queued" mutation wrappers. Each applies its change to the local
// cache immediately (so it survives a reload while offline) and hands the
// actual network call to syncWithRetry, which retries with backoff and
// persists the pending mutation to the outbox until it lands — see
// src/syncQueue.ts and src/outbox.ts (the latter re-drives these same
// mutations at startup for anything still pending from a prior session).

// Creates a task optimistically under a client-generated id so it can be
// cached and rendered immediately, then queues the real create. Once the
// real create lands, the temp record is dropped from the cache — the live
// Firestore listener (or the next offline refresh) supplies the real one.
// `initialUpdates` covers callers that create a task and immediately give it
// dates in the same gesture (e.g. dropping a new task on a calendar day):
// since the temp id doesn't exist server-side, that follow-up update can't
// be queued separately (it would 404 once replayed) — it's folded into the
// same outbox entry and applied to the real id right after create succeeds.
export function queueCreateTask(
  title: string,
  notes: string | null,
  projectId: string | null,
  onGiveUp: () => void,
  initialUpdates?: Partial<Pick<Task, 'dates' | 'status'>>,
): Task {
  const tempId = `temp-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const optimistic: Task = {
    id: tempId,
    title,
    status: initialUpdates?.status ?? 'todo',
    notes,
    dates: initialUpdates?.dates ?? [],
    estimatedMinutes: null,
    projectId,
    listId: null,
    source: null,
    createdAt: now,
    updatedAt: now,
  };
  cacheTask(optimistic).catch(() => {});
  syncWithRetry(
    { key: `task-create:${tempId}`, kind: 'createTask', payload: { tempId, title, notes, projectId, initialUpdates } },
    async () => {
      const real = await createTask(title, notes ?? undefined, projectId);
      if (initialUpdates) await updateTask(real.id, initialUpdates);
      await deleteCachedTask(tempId);
    },
    onGiveUp,
  );
  return optimistic;
}

export function queueUpdateTask(
  current: Task,
  updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes' | 'projectId' | 'listId'>>,
  onGiveUp: () => void,
): Task {
  const optimistic: Task = { ...current, ...updates };
  cacheTask(optimistic).catch(() => {});
  syncWithRetry(
    { key: `task:${current.id}`, kind: 'updateTask', payload: { id: current.id, updates } },
    () => updateTask(current.id, updates).then(() => {}),
    onGiveUp,
  );
  return optimistic;
}

export function queueDeleteTask(id: string, onGiveUp: () => void): void {
  deleteCachedTask(id).catch(() => {});
  syncWithRetry(
    { key: `task-delete:${id}`, kind: 'deleteTask', payload: { id } },
    () => deleteTask(id).then(() => {}),
    onGiveUp,
  );
}

export async function listProjects(): Promise<ProjectWithCount[]> {
  if (!navigator.onLine) return getCachedProjects<ProjectWithCount>();

  try {
    const res = await apiFetch('/projects');
    if (!res.ok) throw new Error(`listProjects failed: ${res.status}`);
    const data = await res.json() as { projects: ProjectWithCount[] };
    await cacheProjects(data.projects);
    return data.projects;
  } catch (err) {
    const cached = await getCachedProjects<ProjectWithCount>();
    if (cached.length > 0) return cached;
    throw err;
  }
}

// Live-syncs the signed-in user's projects across devices, same pattern as
// subscribeToTasks — REST writes land in this collection and this listener
// picks them up immediately.
export function subscribeToProjects(
  onChange: (projects: Project[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const projectsQuery = query(
    collection(db, 'users', user.uid, 'projects'),
    orderBy('name'),
  );

  return onSnapshot(
    projectsQuery,
    (snapshot) => onChange(snapshot.docs.map((doc) => doc.data() as Project)),
    onError,
  );
}

export async function createProject(name: string, color?: string | null): Promise<Project> {
  const res = await apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) throw new Error(`createProject failed: ${res.status}`);
  return res.json() as Promise<Project>;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'color'>>,
): Promise<Project> {
  const res = await apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`updateProject failed: ${res.status}`);
  return res.json() as Promise<Project>;
}

export type ProjectDeleteMode = 'unassign' | 'cascade';

export async function deleteProject(id: string, mode: ProjectDeleteMode): Promise<{ tasksAffected: number }> {
  const res = await apiFetch(`/projects/${id}?onDelete=${mode}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteProject failed: ${res.status}`);
  return res.json() as Promise<{ deleted: true; tasksAffected: number }>;
}

export interface PromptResponse {
  reply: string;
  taskIds?: string[];
  conversationId: string;
  askDuration?: boolean;
}

export async function sendPrompt(
  message: string,
  conversationId?: string,
): Promise<PromptResponse> {
  const res = await apiFetch('/tasks/prompt', {
    method: 'POST',
    body: JSON.stringify({ message, conversationId }),
  });
  if (!res.ok) throw new Error(`sendPrompt failed: ${res.status}`);
  return res.json() as Promise<PromptResponse>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  taskId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
}

export interface TaskChatResponse {
  conversationId: string;
  reply: string;
  notes?: string;
}

export async function listTaskConversations(taskId: string): Promise<ConversationSummary[]> {
  const res = await apiFetch(`/tasks/${taskId}/conversations`);
  if (!res.ok) throw new Error(`listTaskConversations failed: ${res.status}`);
  const data = await res.json() as { conversations: ConversationSummary[] };
  return data.conversations;
}

export async function getTaskConversation(taskId: string, conversationId: string): Promise<Conversation> {
  const res = await apiFetch(`/tasks/${taskId}/conversations/${conversationId}`);
  if (!res.ok) throw new Error(`getTaskConversation failed: ${res.status}`);
  return res.json() as Promise<Conversation>;
}

export async function sendTaskChatMessage(
  taskId: string,
  message: string,
  conversationId?: string,
  smart?: boolean,
): Promise<TaskChatResponse> {
  const res = await apiFetch(`/tasks/${taskId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, conversationId, smart }),
  });
  if (!res.ok) throw new Error(`sendTaskChatMessage failed: ${res.status}`);
  return res.json() as Promise<TaskChatResponse>;
}

export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];

export type DigestSkipReason =
  | 'not-configured'
  | 'disabled'
  | 'no-reminder-time'
  | 'already-sent-today'
  | 'outside-window'
  | 'no-tasks-planned';

export interface RunDigestResponse {
  sent: boolean;
  taskCount: number;
  reason?: DigestSkipReason;
}

// Manually triggers today's morning-digest check for the signed-in user,
// bypassing the scheduled function's time-window/dedupe logic. Used both
// as a "check now" feature and to test the notification pipeline without
// waiting for the cron schedule.
export async function runDigestNow(): Promise<RunDigestResponse> {
  const res = await apiFetch('/notifications/run-digest', { method: 'POST' });
  if (!res.ok) throw new Error(`runDigestNow failed: ${res.status}`);
  return res.json() as Promise<RunDigestResponse>;
}

export const CATEGORY_ORDER: ShoppingCategory[] = ['groceries', 'diy', 'electronics', 'other'];

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  groceries: 'Groceries',
  diy: 'DIY',
  electronics: 'Electronics',
  other: 'Other',
};

export async function getList(id: string): Promise<List> {
  if (!navigator.onLine) {
    const cached = (await getCachedLists<List>()).find((l) => l.id === id);
    if (cached) return cached;
    throw new Error('getList failed: offline and not cached');
  }

  try {
    const res = await apiFetch(`/lists/${id}`);
    if (!res.ok) throw new Error(`getList failed: ${res.status}`);
    const list = await res.json() as List;
    await cacheList(list);
    return list;
  } catch (err) {
    const cached = (await getCachedLists<List>()).find((l) => l.id === id);
    if (cached) return cached;
    throw err;
  }
}

export async function listLists(): Promise<ListWithItemCount[]> {
  if (!navigator.onLine) return getCachedLists<ListWithItemCount>();

  try {
    const res = await apiFetch('/lists');
    if (!res.ok) throw new Error(`listLists failed: ${res.status}`);
    const data = await res.json() as { lists: ListWithItemCount[] };
    await cacheLists(data.lists);
    return data.lists;
  } catch (err) {
    const cached = await getCachedLists<ListWithItemCount>();
    if (cached.length > 0) return cached;
    throw err;
  }
}

// Live-syncs the signed-in user's lists across devices, same pattern as
// subscribeToTasks/subscribeToProjects.
export function subscribeToLists(
  onChange: (lists: List[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const listsQuery = query(
    collection(db, 'users', user.uid, 'lists'),
    orderBy('name'),
  );

  return onSnapshot(
    listsQuery,
    (snapshot) => {
      const lists = snapshot.docs.map((doc) => doc.data() as List);
      cacheLists(lists);
      onChange(lists);
    },
    onError,
  );
}

export async function createList(name: string, type: ListType): Promise<List> {
  const res = await apiFetch('/lists', {
    method: 'POST',
    body: JSON.stringify({ name, type }),
  });
  if (!res.ok) throw new Error(`createList failed: ${res.status}`);
  const list = await res.json() as List;
  await cacheList(list);
  return list;
}

export async function renameList(id: string, name: string): Promise<List> {
  const res = await apiFetch(`/lists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`renameList failed: ${res.status}`);
  const list = await res.json() as List;
  await cacheList(list);
  return list;
}

export async function deleteList(id: string): Promise<{ tasksAffected: number }> {
  const res = await apiFetch(`/lists/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteList failed: ${res.status}`);
  await deleteCachedList(id);
  return res.json() as Promise<{ deleted: true; tasksAffected: number }>;
}

export async function listListItems(listId: string, pairedListId?: string | null): Promise<ListItem[]> {
  if (!navigator.onLine) {
    const cached = await getCachedListItems();
    const ids = [listId, pairedListId].filter((id): id is string => Boolean(id));
    return cached.filter((i) => ids.includes(i.listId));
  }

  try {
    const res = await apiFetch(`/lists/${listId}/items`);
    if (!res.ok) throw new Error(`listListItems failed: ${res.status}`);
    const data = await res.json() as { items: ListItem[] };
    for (const item of data.items) await cacheListItem(item);
    return data.items;
  } catch (err) {
    const cached = await getCachedListItems();
    const ids = [listId, pairedListId].filter((id): id is string => Boolean(id));
    const filtered = cached.filter((i) => ids.includes(i.listId));
    if (filtered.length > 0) return filtered;
    throw err;
  }
}

// Live-syncs a list's items (and, for a shopping/stock pair, both sides at
// once) across devices — REST writes land in this collection and this
// listener picks them up immediately.
export function subscribeToListItems(
  listId: string,
  pairedListId: string | null,
  onChange: (items: ListItem[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const listIds = pairedListId ? [listId, pairedListId] : [listId];
  const itemsQuery = query(
    collection(db, 'users', user.uid, 'listItems'),
    where('listId', 'in', listIds),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    itemsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((doc) => doc.data() as ListItem);
      cacheListItems(items);
      onChange(items);
    },
    onError,
  );
}

// Adds one or more AI-parsed items directly to a list.
export async function addListItems(listId: string, text: string): Promise<ListItem[]> {
  const res = await apiFetch(`/lists/${listId}/items`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`addListItems failed: ${res.status}`);
  const data = await res.json() as { items: ListItem[] };
  for (const item of data.items) await cacheListItem(item);
  return data.items;
}

export async function setListItemCategory(id: string, category: ShoppingCategory): Promise<ListItem> {
  const res = await apiFetch(`/list-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error(`setListItemCategory failed: ${res.status}`);
  const item = await res.json() as ListItem;
  await cacheListItem(item);
  return item;
}

export async function renameListItem(id: string, name: string): Promise<ListItem> {
  const res = await apiFetch(`/list-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`renameListItem failed: ${res.status}`);
  const item = await res.json() as ListItem;
  await cacheListItem(item);
  return item;
}

// Toggles a todo/checklist item's checked state (in place — no list move).
export async function checkListItem(id: string, checked: boolean): Promise<ListItem> {
  const res = await apiFetch(`/list-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ checked }),
  });
  if (!res.ok) throw new Error(`checkListItem failed: ${res.status}`);
  const item = await res.json() as ListItem;
  await cacheListItem(item);
  return item;
}

// Moves a shopping/stock item to its list's paired list (checking off a
// shopping item moves it to stock, and vice versa).
export async function moveListItem(id: string): Promise<ListItem> {
  const res = await apiFetch(`/list-items/${id}/move`, { method: 'POST' });
  if (!res.ok) throw new Error(`moveListItem failed: ${res.status}`);
  const item = await res.json() as ListItem;
  await cacheListItem(item);
  return item;
}

// Moves every item sharing a normalized name, within a list and its pair,
// into the given target list.
export async function moveListItemGroup(targetListId: string, normalizedName: string): Promise<void> {
  const res = await apiFetch(`/lists/${targetListId}/items/move-group`, {
    method: 'POST',
    body: JSON.stringify({ normalizedName }),
  });
  if (!res.ok) throw new Error(`moveListItemGroup failed: ${res.status}`);
  const cached = await getCachedListItems();
  for (const item of cached) {
    if (item.normalizedName === normalizedName) await cacheListItem({ ...item, listId: targetListId });
  }
}

export async function deleteListItem(id: string): Promise<void> {
  const res = await apiFetch(`/list-items/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteListItem failed: ${res.status}`);
  await deleteCachedListItem(id);
}

// Queued mutation wrappers — see the note above queueCreateTask. Each
// applies its change to the cache immediately and hands the network call to
// syncWithRetry so it survives bad/no signal and a reload while pending.

// Adds item(s) optimistically under client-generated ids, same temp-id
// pattern as queueCreateTask.
export function queueAddListItems(listId: string, text: string, onGiveUp: () => void): ListItem[] {
  const now = new Date().toISOString();
  const names = text.split(',').map((s) => s.trim()).filter(Boolean);
  const optimisticItems: ListItem[] = names.map((name) => ({
    id: `temp-${crypto.randomUUID()}`,
    listId,
    name,
    normalizedName: name.toLowerCase(),
    category: null,
    checked: false,
    checkedAt: null,
    archived: false,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }));
  for (const item of optimisticItems) cacheListItem(item).catch(() => {});
  const tempIds = optimisticItems.map((i) => i.id);
  syncWithRetry(
    { key: `list-add:${tempIds.join(',')}`, kind: 'addListItems', payload: { tempIds, listId, text } },
    async () => {
      await addListItems(listId, text);
      for (const tempId of tempIds) await deleteCachedListItem(tempId);
    },
    onGiveUp,
  );
  return optimisticItems;
}

export function queueRenameListItem(item: ListItem, name: string, onGiveUp: () => void): ListItem {
  const optimistic: ListItem = { ...item, name, normalizedName: name.toLowerCase() };
  cacheListItem(optimistic).catch(() => {});
  syncWithRetry(
    { key: `list-item-rename:${item.id}`, kind: 'renameListItem', payload: { id: item.id, name } },
    () => renameListItem(item.id, name).then(() => {}),
    onGiveUp,
  );
  return optimistic;
}

export function queueSetListItemCategory(item: ListItem, category: ShoppingCategory, onGiveUp: () => void): ListItem {
  const optimistic: ListItem = { ...item, category };
  cacheListItem(optimistic).catch(() => {});
  syncWithRetry(
    { key: `list-item-category:${item.id}`, kind: 'setListItemCategory', payload: { id: item.id, category } },
    () => setListItemCategory(item.id, category).then(() => {}),
    onGiveUp,
  );
  return optimistic;
}

export function queueCheckListItem(item: ListItem, checked: boolean, onGiveUp: () => void): void {
  cacheListItem({ ...item, checked }).catch(() => {});
  syncWithRetry(
    { key: `list-item-check:${item.id}`, kind: 'checkListItem', payload: { id: item.id, checked } },
    () => checkListItem(item.id, checked).then(() => {}),
    onGiveUp,
  );
}

export function queueMoveListItem(item: ListItem, targetListId: string, onGiveUp: () => void): void {
  cacheListItem({ ...item, listId: targetListId }).catch(() => {});
  syncWithRetry(
    { key: `list-item-move:${item.id}`, kind: 'moveListItem', payload: { id: item.id } },
    () => moveListItem(item.id).then(() => {}),
    onGiveUp,
  );
}

export function queueDeleteListItem(id: string, onGiveUp: () => void): void {
  deleteCachedListItem(id).catch(() => {});
  syncWithRetry(
    { key: `list-item-delete:${id}`, kind: 'deleteListItem', payload: { id } },
    () => deleteListItem(id).then(() => {}),
    onGiveUp,
  );
}
