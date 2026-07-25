import { useEffect, useMemo, useState } from 'react';
import type { ShoppingCategory, ShoppingItem, Task } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER, subscribeToShoppingItems, togglePurchaseGroup } from '../api';
import { useTasks } from '../useTasks';
import { TaskDetail } from './TaskDetail';
import './ShoppingListSection.css';
import './ShoppingView.css';

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

  const groups = useMemo(() => {
    const all = groupItems(items);
    return selectedCategory === 'all' ? all : all.filter((g) => g.category === selectedCategory);
  }, [items, selectedCategory]);

  async function handleToggleGroup(group: ShoppingGroup) {
    try {
      await togglePurchaseGroup(group.normalizedName, !group.allPurchased);
    } catch {
      setError("Couldn't update that item — try again.");
    }
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
          >
            All
          </button>
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              className={`shopping-category-tab ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
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
