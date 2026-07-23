import { useState, type FormEvent } from 'react';
import type { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';

const COLUMN_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onDrop: (status: TaskStatus) => void;
  onQuickAdd: (title: string) => void;
  isTouchDragOver: boolean;
  onTouchHover: (status: TaskStatus | null) => void;
}

export function KanbanColumn({
  status,
  tasks,
  onOpenTask,
  onDragStart,
  onDrop,
  onQuickAdd,
  isTouchDragOver,
  onTouchHover,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [draft, setDraft] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onQuickAdd(title);
    setDraft('');
  }

  return (
    <section
      className={`kanban-column status-${status} ${isDragOver || isTouchDragOver ? 'drag-over' : ''}`}
      data-kanban-status={status}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => {
        setIsDragOver(false);
        onDrop(status);
      }}
    >
      <header className="kanban-column-header">
        <span className="kanban-column-dot" />
        <h2>{COLUMN_LABELS[status]}</h2>
        <span className="kanban-column-count">{tasks.length}</span>
      </header>

      <div className="kanban-column-cards">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={onOpenTask}
            onDragStart={onDragStart}
            onTouchDrop={onDrop}
            onTouchHover={onTouchHover}
          />
        ))}
      </div>

      {status === 'todo' && (
        <form className="quick-add" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Add a task…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
      )}
    </section>
  );
}
