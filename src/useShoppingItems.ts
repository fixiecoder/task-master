import { useCallback, useEffect, useState } from 'react';
import type { ShoppingItem } from './types';
import { listShoppingItems, subscribeToShoppingItems } from './api';
import { useOnlineStatus } from './useOnlineStatus';

// Mirrors useTasks.ts / useProjects.ts: a live Firestore subscription while
// online, falling back to the IndexedDB cache while offline. Going back
// online re-subscribes and the full snapshot replaces local state, which
// also cleans up any temp-id item created offline once the real one syncs.
export function useShoppingItems() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const refresh = useCallback(async () => {
    try {
      setItems(await listShoppingItems());
      setError(null);
    } catch {
      setError('Could not load shopping items.');
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

    const unsubscribe = subscribeToShoppingItems(
      (liveItems) => {
        setItems(liveItems);
        setError(null);
        setIsLoading(false);
      },
      () => {
        setError('Could not load shopping items.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [isOnline, refresh]);

  return { items, setItems, isLoading, error, setError, isOnline, refresh };
}
