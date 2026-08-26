import { useCallback, useEffect, useState } from 'react';
import type { ListItem } from './types';
import { listListItems, subscribeToListItems } from './api';
import { useOnlineStatus } from './useOnlineStatus';

// Mirrors useTasks.ts / useProjects.ts: a live Firestore subscription while
// online, falling back to the IndexedDB cache while offline. Pass
// pairedListId for a shopping list to get both sides of the pair in one
// subscription.
export function useListItems(listId: string, pairedListId: string | null) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const refresh = useCallback(async () => {
    try {
      setItems(await listListItems(listId, pairedListId));
      setError(null);
    } catch {
      setError('Could not load list items.');
    } finally {
      setIsLoading(false);
    }
  }, [listId, pairedListId]);

  useEffect(() => {
    if (!isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- offline fallback load
      refresh();
      return;
    }

    const unsubscribe = subscribeToListItems(
      listId,
      pairedListId,
      (liveItems) => {
        setItems(liveItems);
        setError(null);
        setIsLoading(false);
      },
      () => {
        setError('Could not load list items.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [isOnline, listId, pairedListId, refresh]);

  return { items, setItems, isLoading, error, setError, isOnline, refresh };
}
