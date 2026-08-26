import { useEffect, useState } from 'react';
import type { ListItem } from './types';

// Firestore's onSnapshot listener is the source of truth for `items`, but it
// only reflects a move once the backend has processed it — which can lag
// well behind the tap on a bad connection. This overlays a locally-applied
// `listId` value on top of the live data so a shopping<->stock move updates
// the UI immediately, and drops the override for an item once the listener
// confirms it caught up.
export function useOptimisticListItemMove(items: ListItem[]) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconciling local overrides against the live snapshot
    setOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        if (item.id in next && next[item.id] === item.listId) {
          delete next[item.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const displayItems = items.map((item) =>
    item.id in overrides ? { ...item, listId: overrides[item.id] } : item,
  );

  function setOverride(ids: string[], listId: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = listId;
      return next;
    });
  }

  function clearOverride(ids: string[]) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  return { displayItems, setOverride, clearOverride };
}
