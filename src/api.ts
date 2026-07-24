import { getIdToken } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Task, TaskStatus } from './types';
import { cacheTask, cacheTasks, deleteCachedTask, getCachedTask, getCachedTasks } from './db';

const API_URL = import.meta.env.VITE_API_URL as string;

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
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
): Promise<TaskChatResponse> {
  const res = await apiFetch(`/tasks/${taskId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, conversationId }),
  });
  if (!res.ok) throw new Error(`sendTaskChatMessage failed: ${res.status}`);
  return res.json() as Promise<TaskChatResponse>;
}

export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];
