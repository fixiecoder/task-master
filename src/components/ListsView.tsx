import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { List, ListType, ListWithItemCount } from '../types';
import { createList } from '../api';
import { useLists } from '../useLists';
import { useTasks } from '../useTasks';
import { ListModal } from './ListModal';
import { DeleteListModal } from './DeleteListModal';
import './ListsView.css';

const TYPE_LABELS: Record<ListType, string> = {
  shopping: 'Shopping',
  todo: 'To-do',
  checklist: 'Checklist',
  stock: 'Stock',
};

export function ListsView() {
  const { lists, setLists, isLoading, error, setError, isOnline, removeList } = useLists();
  const { tasks } = useTasks();
  const [isAdding, setIsAdding] = useState(false);
  const [deletingList, setDeletingList] = useState<ListWithItemCount | null>(null);

  const linkCounts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.listId) continue;
    linkCounts.set(task.listId, (linkCounts.get(task.listId) ?? 0) + 1);
  }

  const listsById = new Map(lists.map((l) => [l.id, l]));

  async function handleAdd(name: string, type: ListType) {
    try {
      const list = await createList(name, type);
      // The paired stock list (if any) is created server-side alongside the
      // shopping list — the live listener picks it up moments later.
      setLists((prev) => {
        if (prev.some((l) => l.id === list.id)) return prev;
        return [...prev, { ...list, itemCount: 0 }].sort((a, b) => a.name.localeCompare(b.name));
      });
      setIsAdding(false);
    } catch {
      setError('Could not create that list — try again.');
    }
  }

  function handleDeleteClick(list: ListWithItemCount) {
    setDeletingList(list);
  }

  async function handleConfirmDelete() {
    if (!deletingList) return;
    try {
      await removeList(deletingList.id);
      if (deletingList.pairedListId) {
        setLists((prev) => prev.filter((l) => l.id !== deletingList.pairedListId));
      }
      setDeletingList(null);
    } catch {
      setError('Could not delete that list — try again.');
    }
  }

  function pairedName(list: List): string | null {
    if (!list.pairedListId) return null;
    return listsById.get(list.pairedListId)?.name ?? null;
  }

  return (
    <div className="lists-page">
      {!isOnline && (
        <p className="board-offline">You're offline — showing saved lists.</p>
      )}
      {error && <p className="board-error">{error}</p>}

      <div className="lists-page-header">
        <h2>Lists</h2>
        <button type="button" className="lists-add-button" onClick={() => setIsAdding(true)} disabled={!isOnline}>
          + New list
        </button>
      </div>

      {isLoading ? (
        <p className="board-loading">Loading lists…</p>
      ) : lists.length === 0 ? (
        <p className="lists-page-empty">No lists yet — create one to get started.</p>
      ) : (
        <ul className="lists-list">
          {lists.map((list) => (
            <li key={list.id} className="lists-list-item">
              <Link to={`/lists/${list.id}`} className="lists-list-name">{list.name}</Link>
              <span className="lists-list-type">{TYPE_LABELS[list.type]}</span>
              {pairedName(list) && (
                <span className="lists-list-paired">↔ {pairedName(list)}</span>
              )}
              <span className="lists-list-count">{list.itemCount} items</span>
              <div className="lists-list-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => handleDeleteClick(list)}
                  disabled={!isOnline}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAdding && <ListModal onClose={() => setIsAdding(false)} onSave={handleAdd} />}

      {deletingList && (
        <DeleteListModal
          list={deletingList}
          taskCount={linkCounts.get(deletingList.id) ?? 0}
          onClose={() => setDeletingList(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
