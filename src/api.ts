import { getIdToken } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Project, ProjectWithCount, ShoppingCategory, ShoppingItem, Task, TaskStatus } from './types';
import {
  cacheTask,
  cacheTasks,
  deleteCachedTask,
  getCachedTask,
  getCachedTasks,
  cacheProjects,
  getCachedProjects,
  cacheShoppingItem,
  cacheShoppingItems,
  getCachedShoppingItems,
  deleteCachedShoppingItem,
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
  updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes' | 'projectId'>>,
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
  updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes' | 'projectId'>>,
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

export async function listShoppingItems(taskId?: string): Promise<ShoppingItem[]> {
  if (!navigator.onLine) {
    const cached = await getCachedShoppingItems();
    return taskId ? cached.filter((i) => i.taskId === taskId) : cached;
  }

  try {
    const path = taskId ? `/shopping-items?taskId=${encodeURIComponent(taskId)}` : '/shopping-items';
    const res = await apiFetch(path);
    if (!res.ok) throw new Error(`listShoppingItems failed: ${res.status}`);
    const data = await res.json() as { items: ShoppingItem[] };
    if (!taskId) await cacheShoppingItems(data.items);
    return data.items;
  } catch (err) {
    const cached = await getCachedShoppingItems();
    const filtered = taskId ? cached.filter((i) => i.taskId === taskId) : cached;
    if (filtered.length > 0) return filtered;
    throw err;
  }
}

// Live-syncs the signed-in user's shopping items, same pattern as
// subscribeToTasks: REST writes land in this collection and this listener
// picks them up immediately, across the aggregate Shopping view and any
// open task's list. Every snapshot is also written through to the local
// cache so the list survives a reload while offline.
export function subscribeToShoppingItems(
  onChange: (items: ShoppingItem[]) => void,
  onError: (err: unknown) => void,
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const itemsQuery = query(
    collection(db, 'users', user.uid, 'shoppingItems'),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    itemsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((doc) => doc.data() as ShoppingItem);
      cacheShoppingItems(items);
      onChange(items);
    },
    onError,
  );
}

// Adds one or more AI-parsed items to a task's shopping list. Pass
// purchased: true to add straight to Materials instead (already-owned
// items, skipping the "need to buy" list).
export async function addShoppingItems(taskId: string, text: string, purchased = false): Promise<ShoppingItem[]> {
  const res = await apiFetch('/shopping-items', {
    method: 'POST',
    body: JSON.stringify({ taskId, text, purchased }),
  });
  if (!res.ok) throw new Error(`addShoppingItems failed: ${res.status}`);
  const data = await res.json() as { items: ShoppingItem[] };
  for (const item of data.items) await cacheShoppingItem(item);
  return data.items;
}

export async function setShoppingItemCategory(id: string, category: ShoppingCategory): Promise<ShoppingItem> {
  const res = await apiFetch(`/shopping-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error(`setShoppingItemCategory failed: ${res.status}`);
  const item = await res.json() as ShoppingItem;
  await cacheShoppingItem(item);
  return item;
}

export async function renameShoppingItem(id: string, name: string): Promise<ShoppingItem> {
  const res = await apiFetch(`/shopping-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`renameShoppingItem failed: ${res.status}`);
  const item = await res.json() as ShoppingItem;
  await cacheShoppingItem(item);
  return item;
}

