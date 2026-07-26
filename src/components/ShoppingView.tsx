import { useEffect, useMemo, useState } from 'react';
import type { ShoppingCategory, ShoppingItem, Task } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER, subscribeToShoppingItems, togglePurchaseGroup } from '../api';
import { syncWithRetry } from '../syncQueue';
import { useOptimisticShoppingItems } from '../useOptimisticShoppingItems';
import { useTasks } from '../useTasks';
import { TaskDetail } from './TaskDetail';
import './ShoppingListSection.css';
import './ShoppingView.css';

function AllIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function GroceriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 10c-3 0-5 2.1-5 5.2 0 3 1.8 5.3 3.6 5.3.8 0 1-.3 1.4-.3s.6.3 1.4.3c1.8 0 3.6-2.5 3.6-5.5 0-2.8-1.6-4.8-3.6-5" />
      <path d="M12 10c0-1.6.9-2.8 2.2-3.3" />
      <path d="M11.6 7c0-1-.9-1.8-2-2" />
    </svg>
  );
}

function DiyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.2 8.8a4.5 4.5 0 0 1-5.9 5.9L7.5 21.5 4 18l6.8-6.8a4.5 4.5 0 0 1 5.9-5.9l-3 3 1.6 1.6 3-3Z" />
    </svg>
  );
}

function ElectronicsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 3 5 14h5l-1 8 9-12h-5l1-7Z" />
    </svg>
  );
}

function OtherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.6 3.5 20 10.9a2 2 0 0 1 0 2.8l-6.3 6.3a2 2 0 0 1-2.8 0L3.5 12.6V6a2.5 2.5 0 0 1 2.5-2.5h6.6Z" />
      <circle cx="8.2" cy="8.2" r="1.3" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<ShoppingCategory, typeof GroceriesIcon> = {
  groceries: GroceriesIcon,
  diy: DiyIcon,
  electronics: ElectronicsIcon,
  other: OtherIcon,
};

interface ShoppingGroup {
  normalizedName: string;
  name: string;
  category: ShoppingCategory | null;
  items: ShoppingItem[];
  allPurchased: boolean;
}

function groupItems(items: ShoppingItem[]): ShoppingGroup[] {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const list = map.get(item.normalizedName) ?? [];
    list.push(item);
    map.set(item.normalizedName, list);
  }

  return [...map.values()]
    .map((group) => ({
      normalizedName: group[0].normalizedName,
      name: group[0].name,
      category: group.find((i) => i.category !== null)?.category ?? null,
      items: group,
      allPurchased: group.every((i) => i.purchased),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function ShoppingView() {
  const { tasks, isOnline, refresh, saveTask, removeTask } = useTasks();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ShoppingCategory | 'all'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    return subscribeToShoppingItems(setItems, () => setError('Could not load shopping items.'));
  }, [isOnline]);

  const { displayItems, setOverride, clearOverride } = useOptimisticShoppingItems(items);

  const groups = useMemo(() => {
    const all = groupItems(displayItems);
    return selectedCategory === 'all' ? all : all.filter((g) => g.category === selectedCategory);
  }, [displayItems, selectedCategory]);

  function handleToggleGroup(group: ShoppingGroup) {
    const next = !group.allPurchased;
    const ids = group.items.map((i) => i.id);
    setOverride(ids, next);
    syncWithRetry(
      `shopping-group:${group.normalizedName}`,
      () => togglePurchaseGroup(group.normalizedName, next),
      () => {
        clearOverride(ids);
        setError("Couldn't update that item — try again.");
      },
    );
  }

  async function handleSaveTask(id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes'>>) {
    try {
      await saveTask(id, updates);
      setSelectedTaskId(null);
    } catch {
      setError('Could not save that task — try again.');
    }
  }

  async function handleDeleteTask(id: string) {
    try {
      await removeTask(id);
      setSelectedTaskId(null);
    } catch {
      setError('Could not delete that task — try again.');
    }
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="shopping-page">
      {!isOnline && (
        <p className="board-offline">You're offline — the shopping list is unavailable.</p>
      )}
      {error && <p className="board-error">{error}</p>}

      <div className="shopping-page-header">
        <h2>Shopping</h2>
        <div className="shopping-category-tabs">
          <button
            type="button"
            className={`shopping-category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
            aria-label="All"
            title="All"
          >
            <AllIcon />
          </button>
          {CATEGORY_ORDER.map((category) => {
            const Icon = CATEGORY_ICONS[category];
            return (
              <button
                key={category}
                type="button"
                className={`shopping-category-tab ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
                aria-label={CATEGORY_LABELS[category]}
                title={CATEGORY_LABELS[category]}
              >
                <Icon />
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="shopping-page-empty">Nothing here yet — add items from a task's shopping list.</p>
      ) : (
        <ul className="shopping-group-list">
          {groups.map((group) => {
            const taskTitles = [...new Map(group.items.map((i) => [i.taskId, i.taskTitle])).entries()];
            return (
              <li key={group.normalizedName} className={`shopping-group ${group.allPurchased ? 'purchased' : ''}`}>
                <input
                  type="checkbox"
                  className="shopping-checkbox"
                  checked={group.allPurchased}
                  onChange={() => handleToggleGroup(group)}
                  aria-label={`Mark ${group.name} as purchased`}
                />
                <div className="shopping-group-body">
                  <div className="shopping-group-title-row">
                    <span className="shopping-group-name">{group.name}</span>
                    {group.items.length > 1 && (
                      <span className="shopping-group-count">×{group.items.length}</span>
                    )}
                    {group.category && (
                      <span className={`shopping-category-pill shopping-category-${group.category}`}>
                        {CATEGORY_LABELS[group.category]}
                      </span>
                    )}
                  </div>
                  <div className="shopping-group-source">
                    from:{' '}
                    {taskTitles.map(([taskId, title], i) => (
                      <span key={taskId}>
                        {i > 0 && ', '}
                        <button
                          type="button"
                          className="shopping-group-task-link"
                          onClick={() => setSelectedTaskId(taskId)}
                        >
                          {title}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selectedTask && (
        <TaskDetail
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onTasksChanged={refresh}
          isOnline={isOnline}
        />
      )}
    </div>
  );
}
