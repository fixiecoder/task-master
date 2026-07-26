import { useEffect, useState } from 'react';
import type { ShoppingItem } from './types';

// Firestore's onSnapshot listener is the source of truth for `items`, but it
// only reflects a toggle once the backend has processed it — which can lag
// well behind the tap on a bad connection. This overlays a locally-applied
// `purchased` value on top of the live data so the UI updates immediately,
// and drops the override for an item once the listener confirms it caught up.
export function useOptimisticShoppingItems(items: ShoppingItem[]) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconciling local overrides against the live snapshot
    setOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        if (item.id in next && next[item.id] === item.purchased) {
          delete next[item.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const displayItems = items.map((item) =>
    item.id in overrides ? { ...item, purchased: overrides[item.id] } : item,
  );

  function setOverride(ids: string[], purchased: boolean) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = purchased;
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