export async function toggleShoppingItemPurchased(id: string, purchased: boolean): Promise<ShoppingItem> {
  const res = await apiFetch(`/shopping-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ purchased }),
  });
  if (!res.ok) throw new Error(`toggleShoppingItemPurchased failed: ${res.status}`);
  const item = await res.json() as ShoppingItem;
  await cacheShoppingItem(item);
  return item;
}

// Marks every item sharing a normalized name as purchased/unpurchased, so
// checking off a duplicate in the aggregate Shopping view reflects across
// every task's list that references it.
export async function togglePurchaseGroup(normalizedName: string, purchased: boolean): Promise<void> {
  const res = await apiFetch('/shopping-items/purchase-group', {
    method: 'POST',
    body: JSON.stringify({ normalizedName, purchased }),
  });
  if (!res.ok) throw new Error(`togglePurchaseGroup failed: ${res.status}`);
  const cached = await getCachedShoppingItems();
  for (const item of cached) {
    if (item.normalizedName === normalizedName) await cacheShoppingItem({ ...item, purchased });
  }
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const res = await apiFetch(`/shopping-items/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteShoppingItem failed: ${res.status}`);
  await deleteCachedShoppingItem(id);
}

// Queued mutation wrappers — see the note above queueCreateTask. Each
// applies its change to the cache immediately and hands the network call to
// syncWithRetry so it survives bad/no signal and a reload while pending.

export function queueToggleShoppingItemPurchased(item: ShoppingItem, purchased: boolean, onGiveUp: () => void): void {
  cacheShoppingItem({ ...item, purchased }).catch(() => {});
  syncWithRetry(
    { key: `shopping-item:${item.id}`, kind: 'toggleShoppingItem', payload: { id: item.id, purchased } },
    () => toggleShoppingItemPurchased(item.id, purchased).then(() => {}),
    onGiveUp,
  );
}

export function queueTogglePurchaseGroup(normalizedName: string, itemIds: string[], purchased: boolean, onGiveUp: () => void): void {
  getCachedShoppingItems().then((cached) => {
    for (const item of cached) {
      if (itemIds.includes(item.id)) cacheShoppingItem({ ...item, purchased });
    }
  }).catch(() => {});
  syncWithRetry(
    { key: `shopping-group:${normalizedName}`, kind: 'togglePurchaseGroup', payload: { normalizedName, purchased } },
    () => togglePurchaseGroup(normalizedName, purchased),
    onGiveUp,
  );
}

// Adds item(s) optimistically under client-generated ids, same temp-id
// pattern as queueCreateTask.
export function queueAddShoppingItems(taskId: string, taskTitle: string, text: string, purchased: boolean, onGiveUp: () => void): ShoppingItem[] {
  const now = new Date().toISOString();
  const names = text.split(',').map((s) => s.trim()).filter(Boolean);
  const optimisticItems: ShoppingItem[] = names.map((name) => ({
    id: `temp-${crypto.randomUUID()}`,
    taskId,
    taskTitle,
    name,
    normalizedName: name.toLowerCase(),
    category: null,
    purchased,
    purchasedAt: purchased ? now : null,
    archived: false,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }));
  for (const item of optimisticItems) cacheShoppingItem(item).catch(() => {});
  const tempIds = optimisticItems.map((i) => i.id);
  syncWithRetry(
    { key: `shopping-add:${tempIds.join(',')}`, kind: 'addShoppingItems', payload: { tempIds, taskId, text, purchased } },
    async () => {
      await addShoppingItems(taskId, text, purchased);
      for (const tempId of tempIds) await deleteCachedShoppingItem(tempId);
    },
    onGiveUp,
  );
  return optimisticItems;
}

export function queueRenameShoppingItem(item: ShoppingItem, name: string, onGiveUp: () => void): ShoppingItem {
  const optimistic: ShoppingItem = { ...item, name, normalizedName: name.toLowerCase() };
  cacheShoppingItem(optimistic).catch(() => {});
  syncWithRetry(
    { key: `shopping-rename:${item.id}`, kind: 'renameShoppingItem', payload: { id: item.id, name } },
    () => renameShoppingItem(item.id, name).then(() => {}),
    onGiveUp,
  );
  return optimistic;
}

export function queueSetShoppingItemCategory(item: ShoppingItem, category: ShoppingCategory, onGiveUp: () => void): ShoppingItem {
  const optimistic: ShoppingItem = { ...item, category };
  cacheShoppingItem(optimistic).catch(() => {});
  syncWithRetry(
    { key: `shopping-category:${item.id}`, kind: 'setShoppingItemCategory', payload: { id: item.id, category } },
    () => setShoppingItemCategory(item.id, category).then(() => {}),
    onGiveUp,
  );
  return optimistic;
}

export function queueDeleteShoppingItem(id: string, onGiveUp: () => void): void {
  deleteCachedShoppingItem(id).catch(() => {});
  syncWithRetry(
    { key: `shopping-delete:${id}`, kind: 'deleteShoppingItem', payload: { id } },
    () => deleteShoppingItem(id).then(() => {}),
    onGiveUp,
  );
}
