import { useCallback, useEffect, useState } from 'react';
import type { Task } from './types';
import { deleteTask, listTasks, subscribeToTasks, updateTask } from './api';
import { useOnlineStatus } from './useOnlineStatus';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  // Manual fallback used for offline reads (served from the local cache)
  // and to recover from a failed drag-and-drop move.
  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
      setError(null);
    } catch {
      setError('Could not load tasks.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- offline fallback load
      refresh();
      return;
    }

    const unsubscribe = subscribeToTasks(
      (liveTasks) => {
        setTasks(liveTasks);
        setError(null);
        setIsLoading(false);
      },
      () => {
        setError('Could not load tasks.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [isOnline, refresh]);

  async function saveTask(id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes' | 'projectId'>>) {
    const updated = await updateTask(id, updates);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function removeTask(id: string) {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return { tasks, setTasks, isLoading, error, setError, isOnline, refresh, saveTask, removeTask };
}
