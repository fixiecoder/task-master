import { useCallback, useEffect, useState } from 'react';
import type { ListWithItemCount } from './types';
import { deleteList, listLists, renameList, subscribeToLists } from './api';
import { useOnlineStatus } from './useOnlineStatus';

// Mirrors useProjects.ts: a live Firestore subscription while online,
// falling back to the IndexedDB cache while offline.
export function useLists() {
  const [lists, setLists] = useState<ListWithItemCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const refresh = useCallback(async () => {
    try {
      setLists(await listLists());
      setError(null);
    } catch {
      setError('Could not load lists.');
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

    const unsubscribe = subscribeToLists(
      (liveLists) => {
        // The live Firestore listener doesn't carry an item count, so merge
        // it in from whatever we already know (0 for newly created lists).
        setLists((prev) => {
          const prevCounts = new Map(prev.map((l) => [l.id, l.itemCount]));
          return liveLists.map((l) => ({ ...l, itemCount: prevCounts.get(l.id) ?? 0 }));
        });
        setError(null);
        setIsLoading(false);
      },
      () => {
        setError('Could not load lists.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [isOnline, refresh]);

  async function saveList(id: string, name: string) {
    const updated = await renameList(id, name);
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
  }

  async function removeList(id: string) {
    await deleteList(id);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }

  return { lists, setLists, isLoading, error, setError, isOnline, refresh, saveList, removeList };
}
