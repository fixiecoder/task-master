import type { ShoppingCategory, Task } from './types';
import {
  createTask,
  updateTask,
  deleteTask,
  addListItems,
  deleteListItem,
  renameListItem,
  setListItemCategory,
  checkListItem,
  moveListItem,
} from './api';
import { deleteCachedListItem, deleteCachedTask } from './db';

// One entry per `kind` a queued mutation (see the queueX wrappers in
// api.ts) can be persisted as. Kept in sync with those wrappers' payloads —
// this is the replay side, invoked by replayOutbox (src/syncQueue.ts) for
// anything still pending in IndexedDB from a session that ended (reload,
// tab kill, app eviction) before the mutation reached the network.
export type OutboxMutation =
  | { kind: 'updateTask'; id: string; updates: Partial<Task> }
  | { kind: 'createTask'; tempId: string; title: string; notes: string | null; projectId: string | null; initialUpdates?: Partial<Pick<Task, 'dates' | 'status'>> }
  | { kind: 'deleteTask'; id: string }
  | { kind: 'addListItems'; tempIds: string[]; listId: string; text: string }
  | { kind: 'deleteListItem'; id: string }
  | { kind: 'renameListItem'; id: string; name: string }
  | { kind: 'setListItemCategory'; id: string; category: ShoppingCategory }
  | { kind: 'checkListItem'; id: string; checked: boolean }
  | { kind: 'moveListItem'; id: string };

export async function dispatchMutation(kind: string, payload: unknown): Promise<void> {
  const mutation = { kind, ...(payload as object) } as OutboxMutation;
  switch (mutation.kind) {
    case 'updateTask':
      await updateTask(mutation.id, mutation.updates);
      return;
    case 'createTask': {
      const real = await createTask(mutation.title, mutation.notes ?? undefined, mutation.projectId);
      if (mutation.initialUpdates) await updateTask(real.id, mutation.initialUpdates);
      await deleteCachedTask(mutation.tempId);
      return;
    }
    case 'deleteTask':
      await deleteTask(mutation.id);
      return;
    case 'addListItems':
      await addListItems(mutation.listId, mutation.text);
      for (const tempId of mutation.tempIds) await deleteCachedListItem(tempId);
      return;
    case 'deleteListItem':
      await deleteListItem(mutation.id);
      return;
    case 'renameListItem':
      await renameListItem(mutation.id, mutation.name);
      return;
    case 'setListItemCategory':
      await setListItemCategory(mutation.id, mutation.category);
      return;
    case 'checkListItem':
      await checkListItem(mutation.id, mutation.checked);
      return;
    case 'moveListItem':
      await moveListItem(mutation.id);
      return;
  }
}
