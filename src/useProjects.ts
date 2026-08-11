import { useCallback, useEffect, useState } from 'react';
import type { Project, ProjectWithCount } from './types';
import { deleteProject, listProjects, subscribeToProjects, updateProject, type ProjectDeleteMode } from './api';
import { useOnlineStatus } from './useOnlineStatus';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  // Manual fallback used for offline reads (served from the local cache).
  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
      setError(null);
    } catch {
      setError('Could not load projects.');
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

    const unsubscribe = subscribeToProjects(
      (liveProjects) => {
        // The live Firestore listener doesn't carry a task count, so merge
        // it in from whatever we already know (0 for newly created projects).
        setProjects((prev) => {
          const prevCounts = new Map(prev.map((p) => [p.id, p.taskCount]));
          return liveProjects.map((p) => ({ ...p, taskCount: prevCounts.get(p.id) ?? 0 }));
        });
        setError(null);
        setIsLoading(false);
      },
      () => {
        setError('Could not load projects.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [isOnline, refresh]);

  async function saveProject(id: string, updates: Partial<Pick<Project, 'name' | 'color'>>) {
    const updated = await updateProject(id, updates);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
  }

  async function removeProject(id: string, mode: ProjectDeleteMode) {
    await deleteProject(id, mode);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return { projects, setProjects, isLoading, error, setError, isOnline, refresh, saveProject, removeProject };
}
