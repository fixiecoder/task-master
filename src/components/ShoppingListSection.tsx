import { useEffect, useState, type FormEvent } from 'react';
import type { ShoppingCategory, ShoppingItem } from '../types';
import {
  addShoppingItems,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  deleteShoppingItem,
  setShoppingItemCategory,
  subscribeToShoppingItems,
  toggleShoppingItemPurchased,
} from '../api';
import { syncWithRetry } from '../syncQueue';
import { useOptimisticShoppingItems } from '../useOptimisticShoppingItems';
import './ShoppingListSection.css';

interface ShoppingListSectionProps {
  taskId: string;
  isOnline: boolean;
}

interface ItemRowProps {
  item: ShoppingItem;
  showCheckbox: boolean;
  onTogglePurchased: (item: ShoppingItem) => void;
  onSetCategory: (item: ShoppingItem, category: ShoppingCategory) => void;
  onDelete: (item: ShoppingItem) => void;
}

function ItemRow({ item, showCheckbox, onTogglePurchased, onSetCategory, onDelete }: ItemRowProps) {
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
      <span className="shopping-item-name">{item.name}</span>
      {item.category ? (
        <span className={`shopping-category-pill shopping-category-${item.category}`}>
          {CATEGORY_LABELS[item.category]}
        </span>
      ) : (
        <span className="shopping-category-picker">
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              className="shopping-category-choice"
              onClick={() => onSetCategory(item, category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </span>
      )}
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

export function ShoppingListSection({ taskId, isOnline }: ShoppingListSectionProps) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addText, setAddText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [materialText, setMaterialText] = useState('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    return subscribeToShoppingItems(
      (allItems) => setItems(allItems.filter((item) => item.taskId === taskId)),
      () => setError('Could not load the shopping list.'),
    );
  }, [taskId, isOnline]);

  const { displayItems, setOverride, clearOverride } = useOptimisticShoppingItems(items);
  const shoppingListItems = displayItems.filter((item) => !item.purchased);
  const materials = displayItems.filter((item) => item.purchased);

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    const text = addText.trim();
    if (!text || isAdding) return;

    setIsAdding(true);
    setError(null);
    try {
      await addShoppingItems(taskId, text);
      setAddText('');
    } catch {
      setError("Couldn't add that — try again.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleAddMaterialSubmit(e: FormEvent) {
    e.preventDefault();
    const text = materialText.trim();
    if (!text || isAddingMaterial) return;

    setIsAddingMaterial(true);
    setError(null);
    try {
      await addShoppingItems(taskId, text, true);
      setMaterialText('');
    } catch {
      setError("Couldn't add that — try again.");
    } finally {
      setIsAddingMaterial(false);
    }
  }

  function handleTogglePurchased(item: ShoppingItem) {
    const next = !item.purchased;
    setOverride([item.id], next);
    syncWithRetry(
      `shopping-item:${item.id}`,
      async () => { await toggleShoppingItemPurchased(item.id, next); },
      () => {
        clearOverride([item.id]);
        setError("Couldn't update that item — try again.");
      },
    );
  }

  async function handleSetCategory(item: ShoppingItem, category: ShoppingCategory) {
    try {
      await setShoppingItemCategory(item.id, category);
    } catch {
      setError("Couldn't set that category — try again.");
    }
  }

  async function handleDelete(item: ShoppingItem) {
    try {
      await deleteShoppingItem(item.id);
    } catch {
      setError("Couldn't delete that item — try again.");
    }
  }

  if (!isOnline) {
    return (
      <div className="shopping-list-section">
        <div className="shopping-list-header">
          <span>Shopping list</span>
        </div>
        <p className="shopping-list-offline">Shopping list is unavailable while offline.</p>
      </div>
    );
  }

  return (
    <>
      <div className="shopping-list-section">
        <div className="shopping-list-header">
          <span>Shopping list</span>
        </div>

        {error && <p className="shopping-list-error">{error}</p>}

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
                onSetCategory={handleSetCategory}
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
            disabled={isAdding}
          />
          <button type="submit" disabled={isAdding || !addText.trim()}>
            {isAdding ? 'Adding…' : 'Add'}
          </button>
        </form>
      </div>

      <div className="shopping-list-section materials-section">
        <div className="shopping-list-header">
          <span>Materials</span>
        </div>
        <p className="materials-hint">Items already available for this task — checking off a shopping item moves it here.</p>

        {materials.length === 0 ? (
          <p className="shopping-list-empty">Nothing available yet.</p>
        ) : (
          <ul className="shopping-item-list">
            {materials.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                showCheckbox={false}
                onTogglePurchased={handleTogglePurchased}
                onSetCategory={handleSetCategory}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}

        <form className="shopping-add-form" onSubmit={handleAddMaterialSubmit}>
          <input
            type="text"
            value={materialText}
            onChange={(e) => setMaterialText(e.target.value)}
            placeholder="Add material(s) you already have… e.g. a hammer, spare screws"
            disabled={isAddingMaterial}
          />
          <button type="submit" disabled={isAddingMaterial || !materialText.trim()}>
            {isAddingMaterial ? 'Adding…' : 'Add'}
          </button>
        </form>
      </div>
    </>
  );
}
