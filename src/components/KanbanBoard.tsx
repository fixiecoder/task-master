import { useCallback, useEffect, useState } from 'react';
import type { Task, TaskStatus } from '../types';
import { createTask, listTasks, subscribeToTasks, updateTask, TASK_STATUSES } from '../api';
import { useOnlineStatus } from '../useOnlineStatus';
import { KanbanColumn } from './KanbanColumn';
import { TaskDetail } from './TaskDetail';
import { PromptBar } from './PromptBar';
import './Board.css';

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [touchDragOverStatus, setTouchDragOverStatus] = useState<TaskStatus | null>(null);
  const isOnline = useOnlineStatus();

  // Manual fallback used for offline reads (served from the local cache)
  // and to recover from a failed drag-and-drop move.
  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
      setError(null);
    } catch {
      setError('Could not load tasks.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- offline fallback load
      refresh();
      return;
    }

    const unsubscribe = subscribeToTasks(
      (liveTasks) => {
        setTasks(liveTasks);
        setError(null);
        setIsLoading(false);
      },
      () => {
        setError('Could not load tasks.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [isOnline, refresh]);

  async function handleDrop(status: TaskStatus) {
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    if (!task || task.status === status) return;

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await updateTask(task.id, { status });
    } catch {
      setError('Could not move that task — try again.');
      refresh();
    }
  }

  async function handleQuickAdd(title: string) {
    try {
      const task = await createTask(title);
      setTasks((prev) => [task, ...prev]);
    } catch {
      setError('Could not create that task — try again.');
    }
  }

  async function handleSaveTask(id: string, updates: Partial<Pick<Task, 'title' | 'status' | 'notes'>>) {
    try {
      const updated = await updateTask(id, updates);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setSelectedTaskId(null);
    } catch {
      setError('Could not save that task — try again.');
    }
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="board-page">
      {!isOnline && (
        <p className="board-offline">You're offline — showing saved tasks. AI chat is unavailable.</p>
      )}
      {error && <p className="board-error">{error}</p>}

      {isLoading ? (
        <p className="board-loading">Loading tasks…</p>
      ) : (
        <div className="kanban-board">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
              onOpenTask={(task) => setSelectedTaskId(task.id)}
              onDragStart={(task) => setDraggedTaskId(task.id)}
              onDrop={handleDrop}
              onQuickAdd={handleQuickAdd}
              isTouchDragOver={touchDragOverStatus === status}
              onTouchHover={setTouchDragOverStatus}
            />
          ))}
        </div>
      )}

      {isOnline && <PromptBar onTasksChanged={refresh} />}

      {selectedTask && (
        <TaskDetail
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onSave={handleSaveTask}
          onTasksChanged={refresh}
          isOnline={isOnline}
        />
      )}
    </div>
  );
}
