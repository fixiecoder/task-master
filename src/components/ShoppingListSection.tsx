import { useState, type FormEvent } from 'react';
import type { ShoppingCategory, ShoppingItem } from '../types';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  queueAddShoppingItems,
  queueDeleteShoppingItem,
  queueRenameShoppingItem,
  queueSetShoppingItemCategory,
  queueToggleShoppingItemPurchased,
} from '../api';
import { useOptimisticShoppingItems } from '../useOptimisticShoppingItems';
import { useShoppingItems } from '../useShoppingItems';
import { usePersistedState } from '../usePersistedState';
import './ShoppingListSection.css';

interface ShoppingListSectionProps {
  taskId: string;
  taskTitle: string;
}

interface ItemRowProps {
  item: ShoppingItem;
  showCheckbox: boolean;
  onTogglePurchased: (item: ShoppingItem) => void;
  onEditName: (item: ShoppingItem) => void;
  onEditCategory: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
}

function ItemRow({ item, showCheckbox, onTogglePurchased, onEditName, onEditCategory, onDelete }: ItemRowProps) {
  return (
    <li className={`shopping-item ${item.purchased && showCheckbox ? 'purchased' : ''}`}>
      {showCheckbox && (
        <input
          type="checkbox"
          className="shopping-checkbox"
          checked={item.purchased}
          onChange={() => onTogglePurchased(item)}
          aria-label={`Mark ${item.name} as purchased`}
        />
      )}
      <button
        type="button"
        className="shopping-item-name shopping-item-name-button"
        onClick={() => onEditName(item)}
      >
        {item.name}
      </button>
      <button
        type="button"
        className={`shopping-category-pill shopping-category-pill-button ${item.category ? `shopping-category-${item.category}` : 'shopping-category-unset'}`}
        onClick={() => onEditCategory(item)}
      >
        {item.category ? CATEGORY_LABELS[item.category] : 'Category'}
      </button>
      <button
        type="button"
        className="shopping-item-remove"
        onClick={() => onDelete(item)}
        aria-label={`Remove ${item.name}`}
      >
        ×
      </button>
    </li>
  );
}

interface EditNameModalProps {
  item: ShoppingItem;
  onClose: () => void;
  onSave: (name: string) => void;
}

function EditNameModal({ item, onClose, onSave }: EditNameModalProps) {
  const [name, setName] = useState(item.name);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <div className="shopping-item-modal-backdrop" onClick={onClose}>
      <form className="shopping-item-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header className="shopping-item-modal-header">
          <h3>Edit item</h3>
          <button type="button" className="shopping-item-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <input
          type="text"
          className="shopping-item-modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="shopping-item-modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </div>
  );
}

interface EditCategoryModalProps {
  item: ShoppingItem;
  onClose: () => void;
  onSelect: (category: ShoppingCategory) => void;
}

