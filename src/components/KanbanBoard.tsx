import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Task } from '../types';
import { createTask, updateTask } from '../api';
import { useTasks } from '../useTasks';
import { KanbanColumn, type ColumnId } from './KanbanColumn';
import { TaskDetail } from './TaskDetail';
import { StartDatePromptModal } from './StartDatePromptModal';
import { withDateStamp } from '../taskDates';
import './Board.css';

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'unscheduled', label: 'Unscheduled' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

// A task belongs to Unscheduled purely because it has no dates yet — not
// because of its status — so todo/in_progress only show tasks that *do*
// have a date, keeping every task in exactly one column.
function columnFor(task: Task): ColumnId {
  if (task.status === 'done') return 'done';
  if ((task.dates ?? []).length === 0) return 'unscheduled';
  return task.status === 'in_progress' ? 'in_progress' : 'todo';
}

export function KanbanBoard() {
  const { tasks, setTasks, isLoading, error, setError, isOnline, refresh, saveTask, removeTask } = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get('task');
  function setSelectedTaskId(id: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('task', id);
      else next.delete('task');
      return next;
    });
  }
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [touchDragOverColumn, setTouchDragOverColumn] = useState<ColumnId | null>(null);
  const [startDatePromptTaskId, setStartDatePromptTaskId] = useState<string | null>(null);

  async function applyDrop(task: Task, updates: Partial<Pick<Task, 'status' | 'dates'>>) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updates } : t)));
    try {
      await updateTask(task.id, updates);
    } catch {
      setError('Could not move that task — try again.');
      refresh();
    }
  }

  function handleDrop(columnId: ColumnId) {
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    if (!task || columnFor(task) === columnId) return;

    if (columnId === 'todo' && (task.dates ?? []).length === 0) {
      setStartDatePromptTaskId(task.id);
      return;
    }

    let updates: Partial<Pick<Task, 'status' | 'dates'>>;
    if (columnId === 'unscheduled') {
      updates = { status: 'todo', dates: [] };
    } else if (columnId === 'in_progress') {
      updates = { status: 'in_progress', dates: withDateStamp(task.dates ?? [], 'start') };
    } else if (columnId === 'done') {
      updates = { status: 'done', dates: withDateStamp(task.dates ?? [], 'completed') };
    } else {
      updates = { status: 'todo' };
    }

    applyDrop(task, updates);
  }

  async function handleConfirmStartDate(date: string) {
    const task = tasks.find((t) => t.id === startDatePromptTaskId);
    setStartDatePromptTaskId(null);
    if (!task) return;

    const dates = [...(task.dates ?? []), { id: crypto.randomUUID(), type: 'start' as const, date, durationMinutes: null }];
    await applyDrop(task, { status: 'todo', dates });
  }

  async function handleQuickAdd(title: string) {
    try {
      const task = await createTask(title);
      setTasks((prev) => [task, ...prev]);
    } catch {
      setError('Could not create that task — try again.');
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
  const startDatePromptTask = tasks.find((t) => t.id === startDatePromptTaskId) ?? null;

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
          {COLUMNS.map(({ id, label }) => (
            <KanbanColumn
              key={id}
              id={id}
              label={label}
              tasks={tasks.filter((t) => columnFor(t) === id)}
              onOpenTask={(task) => setSelectedTaskId(task.id)}
              onDragStart={(task) => setDraggedTaskId(task.id)}
              onDrop={handleDrop}
              onQuickAdd={handleQuickAdd}
              showQuickAdd={id === 'unscheduled'}
              isTouchDragOver={touchDragOverColumn === id}
              onTouchHover={setTouchDragOverColumn}
            />
          ))}
        </div>
      )}

      {startDatePromptTask && (
        <StartDatePromptModal
          taskTitle={startDatePromptTask.title}
          onClose={() => setStartDatePromptTaskId(null)}
          onConfirm={handleConfirmStartDate}
        />
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
