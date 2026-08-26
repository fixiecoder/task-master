import type { List, ListItem, Project, Task } from './types';

const DB_NAME = 'task-master';
const DB_VERSION = 4;
const TASKS_STORE = 'tasks';
const PROJECTS_STORE = 'projects';
const LISTS_STORE = 'lists';
const LIST_ITEMS_STORE = 'listItems';
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
      if (db.objectStoreNames.contains('shoppingItems')) {
        db.deleteObjectStore('shoppingItems');
      }
      if (!db.objectStoreNames.contains(LISTS_STORE)) {
        db.createObjectStore(LISTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LIST_ITEMS_STORE)) {
        db.createObjectStore(LIST_ITEMS_STORE, { keyPath: 'id' });
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

export async function cacheLists<T extends List>(lists: T[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LISTS_STORE, 'readwrite');
    const store = tx.objectStore(LISTS_STORE);
    store.clear();
    for (const list of lists) store.put(list);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheList<T extends List>(list: T): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LISTS_STORE, 'readwrite');
    tx.objectStore(LISTS_STORE).put(list);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedLists<T extends List>(): Promise<T[]> {
  const db = await openDB();
  const lists = await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(LISTS_STORE, 'readonly');
    const req = tx.objectStore(LISTS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return lists;
}

export async function deleteCachedList(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LISTS_STORE, 'readwrite');
    tx.objectStore(LISTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheListItems(items: ListItem[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LIST_ITEMS_STORE, 'readwrite');
    const store = tx.objectStore(LIST_ITEMS_STORE);
    store.clear();
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cacheListItem(item: ListItem): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LIST_ITEMS_STORE, 'readwrite');
    tx.objectStore(LIST_ITEMS_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedListItems(): Promise<ListItem[]> {
  const db = await openDB();
  const items = await new Promise<ListItem[]>((resolve, reject) => {
    const tx = db.transaction(LIST_ITEMS_STORE, 'readonly');
    const req = tx.objectStore(LIST_ITEMS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as ListItem[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function deleteCachedListItem(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LIST_ITEMS_STORE, 'readwrite');
    tx.objectStore(LIST_ITEMS_STORE).delete(id);
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
