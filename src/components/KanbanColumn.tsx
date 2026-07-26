import { useState, type FormEvent } from 'react';
import type { Task } from '../types';
import { TaskCard } from './TaskCard';

export type ColumnId = 'unscheduled' | 'todo' | 'in_progress' | 'done';

interface KanbanColumnProps {
  id: ColumnId;
  label: string;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onDrop: (id: ColumnId) => void;
  onQuickAdd: (title: string) => void;
  showQuickAdd: boolean;
  isTouchDragOver: boolean;
  onTouchHover: (id: ColumnId | null) => void;
}

export function KanbanColumn({
  id,
  label,
  tasks,
  onOpenTask,
  onDragStart,
  onDrop,
  onQuickAdd,
  showQuickAdd,
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
      className={`kanban-column status-${id} ${isDragOver || isTouchDragOver ? 'drag-over' : ''}`}
      data-kanban-status={id}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => {
        setIsDragOver(false);
        onDrop(id);
      }}
    >
      <header className="kanban-column-header">
        <span className="kanban-column-dot" />
        <h2>{label}</h2>
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

      {showQuickAdd && (
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
