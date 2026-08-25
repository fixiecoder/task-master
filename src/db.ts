import type { Project, ShoppingItem, Task } from './types';

const DB_NAME = 'task-master';
const DB_VERSION = 3;
const TASKS_STORE = 'tasks';
const PROJECTS_STORE = 'projects';
const SHOPPING_STORE = 'shoppingItems';
const OUTBOX_STORE = 'outbox';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        db.createObjectStore(TASKS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SHOPPING_STORE)) {
        db.createObjectStore(SHOPPING_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheTasks(tasks: Task[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE, 'readwrite');
    const store = tx.objectStore(TASKS_STORE);
    store.clear();
    for (const task of tasks) store.put(task);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheTask(task: Task): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE, 'readwrite');
    tx.objectStore(TASKS_STORE).put(task);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedTasks(): Promise<Task[]> {
  const db = await openDB();
  const tasks = await new Promise<Task[]>((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE, 'readonly');
    const req = tx.objectStore(TASKS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as Task[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return tasks;
}

export async function deleteCachedTask(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE, 'readwrite');
    tx.objectStore(TASKS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedTask(id: string): Promise<Task | undefined> {
  const db = await openDB();
  const task = await new Promise<Task | undefined>((resolve, reject) => {
    const tx = db.transaction(TASKS_STORE, 'readonly');
    const req = tx.objectStore(TASKS_STORE).get(id);
    req.onsuccess = () => resolve(req.result as Task | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return task;
}

export async function cacheProjects<T extends Project>(projects: T[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = tx.objectStore(PROJECTS_STORE);
    store.clear();
    for (const project of projects) store.put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheProject<T extends Project>(project: T): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedProjects<T extends Project>(): Promise<T[]> {
  const db = await openDB();
  const projects = await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const req = tx.objectStore(PROJECTS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return projects;
}

export async function deleteCachedProject(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheShoppingItems(items: ShoppingItem[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SHOPPING_STORE, 'readwrite');
    const store = tx.objectStore(SHOPPING_STORE);
    store.clear();
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheShoppingItem(item: ShoppingItem): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SHOPPING_STORE, 'readwrite');
    tx.objectStore(SHOPPING_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedShoppingItems(): Promise<ShoppingItem[]> {
  const db = await openDB();
  const items = await new Promise<ShoppingItem[]>((resolve, reject) => {
    const tx = db.transaction(SHOPPING_STORE, 'readonly');
    const req = tx.objectStore(SHOPPING_STORE).getAll();
    req.onsuccess = () => resolve(req.result as ShoppingItem[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function deleteCachedShoppingItem(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SHOPPING_STORE, 'readwrite');
    tx.objectStore(SHOPPING_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export interface OutboxEntry {
  key: string;
  kind: string;
  payload: unknown;
  createdAt: number;
}

export async function putOutboxEntry(entry: OutboxEntry): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteOutboxEntry(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getOutboxEntries(): Promise<OutboxEntry[]> {
  const db = await openDB();
  const entries = await new Promise<OutboxEntry[]>((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const req = tx.objectStore(OUTBOX_STORE).getAll();
    req.onsuccess = () => resolve(req.result as OutboxEntry[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return entries;
}
