import { useEffect, useState } from 'react';
import type { ListItem } from './types';

// Same pattern as useOptimisticListItemMove, but for todo/checklist items,
// which toggle a `checked` boolean in place rather than moving between
// lists.
export function useOptimisticListItemChecked(items: ListItem[]) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconciling local overrides against the live snapshot
    setOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        if (item.id in next && next[item.id] === item.checked) {
          delete next[item.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const displayItems = items.map((item) =>
    item.id in overrides ? { ...item, checked: overrides[item.id] } : item,
  );

  function setOverride(ids: string[], checked: boolean) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = checked;
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
