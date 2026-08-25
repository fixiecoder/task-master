import type { ShoppingCategory, Task } from './types';
import {
  createTask,
  updateTask,
  deleteTask,
  toggleShoppingItemPurchased,
  togglePurchaseGroup,
  addShoppingItems,
  deleteShoppingItem,
  renameShoppingItem,
  setShoppingItemCategory,
} from './api';
import { deleteCachedShoppingItem, deleteCachedTask } from './db';

// One entry per `kind` a queued mutation (see the queueX wrappers in
// api.ts) can be persisted as. Kept in sync with those wrappers' payloads —
// this is the replay side, invoked by replayOutbox (src/syncQueue.ts) for
// anything still pending in IndexedDB from a session that ended (reload,
// tab kill, app eviction) before the mutation reached the network.
export type OutboxMutation =
  | { kind: 'updateTask'; id: string; updates: Partial<Task> }
  | { kind: 'createTask'; tempId: string; title: string; notes: string | null; projectId: string | null; initialUpdates?: Partial<Pick<Task, 'dates' | 'status'>> }
  | { kind: 'deleteTask'; id: string }
  | { kind: 'toggleShoppingItem'; id: string; purchased: boolean }
  | { kind: 'togglePurchaseGroup'; normalizedName: string; purchased: boolean }
  | { kind: 'addShoppingItems'; tempIds: string[]; taskId: string; text: string; purchased: boolean }
  | { kind: 'deleteShoppingItem'; id: string }
  | { kind: 'renameShoppingItem'; id: string; name: string }
  | { kind: 'setShoppingItemCategory'; id: string; category: ShoppingCategory };

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
    case 'toggleShoppingItem':
      await toggleShoppingItemPurchased(mutation.id, mutation.purchased);
      return;
    case 'togglePurchaseGroup':
      await togglePurchaseGroup(mutation.normalizedName, mutation.purchased);
      return;
    case 'addShoppingItems':
      await addShoppingItems(mutation.taskId, mutation.text, mutation.purchased);
      for (const tempId of mutation.tempIds) await deleteCachedShoppingItem(tempId);
      return;
    case 'deleteShoppingItem':
      await deleteShoppingItem(mutation.id);
      return;
    case 'renameShoppingItem':
      await renameShoppingItem(mutation.id, mutation.name);
      return;
    case 'setShoppingItemCategory':
      await setShoppingItemCategory(mutation.id, mutation.category);
      return;
  }
}
