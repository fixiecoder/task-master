import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import type { ShoppingCategory, ShoppingItem, Task } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER, queueTogglePurchaseGroup } from '../api';
import { useOptimisticShoppingItems } from '../useOptimisticShoppingItems';
import { useShoppingItems } from '../useShoppingItems';
import { useTasks } from '../useTasks';
import { TaskDetail } from './TaskDetail';
import './ShoppingListSection.css';
import './ShoppingView.css';
import { AllCategoriesIcon, DiyIcon, ElectronicsIcon, GroceriesIcon, OtherIcon } from '../icons';

const CATEGORY_ICONS: Record<ShoppingCategory, typeof GroceriesIcon> = {
  groceries: GroceriesIcon,
  diy: DiyIcon,
  electronics: ElectronicsIcon,
  other: OtherIcon,
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface ShoppingGroup {
  normalizedName: string;
  name: string;
  category: ShoppingCategory | null;
  items: ShoppingItem[];
  allPurchased: boolean;
  purchasedAtMillis: number | null;
}

function toMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function groupItems(items: ShoppingItem[]): ShoppingGroup[] {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const list = map.get(item.normalizedName) ?? [];
    list.push(item);
    map.set(item.normalizedName, list);
  }

  return [...map.values()]
    .map((group) => {
      const purchasedAtMillis = group
        .map((i) => toMillis(i.purchasedAt))
        .filter((ms): ms is number => ms !== null)
        .reduce((max, ms) => (max === null || ms > max ? ms : max), null as number | null);
      return {
        normalizedName: group[0].normalizedName,
        name: group[0].name,
        category: group.find((i) => i.category !== null)?.category ?? null,
        items: group,
        allPurchased: group.every((i) => i.purchased),
        purchasedAtMillis,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isOldPurchase(group: ShoppingGroup): boolean {
  return group.allPurchased && group.purchasedAtMillis !== null && Date.now() - group.purchasedAtMillis > ONE_DAY_MS;
}

export function ShoppingView() {
  const { tasks, isOnline, refresh, saveTask, removeTask } = useTasks();
  const { items, error: itemsError } = useShoppingItems();
  const [error, setError] = useState<string | null>(null);
  const [showOldPurchases, setShowOldPurchases] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryParam = searchParams.get('category');
  const selectedCategory: ShoppingCategory | 'all' =
    categoryParam && (CATEGORY_ORDER as string[]).includes(categoryParam) ? (categoryParam as ShoppingCategory) : 'all';
  function setSelectedCategory(category: ShoppingCategory | 'all') {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (category === 'all') next.delete('category');
      else next.set('category', category);
      return next;
    });
  }

  const selectedTaskId = searchParams.get('task');
  function setSelectedTaskId(id: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('task', id);
      else next.delete('task');
      return next;
    });
  }

  const { displayItems, setOverride, clearOverride } = useOptimisticShoppingItems(items);

  const { currentGroups, oldGroups } = useMemo(() => {
    const active = displayItems.filter((item) => !item.archived);
    const all = groupItems(active);
    const filtered = selectedCategory === 'all' ? all : all.filter((g) => g.category === selectedCategory);
    return {
      currentGroups: filtered.filter((g) => !isOldPurchase(g)),
      oldGroups: filtered.filter((g) => isOldPurchase(g)),
    };
  }, [displayItems, selectedCategory]);

  const groups = showOldPurchases ? [...currentGroups, ...oldGroups] : currentGroups;

  function handleToggleGroup(group: ShoppingGroup) {
    const next = !group.allPurchased;
    const ids = group.items.map((i) => i.id);
    setOverride(ids, next);
    queueTogglePurchaseGroup(group.normalizedName, ids, next, () => {
      clearOverride(ids);
      setError("Couldn't update that item — try again.");
    });
  }

  function handleSaveTask(id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes' | 'dates' | 'estimatedMinutes' | 'projectId'>>) {
    saveTask(id, updates);
    setSelectedTaskId(null);
  }

  function handleDeleteTask(id: string) {
    removeTask(id);
    setSelectedTaskId(null);
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="shopping-page">
      {!isOnline && (
        <p className="board-offline">You're offline — showing saved items.</p>
      )}
      {(error || itemsError) && <p className="board-error">{error ?? itemsError}</p>}

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
            <AllCategoriesIcon />
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

      {oldGroups.length > 0 && (
        <label className="shopping-old-purchases-toggle">
          <input
            type="checkbox"
            checked={showOldPurchases}
            onChange={(e) => setShowOldPurchases(e.target.checked)}
          />
          Show/Hide old purchases
        </label>
      )}

      {groups.length === 0 ? (
        <p className="shopping-page-empty">Nothing here yet — add items from a task's shopping list.</p>
      ) : (
        <ul className="shopping-group-list">
          {groups.map((group, index) => {
            const taskTitles = [...new Map(group.items.map((i) => [i.taskId, i.taskTitle])).entries()];
            const isFirstOld = index === currentGroups.length && oldGroups.length > 0;
            return (
              <Fragment key={group.normalizedName}>
                {isFirstOld && (
                  <li className="shopping-old-purchases-divider" aria-hidden="true">
                    Older purchases
                  </li>
                )}
                <li className={`shopping-group ${group.allPurchased ? 'purchased' : ''}`}>
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
              </Fragment>
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
