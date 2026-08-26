import { useState, type FormEvent } from 'react';
import type { List, ListItem, ShoppingCategory } from '../types';
import {
  queueAddListItems,
  queueCheckListItem,
  queueDeleteListItem,
  queueMoveListItem,
  queueRenameListItem,
  queueSetListItemCategory,
} from '../api';
import { useListItems } from '../useListItems';
import { useOptimisticListItemChecked } from '../useOptimisticListItemChecked';
import { useOptimisticListItemMove } from '../useOptimisticListItemMove';
import { usePersistedState } from '../usePersistedState';
import { ListItemRow } from './ListItemRow';
import { EditListItemNameModal } from './EditListItemNameModal';
import { EditListItemCategoryModal } from './EditListItemCategoryModal';
import './ListItemsPanel.css';

const SECTION_LABELS: Record<'shopping' | 'stock', string> = {
  shopping: 'Shopping list',
  stock: 'Stock',
};

interface ListItemsPanelProps {
  list: List;
}

export function ListItemsPanel({ list }: ListItemsPanelProps) {
  const { items: allItems, error: loadError, setItems: setAllItems } = useListItems(list.id, list.pairedListId);
  const [error, setError] = useState<string | null>(null);
  const [ownText, setOwnText] = usePersistedState(`task-master:list-add-draft:${list.id}`, '');
  const [pairedText, setPairedText] = usePersistedState(`task-master:list-add-draft:${list.pairedListId ?? 'none'}`, '');
  const [editingNameItem, setEditingNameItem] = useState<ListItem | null>(null);
  const [editingCategoryItem, setEditingCategoryItem] = useState<ListItem | null>(null);

  const hasPair = Boolean(list.pairedListId);

  const moveOptimistic = useOptimisticListItemMove(allItems);
  const checkedOptimistic = useOptimisticListItemChecked(allItems);
  const displayItems = hasPair ? moveOptimistic.displayItems : checkedOptimistic.displayItems;

  const ownItems = displayItems.filter((item) => item.listId === list.id);
  const pairedItems = list.pairedListId ? displayItems.filter((item) => item.listId === list.pairedListId) : [];

  const ownLabel = list.type === 'shopping' || list.type === 'stock' ? SECTION_LABELS[list.type] : null;
  const pairedType = list.type === 'shopping' ? 'stock' : list.type === 'stock' ? 'shopping' : null;

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    const text = ownText.trim();
    if (!text) return;

    const created = queueAddListItems(list.id, text, () => {
      setError("Couldn't add that — try again.");
    });
    setAllItems((prev) => [...created, ...prev]);
    setOwnText('');
  }

  function handleAddPairedSubmit(e: FormEvent) {
    e.preventDefault();
    if (!list.pairedListId) return;
    const text = pairedText.trim();
    if (!text) return;

    const created = queueAddListItems(list.pairedListId, text, () => {
      setError("Couldn't add that — try again.");
    });
    setAllItems((prev) => [...created, ...prev]);
    setPairedText('');
  }

  function handleMove(item: ListItem) {
    if (!list.pairedListId) return;
    const targetListId = item.listId === list.id ? list.pairedListId : list.id;
    moveOptimistic.setOverride([item.id], targetListId);
    queueMoveListItem(item, targetListId, () => {
      moveOptimistic.clearOverride([item.id]);
      setError("Couldn't move that item — try again.");
    });
  }

  function handleCheck(item: ListItem) {
    const next = !item.checked;
    checkedOptimistic.setOverride([item.id], next);
    queueCheckListItem(item, next, () => {
      checkedOptimistic.clearOverride([item.id]);
      setError("Couldn't update that item — try again.");
    });
  }

  function handleSetCategory(item: ListItem, category: ShoppingCategory) {
    const updated = queueSetListItemCategory(item, category, () => {
      setError("Couldn't set that category — try again.");
    });
    setAllItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingCategoryItem(null);
  }

  function handleRename(item: ListItem, name: string) {
    const updated = queueRenameListItem(item, name, () => {
      setError("Couldn't rename that item — try again.");
    });
    setAllItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingNameItem(null);
  }

  function handleDelete(item: ListItem) {
    queueDeleteListItem(item.id, () => {
      setError("Couldn't delete that item — try again.");
    });
    setAllItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const showCategory = list.type === 'shopping' || list.type === 'stock';

  return (
    <>
      <div className="list-items-section">
        {ownLabel && (
          <div className="list-items-header">
            <span>{ownLabel}</span>
          </div>
        )}

        {(error || loadError) && <p className="list-items-error">{error ?? loadError}</p>}

        {ownItems.length === 0 ? (
          <p className="list-items-empty">No items yet.</p>
        ) : (
          <ul className="list-item-list">
            {ownItems.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                checked={hasPair ? false : item.checked}
                showCheckbox
                showCategory={showCategory}
                onToggle={hasPair ? handleMove : handleCheck}
                onEditName={setEditingNameItem}
                onEditCategory={setEditingCategoryItem}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}

        <form className="shopping-add-form" onSubmit={handleAddSubmit}>
          <input
            type="text"
            value={ownText}
            onChange={(e) => setOwnText(e.target.value)}
            placeholder="Add item(s)…"
          />
          <button type="submit" disabled={!ownText.trim()}>
            Add
          </button>
        </form>
      </div>

      {hasPair && (
        <div className="list-items-section stock-section">
          {pairedType && (
            <div className="list-items-header">
              <span>{SECTION_LABELS[pairedType]}</span>
            </div>
          )}
          {list.type === 'shopping' && (
            <p className="stock-hint">Items already available — checking off a shopping item moves it here.</p>
          )}

          {pairedItems.length > 0 && (
            <ul className="list-item-list">
              {pairedItems.map((item) => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  checked={false}
                  showCheckbox={false}
                  showCategory={showCategory}
                  onToggle={handleMove}
                  onEditName={setEditingNameItem}
                  onEditCategory={setEditingCategoryItem}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}

          <form className="shopping-add-form" onSubmit={handleAddPairedSubmit}>
            <input
              type="text"
              value={pairedText}
              onChange={(e) => setPairedText(e.target.value)}
              placeholder={list.type === 'shopping' ? 'Add item(s) you already have…' : 'Add item(s) you need to buy…'}
            />
            <button type="submit" disabled={!pairedText.trim()}>
              Add
            </button>
          </form>
        </div>
      )}

      {editingNameItem && (
        <EditListItemNameModal
          item={editingNameItem}
          onClose={() => setEditingNameItem(null)}
          onSave={(name) => handleRename(editingNameItem, name)}
        />
      )}

      {editingCategoryItem && (
        <EditListItemCategoryModal
          item={editingCategoryItem}
          onClose={() => setEditingCategoryItem(null)}
          onSelect={(category) => handleSetCategory(editingCategoryItem, category)}
        />
      )}
    </>
  );
}
