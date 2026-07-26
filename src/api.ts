import { getIdToken } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { ShoppingCategory, ShoppingItem, Task, TaskStatus } from './types';
import { cacheTask, cacheTasks, deleteCachedTask, getCachedTask, getCachedTasks } from './db';

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

export async function createTask(title: string, notes?: string): Promise<Task> {
  const res = await apiFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, notes }),
  });
  if (!res.ok) throw new Error(`createTask failed: ${res.status}`);
  const task = await res.json() as Task;
  await cacheTask(task);
  return task;
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes'>>,
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

export interface RunDigestResponse {
  sent: boolean;
  taskCount: number;
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
  const path = taskId ? `/shopping-items?taskId=${encodeURIComponent(taskId)}` : '/shopping-items';
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`listShoppingItems failed: ${res.status}`);
  const data = await res.json() as { items: ShoppingItem[] };
  return data.items;
}

// Live-syncs the signed-in user's shopping items, same pattern as
// subscribeToTasks: REST writes land in this collection and this listener
// picks them up immediately, across the aggregate Shopping view and any
// open task's list.
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
    (snapshot) => onChange(snapshot.docs.map((doc) => doc.data() as ShoppingItem)),
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
  return data.items;
}

export async function setShoppingItemCategory(id: string, category: ShoppingCategory): Promise<ShoppingItem> {
  const res = await apiFetch(`/shopping-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error(`setShoppingItemCategory failed: ${res.status}`);
  return res.json() as Promise<ShoppingItem>;
}

export async function toggleShoppingItemPurchased(id: string, purchased: boolean): Promise<ShoppingItem> {
  const res = await apiFetch(`/shopping-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ purchased }),
  });
  if (!res.ok) throw new Error(`toggleShoppingItemPurchased failed: ${res.status}`);
  return res.json() as Promise<ShoppingItem>;
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
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const res = await apiFetch(`/shopping-items/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteShoppingItem failed: ${res.status}`);
}
