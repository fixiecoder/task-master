import type { Project, Task } from './types';

const DB_NAME = 'task-master';
const DB_VERSION = 2;
const TASKS_STORE = 'tasks';
const PROJECTS_STORE = 'projects';

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
