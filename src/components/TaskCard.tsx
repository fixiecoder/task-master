import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onDragStart: (task: Task) => void;
}

export function TaskCard({ task, onOpen, onDragStart }: TaskCardProps) {
  return (
    <button
      type="button"
      className="task-card"
      draggable
      onDragStart={() => onDragStart(task)}
      onClick={() => onOpen(task)}
    >
      <span className="task-card-title">{task.title}</span>
      {task.notes && <span className="task-card-notes-dot" title="Has notes" />}
    </button>
  );
}
