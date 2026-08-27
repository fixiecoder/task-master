import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Task } from '../types';
import { queueCreateTask, queueUpdateTask } from '../api';
import { useTasks } from '../useTasks';
import { useProjects } from '../useProjects';
import { KanbanColumn, type ColumnId } from './KanbanColumn';
import { QuickAddTaskModal } from './QuickAddTaskModal';
import { TaskDetail } from './TaskDetail';
import { StartDatePromptModal } from './StartDatePromptModal';
import { ProjectFilter, UNASSIGNED_PROJECT_FILTER } from './ProjectFilter';
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
  const { projects } = useProjects();
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
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

  // Empty set = no filter applied (show every task).
  const projectFilter = useMemo(() => new Set(searchParams.getAll('project')), [searchParams]);
  function toggleProjectFilter(id: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const current = new Set(next.getAll('project'));
      if (current.has(id)) current.delete(id);
      else current.add(id);
      next.delete('project');
      for (const projectId of current) next.append('project', projectId);
      return next;
    });
  }
  function setProjectFilter(ids: string[]) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('project');
      for (const projectId of ids) next.append('project', projectId);
      return next;
    });
  }
  const visibleTasks = useMemo(() => {
    if (projectFilter.size === 0) return tasks;
    return tasks.filter((t) => projectFilter.has(t.projectId ?? UNASSIGNED_PROJECT_FILTER));
  }, [tasks, projectFilter]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [touchDragOverColumn, setTouchDragOverColumn] = useState<ColumnId | null>(null);
  const [startDatePromptTaskId, setStartDatePromptTaskId] = useState<string | null>(null);

  // `?new=task` (paired with `?project=<id>`, which already doubles as the
  // filter) is a cross-app deep link — e.g. from the dashboard's project
  // "Add" button — that opens the quick-add modal pre-scoped to a project.
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  useEffect(() => {
    if (searchParams.get('new') !== 'task') return;
    setIsQuickAddModalOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('new');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDrop(task: Task, updates: Partial<Pick<Task, 'status' | 'dates'>>) {
    const optimistic = queueUpdateTask(task, updates, () => {
      setError('Could not move that task — try again.');
      refresh();
    });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? optimistic : t)));
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

  function handleConfirmStartDate(date: string) {
    const task = tasks.find((t) => t.id === startDatePromptTaskId);
    setStartDatePromptTaskId(null);
    if (!task) return;

    const dates = [...(task.dates ?? []), { id: crypto.randomUUID(), type: 'start' as const, date, durationMinutes: null }];
    applyDrop(task, { status: 'todo', dates });
  }

  function handleQuickAdd(title: string) {
    const task = queueCreateTask(title, null, null, () => setError('Could not create that task — try again.'));
    setTasks((prev) => [task, ...prev]);
  }

  function handleQuickAddModalSave(title: string) {
    const deepLinkProjectId = projectFilter.size > 0 ? [...projectFilter][0] : null;
    const task = queueCreateTask(title, null, deepLinkProjectId, () => setError('Could not create that task — try again.'));
    setTasks((prev) => [task, ...prev]);
    setIsQuickAddModalOpen(false);
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
  const startDatePromptTask = tasks.find((t) => t.id === startDatePromptTaskId) ?? null;

  return (
    <div className="board-page">
      {!isOnline && (
        <p className="board-offline">You're offline — showing saved tasks. AI chat is unavailable.</p>
      )}
      {error && <p className="board-error">{error}</p>}

      {projects.length > 0 && (
        <ProjectFilter
          projects={projects}
          selected={projectFilter}
          onToggle={toggleProjectFilter}
          onSetAll={setProjectFilter}
        />
      )}

      {isLoading ? (
        <p className="board-loading">Loading tasks…</p>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map(({ id, label }) => (
            <KanbanColumn
              key={id}
              id={id}
              label={label}
              tasks={visibleTasks.filter((t) => columnFor(t) === id)}
              projectsById={projectsById}
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

      {isQuickAddModalOpen && (
        <QuickAddTaskModal
          onClose={() => setIsQuickAddModalOpen(false)}
          onSave={handleQuickAddModalSave}
        />
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