function EditCategoryModal({ item, onClose, onSelect }: EditCategoryModalProps) {
  return (
    <div className="shopping-item-modal-backdrop" onClick={onClose}>
      <div className="shopping-item-modal" onClick={(e) => e.stopPropagation()}>
        <header className="shopping-item-modal-header">
          <h3>Set category</h3>
          <button type="button" className="shopping-item-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="shopping-category-modal-options">
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              className={`shopping-category-modal-option ${item.category === category ? 'active' : ''}`}
              onClick={() => onSelect(category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShoppingListSection({ taskId, taskTitle }: ShoppingListSectionProps) {
  const { items: allItems, error: loadError, setItems: setAllItems } = useShoppingItems();
  const items = allItems.filter((item) => item.taskId === taskId);
  const [error, setError] = useState<string | null>(null);
  const [addText, setAddText] = usePersistedState(`task-master:shopping-add-draft:${taskId}`, '');
  const [materialText, setMaterialText] = usePersistedState(`task-master:shopping-material-draft:${taskId}`, '');
  const [editingNameItem, setEditingNameItem] = useState<ShoppingItem | null>(null);
  const [editingCategoryItem, setEditingCategoryItem] = useState<ShoppingItem | null>(null);

  const { displayItems, setOverride, clearOverride } = useOptimisticShoppingItems(items);
  const shoppingListItems = displayItems.filter((item) => !item.purchased);
  const materials = displayItems.filter((item) => item.purchased);

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    const text = addText.trim();
    if (!text) return;

    const created = queueAddShoppingItems(taskId, taskTitle, text, false, () => {
      setError("Couldn't add that — try again.");
    });
    setAllItems((prev) => [...created, ...prev]);
    setAddText('');
  }

  function handleAddMaterialSubmit(e: FormEvent) {
    e.preventDefault();
    const text = materialText.trim();
    if (!text) return;

    const created = queueAddShoppingItems(taskId, taskTitle, text, true, () => {
      setError("Couldn't add that — try again.");
    });
    setAllItems((prev) => [...created, ...prev]);
    setMaterialText('');
  }

  function handleTogglePurchased(item: ShoppingItem) {
    const next = !item.purchased;
    setOverride([item.id], next);
    queueToggleShoppingItemPurchased(item, next, () => {
      clearOverride([item.id]);
      setError("Couldn't update that item — try again.");
    });
  }

  function handleSetCategory(item: ShoppingItem, category: ShoppingCategory) {
    const updated = queueSetShoppingItemCategory(item, category, () => {
      setError("Couldn't set that category — try again.");
    });
    setAllItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingCategoryItem(null);
  }

  function handleRename(item: ShoppingItem, name: string) {
    const updated = queueRenameShoppingItem(item, name, () => {
      setError("Couldn't rename that item — try again.");
    });
    setAllItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingNameItem(null);
  }

  function handleDelete(item: ShoppingItem) {
    queueDeleteShoppingItem(item.id, () => {
      setError("Couldn't delete that item — try again.");
    });
    setAllItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  return (
    <>
      <div className="shopping-list-section">
        <div className="shopping-list-header">
          <span>Shopping list</span>
        </div>

        {(error || loadError) && <p className="shopping-list-error">{error ?? loadError}</p>}

        {shoppingListItems.length === 0 ? (
          <p className="shopping-list-empty">No items yet.</p>
        ) : (
          <ul className="shopping-item-list">
            {shoppingListItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                showCheckbox
                onTogglePurchased={handleTogglePurchased}
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
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            placeholder="Add item(s)… e.g. milk, batteries, a screwdriver"
          />
          <button type="submit" disabled={!addText.trim()}>
            Add
          </button>
        </form>
      </div>

      {materials.length > 0 && (
        <div className="shopping-list-section materials-section">
          <div className="shopping-list-header">
            <span>Materials</span>
          </div>
          <p className="materials-hint">Items already available for this task — checking off a shopping item moves it here.</p>

          <ul className="shopping-item-list">
            {materials.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                showCheckbox={false}
                onTogglePurchased={handleTogglePurchased}
                onEditName={setEditingNameItem}
                onEditCategory={setEditingCategoryItem}
                onDelete={handleDelete}
              />
            ))}
          </ul>

          <form className="shopping-add-form" onSubmit={handleAddMaterialSubmit}>
            <input
              type="text"
              value={materialText}
              onChange={(e) => setMaterialText(e.target.value)}
              placeholder="Add material(s) you already have… e.g. a hammer, spare screws"
            />
            <button type="submit" disabled={!materialText.trim()}>
              Add
            </button>
          </form>
        </div>
      )}

      {editingNameItem && (
        <EditNameModal
          item={editingNameItem}
          onClose={() => setEditingNameItem(null)}
          onSave={(name) => handleRename(editingNameItem, name)}
        />
      )}

      {editingCategoryItem && (
        <EditCategoryModal
          item={editingCategoryItem}
          onClose={() => setEditingCategoryItem(null)}
          onSelect={(category) => handleSetCategory(editingCategoryItem, category)}
        />
      )}
    </>
  );
}
